# PT Kharade Drycleaners — Implementation Guide

> Companion to [`BRIEF.md`](BRIEF.md). The BRIEF tells Claude **what** to build.
> This guide tells the engineers **how** to build it, by pointing at concrete,
> production-tested code in eight reference repositories you already own.
>
> **Audience:** the team (or Claude Code session) executing deliverables #1–#14
> in the BRIEF. Every claim below is anchored to a real file path on the dev
> workstation — open it, read it, copy the pattern.

---

## 1. How to read this guide

The BRIEF lists 14 deliverables. Most of them are built by re-applying patterns
the team has already shipped in the reference repos. This guide:

1. Catalogues the **reference repos** and what each is good for.
2. Splits the implementation into **five focused sub-guides** (see Section 4).
3. Maps every **BRIEF feature** to specific reference files (Section 5 of this
   index, expanded in `guide/05-feature-map.md`).
4. Calls out **the gaps** — places where no reference exists (mainly Flutter,
   Razorpay+Zoho dual gateway, Marathi i18n) — so you don't waste time looking.

**Rule of thumb:** before writing a new file, grep the reference repos for the
nearest analogue. Only diverge from the reference when the BRIEF demands it.

---

## 2. Reference repo catalogue

| Repo (Windows path)                              | Stack                            | Best used for                                                                                  |
|--------------------------------------------------|----------------------------------|------------------------------------------------------------------------------------------------|
| `D:\Rean\reancare-service`                       | Node 20 + TS + Express + Sequelize (TypeORM-shaped) + tsyringe DI | **The backend gold-standard.** Auth, RBAC, cron scheduler, multi-channel notifications, seed pipeline, config manager. Largest, most production-hardened. |
| `D:\Rean\admin-portal-v2`                        | SvelteKit 2 + Svelte 5 (runes) + Tailwind v4 + Vitest + Playwright | **SvelteKit gold-standard.** Hooks-based session auth, Zod form validation, theme selector, custom component library + Chart.js, flash messages. |
| `D:\charqol\*`  (8 services)                     | Node + TS + Express + TypeORM + Joi | **Microservices template.** Uniform `src/{api,auth,common,config,database,domain.types,events,logger,startup}` layout, **sister-service-api-keys** inter-service auth, pluggable event broker (Kafka/RabbitMQ/SQS/InMemory) with outbox pattern. |
| `D:\charqol\form-builder-ui`                     | SvelteKit 2 + Bits UI + Tailwind + superforms + Zod | **Modern Svelte UI library reference.** Bits UI + headless + superforms is the cleanest stack we have. |
| `D:\Batterlicious\batterlicious-service`         | Node + TS + Express + TypeORM    | **Order domain template.** Cart → Order → Payment → Delivery lifecycle with explicit **state machines** and status enums. Closest in shape to a laundry order. |
| `D:\Batterlicious\user-service`                  | Node + TS                        | **OTP+JWT identity service.** `OTPScope`, `OTPChannel`, `UserLoginMethod` enums; SystemAdmin/TenantAdmin/BaseUser role model. |
| `D:\Batterlicious\admin-portal`                  | SvelteKit                        | **Admin-portal layout for an order business.** `(auth)`, `(admin)` route groups; `x-components/<domain>/...` library; backend service wrappers. |
| `D:\Batterlicious\customer-app 2`                | **.NET MAUI** (XAML, C#)         | Customer-facing **page layout + flow**: Dashboard → Cart → ScheduleDelivery → ZohoPayment → MyOrders. **Reuse the IA, port the code to Flutter** (see Section 4.3). |
| `D:\kleo\kleo-backend-exp`                       | Node + TS + Express + TypeORM + Joi | **Best “database/typeorm/{models,mappers,services}” three-folder split.** Also: role/permission caching (`role.cache.ts`, `role.permissions.cache.ts`), client-app auth, Bruno collections fully fleshed. |
| `D:\kleo\kleo-ui`                                | SvelteKit + Tailwind + Zod + Svelte 5 | **Two-tier SvelteKit API client pattern**: `routes/api/server/<x>/+server.ts` (BFF) → `routes/api/services/<x>.ts` (HTTP wrapper). Plus theme store, PWA service worker, custom component library. |
| `D:\Amrutam\*`                                   | Docs only (multi-service hospital platform) | **Multi-role workflow design**: 10 roles, appointment-status lifecycle ≈ laundry intake-status lifecycle. Multi-language strings (Hindi/Kannada/English). BFF per role. |
| `D:\deft-dexterous`, `D:\Deft One`, `D:\Inflection-experiments` | Mixed — TS, .NET, SvelteKit, Socket.IO | **Real-time event streaming** patterns (Socket.IO room per entity) + diff/staging review pattern. Useful for live order-status updates in the customer app. |

> **What's missing from the references:** native Flutter code, Razorpay
> Node SDK integration, Marathi i18n, full BullMQ queue setup, PDF invoice
> generation. Those gaps are addressed explicitly in the relevant sub-guides
> with recommended libraries.

---

## 3. The “canonical stack” for PT Kharade

Cross-cutting decisions, justified against the reference repos:

| Decision                                | Choice                                                        | Anchor                                                                                   |
|-----------------------------------------|---------------------------------------------------------------|------------------------------------------------------------------------------------------|
| Backend folder layout                   | `src/{api,auth,common,config,database,domain.types,events,logger,modules,startup}` | Uniform across `charqol/user-service`, `charqol/accounting-service`, `kleo-backend-exp`. |
| Backend DI                              | `tsyringe` (`@injectable` / `@inject`)                        | `D:\Rean\reancare-service\src\startup\injector.ts` and database injector.                |
| HTTP request validation                 | **Joi** (backend) + **Zod** (SvelteKit edge + Flutter parse)  | Joi: `charqol`, `kleo`. Zod: `kleo-ui\src\lib\validation\`, `admin-portal-v2\src\lib\validation\`. |
| Response envelope                       | `ResponseHandler` with `{Status, Message, HttpCode, Data, Trace, Client, User, Context, Request, ClientIps, APIVersion, ServiceVersion}` | `D:\charqol\accounting-service\src\common\handlers\response.handler.ts`.                 |
| ORM                                     | **TypeORM** (BRIEF mandate)                                   | `D:\kleo\kleo-backend-exp\src\database\typeorm\` (best three-folder split).              |
| Inter-service auth                      | `x-api-key` header backed by `sister-service-api-keys.json`   | `D:\charqol\core-service\sister-service-api-keys.json` + `client.app.auth.middleware.ts`.|
| User auth                               | JWT access+refresh, OTP for login (SMS/Email)                 | Authenticator chain: `D:\Rean\reancare-service\src\auth\custom\`. OTP enums: `D:\Batterlicious\user-service\src\domain.types\users\user.enums.ts`. |
| RBAC                                    | Roles + permissions, **role-cache for performance**           | `D:\kleo\kleo-backend-exp\src\auth\role.cache.ts`, `role.permissions.cache.ts`.          |
| Background jobs                         | **BullMQ** (BRIEF mandate; references use `node-cron`)        | Reference cron schedule shape: `D:\Rean\reancare-service\seed.data\cron.schedules.json`. |
| Event bus (between services)            | Outbox + pluggable broker; start with `InMemory`, swap to Redis Streams / RabbitMQ when scaling | `D:\charqol\user-service\src\events\event.emitter.ts` + `brokers/*`.                     |
| Logger                                  | Single `Logger` class, ISO timestamps, JSON error formatting  | `D:\Rean\reancare-service\src\common\logger.ts`.                                         |
| Error type                              | `ApiError(httpCode, message, details?)`                       | `D:\Rean\reancare-service\src\common\api.error.ts`.                                      |
| Config                                  | `ConfigurationManager` static class; `service.config.json` + `process.env` overrides | `D:\charqol\payroll-service\src\config\configuration.manager.ts`.                        |
| Notifications                           | `ReminderSenderService`-style fan-out (SMS/Email/WhatsApp/FCM/Webhook) | `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts`.              |
| Payments                                | Razorpay (default) + Zoho Pay, **state machine** drives status | `D:\Batterlicious\batterlicious-service\src\state.machines\payment.state.ts`.            |
| API contract tooling                    | Bruno collections per service                                 | `D:\kleo\kleo-backend-exp\bruno\kleo.service\`.                                          |
| SvelteKit project skeleton              | adapter-node, Vite 6, Tailwind v4, eslint flat config         | `D:\Rean\admin-portal-v2\{svelte.config.js, vite.config.ts, eslint.config.js}`.          |
| SvelteKit API client                    | **Two-tier**: `routes/api/server/<x>/+server.ts` (BFF) → `routes/api/services/<x>/<x>.ts` (axios wrapper) | `D:\kleo\kleo-ui\src\routes\api\server\kleo\customers\+server.ts` + `src\routes\api\services\customers\customers.ts`. |
| SvelteKit auth                          | Session cookie → `hooks.server.ts` populates `event.locals.sessionUser` | `D:\Rean\admin-portal-v2\src\hooks.server.ts` + `D:\Batterlicious\admin-portal\src\hooks.server.ts`. |
| Forms & validation                      | Custom `validateFormData(formData, ZodSchema)` helper + flash messages | `D:\Rean\admin-portal-v2\src\lib\helper\validate.form.ts`.                               |
| Theming                                 | `theme` Svelte store + Tailwind `darkMode: 'class'` + theme tokens in `src/lib/themes/*.theme.ts` | `D:\Rean\admin-portal-v2\src\lib\themes\` (multi-theme) + `D:\kleo\kleo-ui\src\lib\stores\theme.ts`. |
| i18n (admin portal + Flutter app)       | **NOT present in references.** Recommended: `paraglide-js` (SvelteKit) and `flutter_localizations` + ARB files | See `guide/04-cross-cutting.md` §3.                                                       |
| Offline (admin portal)                  | Custom `registerServiceWorker.ts` + last-loaded-list cache    | `D:\kleo\kleo-ui\src\lib\utils\registerServiceWorker.ts`.                                |
| Offline (customer app)                  | Hive/Isar local store + sync queue                            | Adapt singleton-manager pattern from `D:\Batterlicious\customer-app 2\Services\CartManager.cs`. |
| Audit log                               | Per-action audit entries on order + pricing changes           | Pattern in `D:\kleo\kleo-backend-exp\src\database\typeorm\models\` (audit log entity); Amrutam docs. Separate from **customer-facing order activity** — see `06-extended-patterns.md` §20.|
| Idempotency                             | **DB-backed TypeORM table** (not Redis); `Idempotency-Key` header; replays cached response | `D:\charqol\payroll-service\src\common\idempotency\idempotency.middleware.ts`. See `06-extended-patterns.md` §7. |
| MFA (SystemAdmin only)                  | TOTP via QR code + 10 single-use backup codes                 | `D:\charqol\user-service\src\api\users\mfa\mfa.controller.ts`. See `06-extended-patterns.md` §8. |
| OAuth (optional customer login)         | Google / Facebook / etc. callback flow returning user + tokens | `D:\charqol\core-service\src\api\` `OAuthController`. See `06-extended-patterns.md` §8. |
| Correlation IDs                         | `X-Correlation-ID` header + `AsyncLocalStorage`; auto-logged in every line; propagated across `x-api-key` calls | `D:\charqol\payroll-service\src\logger\correlation.id.ts`. See `06-extended-patterns.md` §10. |
| Distributed tracing                     | OpenTelemetry SDK + `@Trace('Controller.method')` decorator   | `D:\charqol\sales-service\src\api\lead\lead.controller.ts` (`@Trace` usage); `D:\charqol\accounting-service\package.json` OTel deps. See `06-extended-patterns.md` §11. |
| Multi-tenancy                           | `OrganizationId` + `CompanyId` columns + composite index on every entity | `D:\charqol\core-service\src\` company/org models. See `06-extended-patterns.md` §9. |
| Subscriptions (pause/resume/DoW)        | Pause, resume, day-of-week mask, split wallet+gateway payment | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\subscription.entity.ts`. See `06-extended-patterns.md` §1. |
| Delivery domain (zones/hubs/partners/slots) | Eight-entity domain ready to lift                          | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\delivery.*` (zones, society, buildings, hub, partner, slot, charges, charge.rate). See `06-extended-patterns.md` §2. |
| Discount engine                         | Coupon / percent / flat / free-pickup with usage tracking     | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\discounts.entity.ts` + `discount.usage.entity.ts`. See `06-extended-patterns.md` §5. |
| Wallet / store credit / B2B credit floor| Top-up + redemption + B2B credit limit (as negative floor)    | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\wallet.entity.ts` + `wallet.transactions.entity.ts`. See `06-extended-patterns.md` §6. |
| Recurring invoices                      | Monthly/Quarterly/HalfYearly/Yearly, template-driven, tax-code-aware | `D:\charqol\accounting-service\src\api\recurring.invoice\` + `invoice.template.model.ts`. See `06-extended-patterns.md` §12. |
| Vendor settlements / payouts            | Settlement statement with TDS, adjustments, payouts to bank account | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\vendor.settlements.entity.ts` + `settlement.transactions.entity.ts` + `vendor.bank.accounts.entity.ts`. See `06-extended-patterns.md` §13. |
| Slot capacity + order cutoff            | `MaxOrders`/`CurrentOrders` per slot; per-product daily caps; cutoff times | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\delivery.slot.entity.ts` + `product.daily.capacity.entity.ts` + `order.cutoff.entity.ts`. See `06-extended-patterns.md` §4. |
| Processing batches (laundry wash cycles)| Group orders into shop-floor batches with progress           | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\preparation.batch.entity.ts` + `preparation.items.entity.ts`. See `06-extended-patterns.md` §3. |
| Print-friendly pages (invoice/label)    | SvelteKit `+page@.svelte` breakout layout                     | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\packaging\[orderId]\print-label\+page@.svelte`. See `06-extended-patterns.md` §16. |
| Testing                                 | Backend: **Vitest** (modern replacement for Mocha+Chai used in rean); SvelteKit: Vitest + Playwright (rean); Flutter: `flutter_test` + integration_test | Adopt rean's playwright setup wholesale: `D:\Rean\admin-portal-v2\playwright.config.ts`.  |
| Code style                              | ESLint flat config + Prettier + Tailwind+Svelte Prettier plugins | `D:\Rean\admin-portal-v2\eslint.config.js`; backend lint: `D:\Rean\reancare-service\.eslintrc.json`. |

---

## 4. Sub-guides (deep dives)

| File                                                     | Covers                                                                                       |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------|
| [`guide/01-backend.md`](guide/01-backend.md)             | Node/Express/TypeORM service skeleton, auth+RBAC, validators, cache, queue, notifications, payments, seeders, tests. |
| [`guide/02-admin-portal.md`](guide/02-admin-portal.md)   | SvelteKit 2 + Svelte 5 runes, routing, two-tier API client, session auth, forms, theming, component library, offline. |
| [`guide/03-customer-app-flutter.md`](guide/03-customer-app-flutter.md) | Flutter app shape, state mgmt, API client, OTP login, Razorpay/Zoho checkout, offline drafts, i18n, theming. |
| [`guide/04-cross-cutting.md`](guide/04-cross-cutting.md) | i18n (English + Marathi), theming spec, audit logging, OTP, payments (Razorpay + Zoho), notifications, offline, file uploads + PDF invoices, reports + charts. |
| [`guide/05-feature-map.md`](guide/05-feature-map.md)     | Master table: **every BRIEF section → reference files**. The quick-lookup index. |
| [`guide/06-extended-patterns.md`](guide/06-extended-patterns.md) | **Second-pass findings — read this when `01–05` says "build new".** Subscriptions with pause/resume, full delivery domain, idempotency (DB-backed, **corrects `01` §8**), MFA + OAuth, correlation IDs via AsyncLocalStorage, OpenTelemetry `@Trace()`, multi-tenancy (OrgId + CompanyId), recurring invoices, wallets, discounts, vendor settlements, preparation batches, slot capacity, product variants, full customer-app IA. |
| [`guide/07-database-design.md`](guide/07-database-design.md) | **Full physical schema (≈ 71 tables across 5 services)** — equivalent to BRIEF deliverable #2. Conventions, cross-service refs, shared infra. Per-service DDL + ER in `guide/db/01–05`. |
| [`guide/db/01-identity-schema.md`](guide/db/01-identity-schema.md) | identity-service tables (tenants, branches, users, OAuth, devices, MFA, roles/perms, customers, addresses, vendor banks, client_apps, audit). |
| [`guide/db/02-catalog-pricing-schema.md`](guide/db/02-catalog-pricing-schema.md) | catalog & pricing tables (service types, categories, items, variants, rate cards, vendor rate overrides, surcharges, tax codes, subscription plans, discounts). Includes BRIEF §2.3 seed. |
| [`guide/db/03-orders-schema.md`](guide/db/03-orders-schema.md) | orders, items, status history, activities, notes, reviews, subscriptions (pause/resume/DoW), preparation batches, slot capacity, full delivery domain. |
| [`guide/db/04-payments-schema.md`](guide/db/04-payments-schema.md) | bills, bill lines, recurring invoices, payments + state machine, payment events, refunds, webhook events, payment methods, wallets, wallet transactions, vendor settlements, payouts. |
| [`guide/db/05-notifications-schema.md`](guide/db/05-notifications-schema.md) | notification templates (en + mr), send attempts, user prefs, in-app inbox, contact-us, terms/policies, file resources. |

---

## 5. BRIEF feature → primary reference (one-line summary)

Use [`guide/05-feature-map.md`](guide/05-feature-map.md) for the deep version.

| BRIEF section                  | Primary reference                                                                              |
|--------------------------------|------------------------------------------------------------------------------------------------|
| 2.1 Roles (Admin / Recept / Cust) | `D:\Batterlicious\user-service\src\domain.types\authorization\enums.ts`                       |
| 2.2 Order lifecycle (statuses) | `D:\Batterlicious\batterlicious-service\src\domain.types\enums\order.status.enum.ts` + state machine |
| 2.2 Bill issuance & channels   | `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts` (multi-channel fan-out) |
| 2.2 Payments (Razorpay+Zoho)   | `D:\Batterlicious\batterlicious-service\src\state.machines\payment.state.ts` + `customer-app 2\Services\ZohoPaymentConfig.cs` |
| 2.3 Pricing (rate cards)       | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\` (product price model) + `kleo` master-data CRUD |
| 2.4 Subscriptions              | Build new (no direct ref) — model on `D:\charqol\accounting-service` recurring invoice + Razorpay Subscriptions API |
| 2.5 Redis cache                | `D:\kleo\kleo-backend-exp\src\auth\role.cache.ts` + Rean session manager                       |
| 2.5 BullMQ queues              | New (refs use `node-cron`). Schedule shape: `D:\Rean\reancare-service\seed.data\cron.schedules.json` |
| 2.5 Notifications              | `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts`                     |
| 2.5 i18n                       | **New build** — recommend `paraglide-js`; see `guide/04-cross-cutting.md` §3                   |
| 2.5 Theming                    | `D:\Rean\admin-portal-v2\src\lib\themes\` (aha/gmu/rean) + `D:\kleo\kleo-ui\src\lib\stores\theme.ts` |
| 2.5 Offline (admin)            | `D:\kleo\kleo-ui\src\lib\utils\registerServiceWorker.ts`                                       |
| 2.5 Offline (customer)         | New (Hive/Isar). Singleton state pattern: `D:\Batterlicious\customer-app 2\Services\CartManager.cs` |
| 2.5 Audit log                  | Pattern: `kleo` audit model + `charqol` event-store outbox                                     |
| 3. Service split (3–5)         | Folder pattern: `D:\charqol\<service>\src\`. Each service has `service.config.json`, identical skeleton. |
| 3. API gateway / BFF           | **No gateway in charqol/kleo.** SvelteKit `routes/api/server/+server.ts` *is* the BFF (kleo pattern). |
| 6. Phased roadmap              | Use Amrutam multi-service phasing as a sanity check on dependencies between services.          |

---

## 6. What to do first (recommended order, mirrors BRIEF §7)

1. **Read** [`guide/05-feature-map.md`](guide/05-feature-map.md) end-to-end (~15 min). It is the index of indices.
2. Open `D:\charqol\user-service\src\` and `D:\kleo\kleo-backend-exp\src\` side-by-side — internalise the uniform layout. Every new backend service will look like this.
3. Open `D:\Rean\admin-portal-v2\src\` and `D:\kleo\kleo-ui\src\` side-by-side — internalise the SvelteKit conventions.
4. Skim `D:\Batterlicious\batterlicious-service\src\api\order\` and `src\state.machines\payment.state.ts` — this is the closest analogue to a laundry order.
5. Then start BRIEF deliverable #1 (`./out/docs/01-architecture.md`). Service split should be argued **with reference to the charqol example** (5 services with sister-service-api-keys auth). Justify 3 vs 5 for our smaller scope.

---

## 7. Non-negotiable conventions (lifted from references, enforced here)

These come from the references and are repeated in every sub-guide. **Do not deviate without writing an ADR.**

1. **Folder layout (backend):** `src/api/<domain>/<domain>.{controller,routes,validator}.ts` + `src/database/typeorm/{models,mappers,services}/` + `src/auth/`, `src/common/`, `src/config/`, `src/events/`, `src/startup/`. (charqol + kleo)
2. **One Joi validator per endpoint** in `*.validator.ts`. Validation throws on first failure. (kleo, charqol)
3. **All HTTP responses go through `ResponseHandler.success(...)` or `.failure(...)`** — no raw `res.json` calls. (charqol)
4. **Every controller method is wrapped to forward errors to the global error middleware.** Custom `ApiError(code, msg, details)` is the only error type thrown from controllers/services. (rean)
5. **Auth chain order is fixed:** `contextSetter → clientAppAuth (x-api-key) → userAuthenticator (JWT) → userAuthorizer (RBAC)`. (charqol, rean)
6. **RBAC uses `context('Resource.Action')` per route**, e.g. `auth.handle({ context: 'Order.Create', ... })`. Permissions seeded from JSON. (rean — see `seed.data/role.privileges/`.)
7. **All inter-service HTTP calls carry `x-api-key`** registered in `sister-service-api-keys.json`. (charqol)
8. **Domain events** are written via the outbox pattern — persist `EventStore` row first, publish to broker, mark published. (charqol)
9. **TypeORM entity name and table:** UpperCamel class, `snake_case` table (`@Entity({ name: 'work_orders' })`). UUID primary key. (kleo)
10. **SvelteKit API access is two-tier:** Svelte pages call `/api/server/...` (SvelteKit endpoint, knows session); that endpoint calls a `services/*.ts` HTTP wrapper that hits the real backend. Never call backend from the browser directly. (kleo)
11. **Session lives in a cookie**, hydrated in `hooks.server.ts` into `event.locals.sessionUser`. (rean, batterlicious)
12. **Form errors flow through `sveltekit-flash-message`** — no ad-hoc error stores. (rean)
13. **Tailwind for layout, Bits UI for headless primitives, custom branded components for everything domain-specific.** (charqol form-builder-ui)
14. **`darkMode: 'class'`** on `<html>`, theme store persists to `localStorage`. (kleo)
15. **Backend log lines are ISO-timestamped JSON.** Errors logged via the central Logger only. (rean)

---

## 8. Open questions / decisions still needed

None of these block starting; capture answers as ADRs under `./out/docs/adr/` when made.

- **OD-1: 3 vs 5 microservices.** Recommend starting with 3 (`identity`, `orders+catalog`, `payments+notifications`) and splitting later. Single VPS makes 5 services premature.
- **OD-2: Event broker pick.** Default to charqol's `InMemory` broker for phase 1; switch to Redis Streams (already have Redis) in phase 4. RabbitMQ/Kafka not justified at PT Kharade volume.
- **OD-3: Razorpay vs Zoho Pay precedence.** BRIEF lists both. Recommend Razorpay primary (more common in India, larger SDK ecosystem) with Zoho as fallback/B2B-friendly option. State-machine handles both.
- **OD-4: i18n library.** `paraglide-js` recommended for SvelteKit (compile-time, type-safe). `flutter_localizations` + ARB files for Flutter. Marathi locale `mr_IN`.
- **OD-5: PDF invoice rendering.** Recommend `pdfkit` (Node) for programmatic invoices, or HTML→PDF via `puppeteer` if hi-fi receipts are needed. No reference in repos.
- **OD-6: BullMQ vs Redis Streams for queues.** BullMQ is BRIEF-mandated. Adopt directly.
- **OD-7: Order activity log vs admin audit log.** Two separate tables — one customer-facing (rendered in app order-tracking), one admin-facing (compliance). See `06-extended-patterns.md` §20.
- **OD-8: B2B vendor credit modelling.** Recommend modelling as a *negative wallet floor* (`Wallet.MinBalance = -CreditLimit`) rather than a separate credit-ledger table. Reuses the audited `wallet.transactions` movement log. See `06-extended-patterns.md` §6.

---

*Generated 2026-05-14. Anchored to repo states at the time of the survey. If a referenced file has moved, search by basename — the conventions are stable.*
