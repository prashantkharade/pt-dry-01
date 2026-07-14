# Cross-cutting Features Guide

> Companion to [`../IMPLEMENTATION-GUIDE.md`](../IMPLEMENTATION-GUIDE.md).
>
> Covers concerns that span backend, admin portal, and Flutter app:
> **i18n, theming, audit log, OTP, payments, notifications, offline,
> PDF invoices, reports/charts, observability.**
>
> The three platform-specific guides ([backend](01-backend.md), [admin portal](02-admin-portal.md), [Flutter](03-customer-app-flutter.md)) reference this document for the canonical patterns.

---

## 1. Audit log (BRIEF §2.5)

**Scope:** every admin/receptionist action on orders, bills, rate cards, users, subscriptions.

### Backend
Entity (mirror `D:\kleo\kleo-backend-exp\src\database\typeorm\models\` audit shape):

```ts
@Entity({ name: 'audit_entries' })
export class AuditEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') TenantId: string;
  @Index() @Column('uuid', { nullable: true }) UserId: string;        // actor
  @Column() Actor: string;                                            // "Rohan Patil (Receptionist)"
  @Column() Resource: string;                                         // "Order"
  @Index() @Column('uuid', { nullable: true }) ResourceId: string;
  @Column() Action: string;                                           // "Order.StatusUpdate"
  @Column('jsonb', { nullable: true }) Before: Record<string, unknown>;
  @Column('jsonb', { nullable: true }) After: Record<string, unknown>;
  @Column({ nullable: true }) Ip: string;
  @Column({ nullable: true }) UserAgent: string;
  @CreateDateColumn() CreatedAt: Date;
}
```

**How rows are written:** a single Express middleware mounted **after** the controller. Controllers attach `req.audit = { before, after }` (or just `after` for creates); the middleware persists the row asynchronously via BullMQ `audit` queue so it never blocks the response.

**Diff strategy:** for updates, store full `before` and `after` JSON. Render diffs in the UI (see admin portal guide §12). For sensitive fields (passwords, OTPs), strip before persisting.

**Retention:** 180 d hot in Postgres; older archived to S3 via `audit-archival` BullMQ job (see `01-backend.md` §9).

**Anchor for "publish audit as event":** charqol's `EventStore` outbox (`D:\charqol\user-service\src\events\event.emitter.ts`) — emit `audit.entry.created` alongside the row so a downstream analytics service can subscribe later.

---

## 2. OTP (login + verification)

End-to-end flow used by both admin portal (signin) and Flutter app:

```
client                identity-service              Redis           MSG91 / SES
  │  POST /auth/otp/send {phone, channel: SMS}       │                  │
  │ ────────────────────────────────────────────────►│                  │
  │                      validate phone, rate-limit  │                  │
  │                      generate 6-digit code       │                  │
  │                      SET otp:SMS:+91… (TTL 5m)   │────►             │
  │                      send SMS via MSG91          │ ────────────────►│
  │ ◄────────────────────────────────────────────────│                  │
  │  POST /auth/otp/verify {phone, code, scope}      │                  │
  │ ────────────────────────────────────────────────►│                  │
  │                      GET otp:SMS:+91…  → match? ◄│                  │
  │                      issue JWT access+refresh    │                  │
  │ ◄──── {accessToken, refreshToken, user} ─────────│                  │
```

Enum constants — copy from `D:\Batterlicious\user-service\src\domain.types\users\user.enums.ts`:
```ts
export enum OTPScope { Login, ChangePassword, ResetPassword, VerifyEmail, VerifyPhone }
export enum OTPChannel { SMS, EMAIL }
```

Rate-limits:
- `send` — max 3 per phone per 15 min, max 10 per phone per day
- `verify` — max 5 attempts per code; on exceed, delete the OTP key and require a fresh `send`

Anti-abuse: hash the phone+IP into a Redis key for the rate-limit counter.

---

## 3. Internationalisation — English + Marathi

> ✅ **Implemented in `impl/`** — English + Marathi in both apps. Flutter uses
> `flutter_localizations` + gen-l10n ARB (as recommended); the admin portal uses
> a small typed dictionary instead of `paraglide-js` (deviation noted in
> [`08-personalization-status.md`](08-personalization-status.md) §3).

### 3.1 Admin portal (SvelteKit)
**Library:** `paraglide-js` (compile-time, type-safe, SvelteKit-first). No reference repo uses it — first-mover, but the cleanest option for new SvelteKit projects.

Structure:
```
project.inlang/settings.json     ← {"languages":["en","mr"],"sourceLanguageTag":"en"}
messages/en.json                 ← {"orders.new.title":"New order", …}
messages/mr.json                 ← {"orders.new.title":"नवीन ऑर्डर", …}
src/lib/paraglide/runtime.ts     ← generated
```

Hooks: `+layout.server.ts` reads `Accept-Language`, falls back to user preference, then to `en`. Cookie `lang=en|mr` for persistence.

### 3.2 Flutter app
Standard `flutter_localizations` + ARB files. See `03-customer-app-flutter.md` §11.

### 3.3 Backend templates (SMS, email, in-app)
Templates per locale stored as JSON seeds: `seed.data/notification.templates/<key>.<lang>.json`. Pick by `user.preferredLanguage` (or default `en`).

Sample Marathi templates (mandatory in BRIEF §4 for hi-fi realism):

| Key                          | en                                                       | mr                                                                  |
|------------------------------|----------------------------------------------------------|---------------------------------------------------------------------|
| `order.created`              | "Order #{id} placed. Pickup at {time}."                  | "ऑर्डर #{id} नोंदवली. पिकअप {time}."                                |
| `order.ready`                | "Hi {name}, your order is ready. Pay {amount}."          | "नमस्कार {name}, तुमची ऑर्डर तयार आहे. {amount} द्या."             |
| `order.out_for_delivery`     | "Out for delivery — {courier} will arrive by {eta}."     | "डिलिव्हरीसाठी निघाली — {courier} {eta} पर्यंत येईल."              |
| `payment.received`           | "Payment of {amount} received. Thanks!"                  | "{amount} ची पेमेंट मिळाली. धन्यवाद!"                              |
| `subscription.renewed`       | "Your {plan} plan is renewed till {date}."               | "{plan} योजना {date} पर्यंत नूतनीकरण झाली."                        |

### 3.4 Marathi typography
- Admin portal: **Noto Sans Devanagari** loaded via `@fontsource/noto-sans-devanagari`, applied when `data-locale="mr"` on `<html>`.
- Flutter: `GoogleFonts.notoSansDevanagari()` swap when locale is `mr`.
- INR formatting: use `intl` (`NumberFormat.currency(locale: 'en_IN', symbol: '₹')`) or `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` — gives `₹1,250.00` with the Indian digit grouping (lakh, crore).

---

## 4. Theming (BRIEF §2.5)

> ✅ **Implemented in `impl/`** — all five dimensions + light/dark are live in
> both the Flutter customer app and the SvelteKit admin portal, persisted
> per-user. See [`08-personalization-status.md`](08-personalization-status.md)
> for the spec-token→file map and the list of deviations from the design below.

Specification: each user can configure **background colour**, **border style**, **font family**, **font size**, **light/dark**. Persisted per user. Applies to admin portal **and** customer app.

### 4.1 Theme tokens (shared concept)
```
{
  mode: 'light' | 'dark',
  background: '#FFFFFF',       // any picker value
  surface: '#F7FAFC',
  accent: '#0EA5E9',           // brand laundry blue (default)
  borderStyle: 'soft' | 'sharp' | 'pill',
  borderRadius: 4 | 8 | 12 | 999,
  fontFamily: 'Inter' | 'Noto Sans' | 'Noto Sans Devanagari' | 'Roboto',
  fontSizeScale: 0.875 | 1 | 1.125 | 1.25
}
```
Stored at `user.preferences.theme` on the backend; cached in Redis under `user:<id>:prefs` (10-min TTL).

### 4.2 SvelteKit implementation
- Tokens written as **CSS variables** on `:root` from `+layout.svelte`.
- Tailwind v4 reads them via `bg-[--surface]` etc., or via a Tailwind plugin that maps `bg-surface` → `var(--surface)`.
- Multi-theme presets stored as TS files (rean pattern): `src/lib/themes/laundry-blue.theme.ts`, `mint-fresh.theme.ts`. Reference: `D:\Rean\admin-portal-v2\src\lib\themes\` (`aha.theme.ts`, `gmu.theme.ts`, `rean.theme.ts`).
- SSR hydration of the chosen theme: `+layout.server.ts` reads the user pref and ships an inline `<style>` block in the HTML head to prevent flash-of-unstyled-content.

### 4.3 Flutter implementation
See `03-customer-app-flutter.md` §10. Same token set, generated into a `ThemeData` via a `themeProvider`.

### 4.4 Default palette (BRIEF §4 — “laundry palette: fresh blues / whites / mint — never cartoonish”)
- Primary `#0EA5E9` (sky-500)
- Secondary `#10B981` (emerald-500 — mint accent)
- Surface `#F8FAFC` (slate-50)
- Background `#FFFFFF`
- Border (soft) `#E2E8F0`
- Danger `#DC2626`
- Success `#16A34A`

Dark-mode counterparts shifted by Tailwind's neutral scale.

---

## 5. Payments — Razorpay + Zoho dual gateway

### 5.1 State machine
**Source:** `D:\Batterlicious\batterlicious-service\src\state.machines\payment.state.ts`.

States: `Pending → Authorized → Captured → (Refunded | PartiallyRefunded) | Failed | Cancelled`.

Transitions (only allowed paths):
```
Pending     → Authorized | Failed | Cancelled
Authorized  → Captured | Failed
Captured    → Refunded | PartiallyRefunded
```
Implementing in TypeScript:
```ts
const transitions: Record<PaymentState, PaymentState[]> = {
  Pending: ['Authorized', 'Failed', 'Cancelled'],
  Authorized: ['Captured', 'Failed'],
  Captured: ['Refunded', 'PartiallyRefunded'],
  Refunded: [],
  PartiallyRefunded: ['Refunded'],
  Failed: [],
  Cancelled: []
};

export function canTransition(from: PaymentState, to: PaymentState) {
  return transitions[from]?.includes(to) ?? false;
}
```
Every transition writes a `PaymentEvent` audit row and emits an event (`payments.payment.<state>` topic).

### 5.2 Gateway interface
```ts
export interface IPaymentGateway {
  name: 'razorpay' | 'zohopay';
  createOrder(input: CreateOrderInput): Promise<GatewayOrder>;
  capture(paymentId: string, amount: number): Promise<PaymentResult>;
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
  verifyWebhook(headers: Record<string,string>, rawBody: Buffer): WebhookEvent | null;
}
```

### 5.3 Razorpay specifics
- Node SDK: `razorpay@^2.9.0`
- Webhook signature verification: HMAC-SHA256 with the webhook secret over the raw body
- Use `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` on client → server verify
- For subscriptions: use the **Subscriptions API** (`subscription_id`, hosted page for auth); store `subscription_id` on the user

### 5.4 Zoho Pay specifics
- No official Node SDK at present. Implement a thin HTTP client mirroring the config shape in `D:\Batterlicious\customer-app 2\Services\ZohoPaymentConfig.cs` (clientId, clientSecret, accountId, baseUrl, redirectUri).
- Auth via OAuth client-credentials; cache token in Redis with the TTL Zoho returns.
- Hosted payment page redirects back with a query-string status — backend verifies via Zoho's payment-lookup endpoint, never trust the redirect alone.

### 5.5 Webhook security checklist (both gateways)
1. Verify signature
2. Idempotency by webhook event id (`SET idempotency:webhook:<id> "" EX 86400 NX`); skip if present
3. Use a transactional `try`-`catch` around DB write + state transition; on failure return 5xx so the gateway retries
4. Acknowledge 200 only after persistence

### 5.6 Cash / UPI on delivery
- Order created with `paymentMethod = 'COD'` and payment state `Pending`.
- Receptionist marks paid via admin portal at delivery; transitions state to `Captured` with `gateway = 'manual'`.
- Audit row records the receptionist as the actor.

---

## 6. Notifications

**Single dispatcher service** (or module pre-split): all notifications flow through it.

**Reference for fan-out service:** `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts`.

API (called from any service via an async event or direct method):
```ts
interface NotificationDispatcher {
  send(opts: {
    channels: NotificationChannel[];      // SMS, EMAIL, WHATSAPP, FCM, IN_APP
    templateKey: string;                  // 'order.ready'
    recipient: {
      userId?: string;
      phone?: string; email?: string; fcmToken?: string;
    };
    locale?: 'en' | 'mr';
    data: Record<string, unknown>;        // template variables
    idempotencyKey?: string;              // de-dup
  }): Promise<NotificationResult>;
}
```

**Adapter wiring** (mirrors rean):
| Channel    | Provider (PT Kharade) | Provider in reference (rean)   |
|------------|-----------------------|--------------------------------|
| SMS        | MSG91                 | Twilio (port the adapter shape)|
| WhatsApp   | MSG91 WhatsApp API    | Behind a feature flag in rean  |
| Email      | AWS SES               | SendGrid (rean)                |
| FCM (push) | Firebase Admin SDK    | Firebase (rean)                |
| In-app     | DB row + SSE          | DB row (rean)                  |

**Failure handling:** each channel attempt logs a `NotificationAttempt` row; on failure, retry per BullMQ queue policy. Quiet hours (22:00–08:00 IST) for SMS/WhatsApp unless `urgent=true`.

**Templates:** stored as JSON per `(key, locale)`. Subject/body for email; single body for SMS/WhatsApp; title+body+data for FCM.

---

## 7. Offline support

### Admin portal
See [`02-admin-portal.md`](02-admin-portal.md) §10. Service-worker network-first caching of lists.

### Customer app
See [`03-customer-app-flutter.md`](03-customer-app-flutter.md) §6. Hive outbox + connectivity_plus sync.

---

## 8. File uploads & PDF invoices

### 8.1 File storage abstraction
Reference: `D:\kleo\kleo-backend-exp\service.config.json` — `"FileStorage": { "Provider": "AWS-S3" }`.

Adopt: `IFileStorage` interface with `upload(stream, key, contentType)`, `getSignedUrl(key, ttl)`, `delete(key)`. Implementations:
- `S3FileStorage` — production
- `LocalFileStorage` — dev (writes to `tmp/uploads`)

Use cases:
- Customer uploads of stained-garment photos (optional add-on, BRIEF doesn't strictly require)
- Admin uploads of vendor PO scans
- Invoice PDFs (next subsection)

### 8.2 PDF invoice rendering
**No reference exists in the repos.** Recommendation:
- Library: `pdfkit` (programmatic, fast, INR currency rendering works fine with the Devanagari font registered)
- Or HTML → PDF via `puppeteer` (`@sparticuz/chromium`) for richer designs — heavier, but matches "hi-fi" expectation
- Invoice generated **asynchronously** via BullMQ `invoices` queue (see `01-backend.md` §9)
- Stored at `s3://invoices/<tenantId>/<yyyy>/<mm>/<invoiceId>.pdf`
- Signed URL emailed/SMSed to customer (24-h TTL)

Required fields on the invoice:
- Header: "PT Kharade Drycleaners and Laundry", GSTIN (if registered), shop address, phone
- Customer/vendor block
- Itemised table: item, qty, rate, GST (if enabled), subtotal
- Surcharges (home delivery, express)
- Subscription discount line (if applicable)
- Total in **₹** + words ("Two thousand four hundred fifty rupees only")
- QR code linking to UPI VPA (handy for offline payment)
- Footer: T&Cs, support phone

---

## 9. Reports & charts

Reference: rean's `BarChart.svelte`, `PieChart.svelte`, `Line.svelte` wrapping Chart.js.

Phase-6 reports (BRIEF §6):
| Report                         | Chart type   | Data source                                         |
|--------------------------------|--------------|-----------------------------------------------------|
| Revenue by service type        | Stacked bar  | `orders.bills` aggregated by `serviceType`          |
| Orders by status (today)       | Donut        | `orders.orders` grouped by `status`                 |
| Daily order intake (30 d)      | Line         | `orders.orders` grouped by `date(createdAt)`        |
| Top 10 customers (revenue)     | Horizontal bar | join `orders` + `customers`                       |
| Vendor outstanding credit      | Table        | `customers` where `type=vendor` and `balance > 0`   |
| Payment method split           | Donut        | `payments.payments` grouped by `gateway`            |
| Subscription mix               | Donut        | `subscriptions.subscriptions` grouped by `planType` |
| On-time delivery rate          | KPI card     | `orders.orders` `deliveredAt - promisedAt` ≤ 0      |
| Pickup success rate            | KPI card     | `orders.orders` first-attempt success / total       |

All aggregation queries run server-side, cached in Redis 5 min, served via BFF. Export to CSV must be available on every chart page.

---

## 10. Multi-tenancy / multi-branch readiness (BRIEF §6 Phase 7)

Even though only one shop exists today, every business entity carries `tenantId` from day one (charqol pattern). Branch is **another column**, not another tenant:

```
Tenant       — PT Kharade Group of Industries  (1 row, ever)
└── Branch   — Mukundnagar shop                (1 row today; many later)
    └── Order, Bill, Customer, RateCard, ...
```

Queries always filter by `tenantId` (and `branchId` once introduced). `tenantId` is on the JWT; middleware enforces row-level visibility.

---

## 11. Observability

| Concern             | Tooling                                                                                          | Reference                                                                                       |
|---------------------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Logs                | **Structured JSON** with auto-injected correlation/user/tenant/route fields via `AsyncLocalStorage` | `D:\charqol\payroll-service\src\logger\structured.logger.ts` + `correlation.id.ts`              |
| Correlation IDs     | `X-Correlation-ID` header; auto-generated if missing; propagated to sister services              | Same files. See [`06-extended-patterns.md`](06-extended-patterns.md) §10                         |
| Metrics             | `prom-client` per service, scraped by Prometheus                                                 | not in references — add cleanly                                                                  |
| Traces              | **OpenTelemetry SDK + `@Trace('Controller.method')` decorator**; **Zipkin** exporter for phase 1 (self-host on the same VPS) | `D:\charqol\sales-service\src\api\lead\lead.controller.ts` uses `@Trace`; OTel deps in `D:\charqol\accounting-service\package.json`. Details in [`06-extended-patterns.md`](06-extended-patterns.md) §11 |
| Healthchecks        | `/health/status`, `/health/ready`                                                                | `D:\Rean\reancare-service\src\api\` (health endpoints)                                          |
| Error tracking      | Sentry (optional, phase 6)                                                                       | n/a                                                                                              |
| Uptime              | UptimeRobot / BetterStack (no infra effort)                                                      | n/a                                                                                              |

**Correlation ID propagation across services** — every Axios call between PT Kharade services must include `X-Correlation-ID: <id-from-current-context>`. Build it once into the inter-service HTTP client wrapper. Every Logger call automatically reads from `AsyncLocalStorage` so no manual passing is required inside a request.

---

## 12. Security checklist

1. **All inputs validated** — Joi (backend), Zod (BFF), Dart freezed `fromJson` (Flutter)
2. **JWT secret rotated** quarterly; refresh tokens single-use
3. **HTTPS only** — HSTS header from nginx
4. **Helmet** middleware in Express (rean uses it)
5. **CORS** allow-list (admin portal origin + Flutter web origin)
6. **CSRF protection** on cookie-authenticated SvelteKit form actions — SvelteKit's CSRF cookie check is on by default
7. **Rate-limits** on `/auth/*` endpoints — `express-rate-limit` 30 req/min/IP
8. **Webhook signatures** verified for both Razorpay and Zoho
9. **SQL injection** — TypeORM parameterised queries only; never string-concat
10. **Secrets** in `.env` (never committed); production secrets in VPS environment / Docker secrets
11. **Password hashing** — argon2id (rean uses bcrypt — argon2id is the 2024+ recommendation)
12. **PII minimisation** — phone numbers logged as `+91XXXXX1234` style; never log full OTPs

---

## 13. Data privacy & compliance (India context)

- **DPDP Act 2023** awareness: consent for marketing notifications must be explicit and revocable.
- **Subject access** — admin portal page lets a Receptionist or Admin export a customer's full data on request, and delete on request (subject to legal retention of invoices for 8 years per Indian Income Tax Act).
- **Retention defaults:**
  - Orders & invoices: 8 years (tax)
  - Audit log: 180 d hot + S3 archival
  - OTP / session: ≤ 1 h
  - Payment webhook events: 90 d
- **Customer marketing opt-in** stored on `user.consents` with timestamp.

---

## 13a. Discount engine

Adopt Batterlicious's `discounts` + `discount.usage` tables verbatim — they already cover coupon code, percent/flat type, minimum purchase, max discount cap, usage limit, validity window, vendor-specific. Full schema and composition rule (subscription discount → coupon → surcharges → GST) in [`06-extended-patterns.md`](06-extended-patterns.md) §5.

## 13b. Wallet — refunds + B2B credit (negative-floor pattern)

Customer wallet for refund credit; B2B vendor credit modelled as **a wallet with a negative floor** (`MinBalance = -CreditLimit`), so the same audited `wallet.transactions` table records both customer top-ups and vendor invoice charges. No separate credit-ledger needed. Full schema in [`06-extended-patterns.md`](06-extended-patterns.md) §6.

## 13c. Recurring billing (subscriptions)

A daily BullMQ job (`subscriptions-renew`, 02:00 IST) scans `RecurringInvoice WHERE NextInvoiceDate <= today AND IsActive`. For each it renders an invoice via the `InvoiceTemplate` (PaymentTermsDays, ShowTax, CurrencyCode, TaxCodeId on lines), charges Razorpay Subscriptions, emits `subscriptions.subscription.renewed`, advances `NextInvoiceDate`. Reference: `D:\charqol\accounting-service\src\api\recurring.invoice\`. Details in [`06-extended-patterns.md`](06-extended-patterns.md) §12.

## 13d. Multi-tenancy enforcement

Every business entity carries **`TenantId` + `BranchId`** (mirrors charqol's `OrganizationId` + `CompanyId`). Composite index on both. Single tenant / single branch today; the columns are non-null with defaults referencing seeded rows. Multi-branch in phase 7 = config flip + UI gate, not a migration. See [`06-extended-patterns.md`](06-extended-patterns.md) §9.

## 14. Indian context — must-haves for hi-fi UI (BRIEF §4)

- Names: realistic mix — Rohan Patil, Priya Deshmukh, Ajay Sharma, Anjali Joshi, Manjusha Kulkarni
- Phone format: `+91-XXXXXXXXXX` (10 digits after +91) — never show fewer digits; always +91
- Currency: `₹` prefix + Indian digit grouping (`₹1,25,000.00`) — use `Intl.NumberFormat('en-IN', { ... })` or Dart `NumberFormat.currency(locale: 'en_IN')`
- Date: `dd/MM/yyyy` by default; ISO in APIs
- Time zone: **Asia/Kolkata** everywhere; store UTC in DB, render in IST
- Addresses: Pune, Pimpri-Chinchwad, Maharashtra cities/pincodes for samples
- Marathi sample data in every mockup (BRIEF §4 emphasises this)
- Vendor names: "Hotel Sahyadri", "Surya Bedsheet Co.", "Apollo Hospital — Pune"

Use these realistic fixtures from the start — `seed.data/sample.customers.json`, `seed.data/sample.vendors.json`.

---

*Cross-cutting guide ends here. Continue with [`05-feature-map.md`](05-feature-map.md).*
