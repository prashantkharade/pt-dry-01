# Feature Map — BRIEF section → reference files

> The quick-lookup index. Find the BRIEF section you're working on; the table
> tells you exactly which reference files to open. Every path is absolute
> Windows-style and was confirmed by survey.
>
> Symbols:
> - **★** = best primary reference (open first)
> - **○** = useful secondary
> - **✎** = no direct reference — build new (link to guidance)
> - **[06]** = second-pass finding — see [`06-extended-patterns.md`](06-extended-patterns.md) for the section number

> **Many rows below have been upgraded from ✎ to ★ after the second-pass
> deep-dive.** Subscriptions, delivery management, discounts, wallets, recurring
> invoices, MFA, OAuth, correlation IDs, and OpenTelemetry now have concrete
> reference files. The full corrections list is in [`06-extended-patterns.md`](06-extended-patterns.md) §24.

---

## BRIEF §1 — Business Context

Indian SMB context, multi-role workflow, customer + vendor split.

| Concern                              | Anchor                                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| Multi-role workflow design (★)       | Amrutam docs: `D:\Amrutam\Hospital Operations & Patient Workflow Documentation\` — 10 roles, role-specific BFFs |
| Indian-context sample data (★)       | `D:\Batterlicious\batterlicious-service\src\database\seeders\seed.data.json` (Pune vendor, Indian product names) |
| Customer vs vendor as sub-type (★)   | `D:\charqol\accounting-service\src\database\models\customer.model.ts` (customer with `CustomerType` enum, credit limit) |

---

## BRIEF §2.1 — Roles (System Admin, Receptionist, Customer)

| Concern                              | Anchor                                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| Role enums (★)                        | `D:\Batterlicious\user-service\src\domain.types\authorization\enums.ts` — `DefaultRoleTypes`, `PermissionScope` |
| Permission tuples (`Resource.Action`) | `D:\Rean\reancare-service\src\auth\auth.types.ts` + `seed.data\role.privileges\` (per-role JSON files)  |
| RBAC middleware chain (★)             | `D:\charqol\user-service\src\auth\user.auth\user.auth.handler.ts`                                       |
| Role permission cache (○)             | `D:\kleo\kleo-backend-exp\src\auth\role.cache.ts`, `role.permissions.cache.ts`                          |
| Vendor as customer flag               | `D:\charqol\accounting-service\src\database\models\customer.model.ts` (`CustomerType`, `CreditLimit`)   |

---

## BRIEF §2.2 — Order Lifecycle

| Concern                                                                       | Anchor                                                                                                  |
|-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Service-type enum (DryClean / Laundry / PressOnly) ✎                          | Model on Batterlicious's per-product `Category` enum                                                    |
| Order entity (★)                                                               | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\order.entity.ts`                    |
| Order status enum + lifecycle (★)                                              | `D:\Batterlicious\batterlicious-service\src\domain.types\enums\order.status.enum.ts`                    |
| Status state machine                                                           | `D:\Batterlicious\batterlicious-service\src\state.machines\` (payment state machine — adapt for order)  |
| Cart → order flow (○)                                                          | `D:\Batterlicious\batterlicious-service\src\api\cart\cart.controller.ts`                                |
| Order controller / routes / validator                                          | `D:\Batterlicious\batterlicious-service\src\api\order\` (controller, routes, validator)                 |
| Walk-in vs home-pickup channels ✎                                              | Add `OrderChannel` enum `{ WalkIn, HomePickup, DropAtShop }`                                            |
| Bill issuance (customer vs vendor toggle) ✎                                    | Add `BilledTo` enum on `Order`; reference invoice patterns in `D:\charqol\accounting-service\src\api\invoice\` |
| Bill delivery channels (SMS, WhatsApp, Email, in-app) (★)                       | `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts`                              |
| Payments (Razorpay + Zoho + COD) (★)                                            | See BRIEF §2.5 row, plus payment state machine: `D:\Batterlicious\batterlicious-service\src\state.machines\payment.state.ts` |

---

## BRIEF §2.3 — Pricing / Rate Cards

| Concern                              | Anchor                                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| Item master                          | `D:\Batterlicious\batterlicious-service\src\api\category\` + `src\database\typeorm\models\` (product/category) |
| Rate-card entity ✎                    | Build a `RateCard` aggregate with `(ItemId, ServiceType, Rate, Currency, EffectiveFrom)` lines; model after Batterlicious product+price |
| Vendor-specific rates ✎               | Reference: charqol `customer.model.ts` `CreditLimit` field; add a `VendorRateOverride` table            |
| Home-delivery surcharge ✎             | Charge config in `service.config.json`; modeled per BRIEF §2.3 defaults                                 |
| Express surcharge % ✎                 | Same as above                                                                                            |
| GST schema (forward-compatible) ✎     | Add `gstPercent`, `gstAmount` columns on `BillLine`; toggle from admin                                  |
| Seeders from BRIEF §2.3 tables (★)    | `D:\Rean\reancare-service\src\startup\seeder.ts` (pattern) + BRIEF deliverable #14 `rates.seed.ts`      |

---

## BRIEF §2.4 — Subscriptions / Schemes

| Concern                              | Anchor                                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| Plan entity (monthly/quarterly/half-yearly/yearly) (★ [06] §1) | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\subscription.entity.ts` + `subscription.item.entity.ts` |
| Subscription pause / resume / DoW (★ [06] §1) | Same — Status, PausedAt, ResumedAt, TotalPausedDays, SelectedDays[]                            |
| Split-payment (wallet + gateway) (★ [06] §1)  | Same — WalletPaidAmount + GatewayPaidAmount = TotalAmount                                       |
| Recurring invoice / renewal (★ [06] §12)      | `D:\charqol\accounting-service\src\api\recurring.invoice\` + `invoice.template.model.ts`        |
| Invoice template (PaymentTerms, GST) (★ [06] §12) | `D:\charqol\accounting-service\src\database\models\invoice.template.model.ts`               |
| Discount engine (★ [06] §5)           | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\discounts.entity.ts` + `discount.usage.entity.ts` |
| Customer vs vendor plan separation    | `D:\charqol\accounting-service\src\api\invoice\` distinguishes customer vs vendor invoices             |
| Free-pickup-per-month entitlement ✎   | Build new — `Subscription.benefits` or use `DiscountType = FreePickup` ([06] §5)                        |
| Razorpay Subscriptions ✎              | Razorpay docs; no in-repo SDK reference. Webhook handler pattern: §5                                     |
| Renewal BullMQ job                    | Catalogue: `D:\Rean\reancare-service\seed.data\cron.schedules.json` (shape) → run via BullMQ. Charqol also has node-cron in `accounting-service\src\startup\scheduler.ts` ([06] §18) |

---

## BRIEF §2.5 — Cross-cutting (cache, jobs, notifications, i18n, theming, offline, audit)

| Concern                              | Anchor                                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| **Redis cache** — sessions (★)        | `D:\Rean\admin-portal-v2\src\routes\api\cache\session\session.manager.ts`                              |
| Redis cache — role perms (○)          | `D:\kleo\kleo-backend-exp\src\auth\role.cache.ts`                                                       |
| Redis cache — OTP                     | New; pattern in [`04-cross-cutting.md`](04-cross-cutting.md) §2                                         |
| Redis cache — rate cards              | New; key shape in [`01-backend.md`](01-backend.md) §8                                                   |
| **Idempotency — DB-backed, not Redis** (★ [06] §7) | `D:\charqol\payroll-service\src\common\idempotency\idempotency.middleware.ts`                  |
| **BullMQ queues** ✎                   | Reference for *job catalogue* shape: `D:\Rean\reancare-service\seed.data\cron.schedules.json` + `D:\charqol\accounting-service\src\startup\scheduler.ts`; runtime is BullMQ (no in-repo example) |
| **Notifications** (SMS/Email/WhatsApp/FCM/In-app) (★) | `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts`                              |
| Notification template seed (○)        | rean's seed-driven templates; mirror with `seed.data/notification.templates/<key>.<lang>.json`         |
| **i18n** (English + Marathi) ✎        | None of the references implement i18n. Use `paraglide-js` (SvelteKit), `flutter_localizations` (Flutter). See [`04-cross-cutting.md`](04-cross-cutting.md) §3 |
| **Theming** — user-configurable (★)   | `D:\Rean\admin-portal-v2\src\lib\themes\` (multi-theme) + `D:\kleo\kleo-ui\src\lib\stores\theme.ts`     |
| Theme — Tailwind `darkMode: 'class'`  | `D:\kleo\kleo-ui\tailwind.config.js`                                                                    |
| **Offline (admin portal)** (★)        | `D:\kleo\kleo-ui\src\lib\utils\registerServiceWorker.ts`                                                |
| Offline indicator widget (○)          | `D:\kleo\kleo-ui\src\lib\components\OfflineIndicator.svelte`                                            |
| **Offline (Flutter)** ✎               | Build with Hive + connectivity_plus; see [`03-customer-app-flutter.md`](03-customer-app-flutter.md) §6 |
| **Audit log** (admin actions) (★)     | Schema in [`04-cross-cutting.md`](04-cross-cutting.md) §1; concept anchor in kleo audit model           |
| **Order activity log** (customer-facing timeline) (★ [06] §20) | Pattern: `D:\charqol\sales-service\src\api\activity\activity.controller.ts` — separate from admin audit log |
| **Correlation IDs + structured logger** (★ [06] §10) | `D:\charqol\payroll-service\src\logger\structured.logger.ts` + `correlation.id.ts` (AsyncLocalStorage)  |
| **OpenTelemetry `@Trace`** (★ [06] §11) | `D:\charqol\sales-service\src\api\lead\lead.controller.ts` for decorator; OTel deps in `D:\charqol\accounting-service\package.json` |
| **Multi-tenancy** (TenantId + BranchId composite) (★ [06] §9) | `D:\charqol\core-service\src\` company/org models                                       |
| **MFA (TOTP + backup codes)** (★ [06] §8) | `D:\charqol\user-service\src\api\users\mfa\mfa.controller.ts`                                          |
| **OAuth (Google)** (★ [06] §8)        | `D:\charqol\core-service\src\api\` `OAuthController`                                                    |
| **Device tracking + active sessions** (★ [06] §8) | `D:\charqol\core-service\src\api\users\device.details\user.device.details.controller.ts`     |
| **Delivery management** (zones/hubs/partners/slots/charges) (★ [06] §2) | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\delivery.*`     |
| **Slot capacity + order cutoff** (★ [06] §4) | `delivery.slot.entity.ts` + `product.daily.capacity.entity.ts` + `order.cutoff.entity.ts`         |
| **Processing batches** (laundry wash cycles) (★ [06] §3) | `preparation.batch.entity.ts` + `preparation.items.entity.ts`                            |
| **Wallet / store credit / B2B credit floor** (★ [06] §6) | `wallet.entity.ts` + `wallet.transactions.entity.ts`                                      |
| **Discount engine + usage tracking** (★ [06] §5) | `discounts.entity.ts` + `discount.usage.entity.ts`                                                |
| **Vendor settlements / payouts** (★ [06] §13) | `vendor.settlements.entity.ts` + `settlement.transactions.entity.ts` + `vendor.bank.accounts.entity.ts` |
| **Product variants** (size/fabric) (★ [06] §14) | `product.variants.entity.ts`                                                                    |
| **Address with Indian conventions** (★ [06] §14) | `address.entity.ts` — Society/Flat/Building/Landmark + Lat/Long                                |
| **Print-friendly pages** (★ [06] §16) | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\packaging\[orderId]\print-label\+page@.svelte` |
| **Customer-app: wallet/review/support/track** (★ [06] §15) | MAUI pages under `D:\Batterlicious\customer-app 2\Views\` (BLWallet, Review, ContactUs, TrackOrder) |

---

## BRIEF §3 — Tech Stack

| Concern                                          | Anchor                                                                                                  |
|--------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Service split (3–5) — uniform skeleton (★)        | `D:\charqol\<any-service>\src\` — identical layout across 5 services                                    |
| Inter-service auth (`x-api-key`) (★)              | `D:\charqol\core-service\sister-service-api-keys.json` + `D:\charqol\user-service\src\auth\client.app.auth\client.app.auth.middleware.ts` |
| Standard response envelope (★)                    | `D:\charqol\accounting-service\src\common\handlers\response.handler.ts`                                 |
| Event broker (Kafka/RabbitMQ/SQS/InMemory) (★)    | `D:\charqol\user-service\src\events\event.emitter.ts` + `src\events\brokers\`                           |
| Logger + ApiError + Configuration Manager (★)     | `D:\Rean\reancare-service\src\common\{logger.ts,api.error.ts}` + `D:\charqol\payroll-service\src\config\configuration.manager.ts` |
| TypeORM 3-folder split (★)                        | `D:\kleo\kleo-backend-exp\src\database\typeorm\{models,mappers,services}\`                              |
| Admin portal — SvelteKit 2 + Svelte 5 runes (★)   | `D:\Rean\admin-portal-v2\` (whole)                                                                       |
| Admin portal — two-tier API client (★)            | `D:\kleo\kleo-ui\src\routes\api\{server,services}\`                                                     |
| Admin portal — modern Svelte UI stack (Bits UI + superforms) (○) | `D:\charqol\form-builder-ui\package.json`                                                |
| Flutter app ✎                                     | No in-repo reference. Use [`03-customer-app-flutter.md`](03-customer-app-flutter.md).                  |
| Razorpay ✎                                        | No in-repo SDK example. Use razorpay npm package + state machine from Batterlicious                     |
| Zoho Pay (○)                                       | `D:\Batterlicious\customer-app 2\Services\ZohoPaymentConfig.cs` — auth config shape only                |
| Docker + entrypoint + healthcheck                 | `D:\kleo\kleo-backend-exp\{Dockerfile,entrypoint.sh}`                                                   |

---

## BRIEF §4 — Quality Bar (hi-fi UI, Indian samples)

| Concern                              | Anchor                                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| Tailwind palette (laundry blues/mint) | `D:\kleo\kleo-ui\tailwind.config.js` (primary/secondary/neutral) — recolour to BRIEF palette          |
| Loading skeletons                    | Build with Tailwind `animate-pulse` (admin) or `shimmer` (Flutter) — both first-class                  |
| Toast notifications                  | `D:\Rean\admin-portal-v2\src\lib\components\toast\toast.store.ts`                                       |
| Empty states                         | Custom; no direct reference. Use Tailwind cards w/ illustration + CTA                                  |
| Modals                               | `D:\Rean\admin-portal-v2\src\lib\components\confirm.modal.svelte`                                       |
| Charts (Chart.js wrappers) (★)        | `D:\Rean\admin-portal-v2\src\lib\components\` — `BarChart.svelte`, `PieChart.svelte`, `Line.svelte`     |
| Status badges                        | `D:\kleo\kleo-ui\src\lib\components\` `StatusBadge.svelte`                                              |
| Indian sample data                   | `D:\Batterlicious\batterlicious-service\src\database\seeders\seed.data.json` (Pune vendor)              |

---

## BRIEF §5 — Output conventions

Output paths under `./out/` — no reference needed (BRIEF is canonical). Use python-docx for `.docx` (BRIEF §5 explicit). Mermaid diagrams: GitHub renders natively; use sequence + ER liberally.

---

## BRIEF §6 — Phased Roadmap

| Phase | Anchor / approach                                                                                       |
|-------|---------------------------------------------------------------------------------------------------------|
| 1 — Foundations + Auth + Master Data | Copy charqol/user-service skeleton; copy rean admin login + hooks.server.ts; seed roles                 |
| 2 — Order intake + Billing + Status  | Adapt Batterlicious order entity + state enum; build receptionist intake page (admin portal)            |
| 3 — Customer app MVP                  | Build Flutter scaffold + booking flow mirroring `D:\Batterlicious\customer-app 2\Views\`                |
| 4 — Payments + Notifications          | Razorpay + Zoho gateway adapters; wire `reminder.sender.service.ts` pattern via BullMQ                  |
| 5 — Subscriptions + Vendor B2B        | Build subscription aggregate; vendor flag on customer; Razorpay Subscriptions; vendor rates             |
| 6 — Offline + Marathi i18n + Theming  | Service worker (kleo); paraglide-js (admin); flutter_localizations (Flutter); theme tokens              |
| 7 — Hardening + analytics + multi-branch | Add `branchId` column; OpenTelemetry; Sentry; perf budgets                                            |

---

## BRIEF §7 — Deliverables, mapped to references

### #1 Architecture overview
- Service split argument: cite `D:\charqol\<services>\src\` uniformity, `sister-service-api-keys.json` for inter-service
- Data-flow diagram: standard 3-tier (Flutter/SvelteKit → BFF → microservices → PG + Redis)
- Infra: single VPS phase 1 → managed K8s phase 7 (BRIEF §3)

### #2 Data model
- Identity: clone shape of `D:\charqol\user-service\` entities
- Catalog & pricing: model after `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\` (product, price)
- Orders: `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\order.entity.ts`
- Payments: `D:\Batterlicious\batterlicious-service\src\state.machines\payment.state.ts`
- Subscriptions ✎ — build new
- Notifications: rean reminder & notification entities
- Audit: schema in [`04-cross-cutting.md`](04-cross-cutting.md) §1

### #3 API + workflow doc
- REST endpoint listing: mirror `D:\kleo\kleo-backend-exp\bruno\kleo.service\` folder grouping
- RBAC matrix per endpoint: rean's `seed.data\role.privileges\` JSON files
- Sequence diagrams: write fresh mermaid; reference event flow in `D:\charqol\user-service\src\events\event.emitter.ts`

### #4 / #5 Phased plans (Premium / Medium)
- Estimate base: count `src/api/*` controllers per service in charqol or kleo to size effort
- Real Indian 2026 rates — research per BRIEF, no reference

### #6 Backend implementation prompt
- Build from [`01-backend.md`](01-backend.md) (this guide)
- Cite `D:\Rean\reancare-service\` and `D:\charqol\user-service\` as canonical examples

### #7 Frontend (SvelteKit) implementation prompt
- Build from [`02-admin-portal.md`](02-admin-portal.md)
- Cite `D:\Rean\admin-portal-v2\` and `D:\kleo\kleo-ui\` as canonical examples

### #8 Flutter app implementation prompt
- Build from [`03-customer-app-flutter.md`](03-customer-app-flutter.md)
- Cite `D:\Batterlicious\customer-app 2\` for **IA + flows only** (port C# to Dart)

### #9 / #10 Proposals (`.docx` via python-docx)
- BRIEF mandate — actually generate the file. No reference repo.

### #11 Receptionist UI mockups (HTML hi-fi)
| Screen                  | Reference                                                                                  |
|-------------------------|--------------------------------------------------------------------------------------------|
| Login                   | rean signin flash-message pattern                                                          |
| Dashboard               | rean dashboard layout + Chart.js                                                           |
| New order intake        | Batterlicious cart + order create; rean form layout                                        |
| Bill preview            | charqol invoice page (closest analogue): `D:\charqol\accounting-service\src\api\invoice\`  |
| Order list              | Batterlicious `OrderTable.svelte`                                                          |
| Order detail            | rean detail pages with side panels                                                          |
| Status update modal     | rean `confirm.modal.svelte`                                                                 |
| Customer search         | kleo customer list page + Batterlicious lookup                                              |

### #12 Admin (System Admin) UI mockups
| Screen                  | Reference                                                                                  |
|-------------------------|--------------------------------------------------------------------------------------------|
| Users & roles           | rean users + role pages                                                                    |
| Rate-card editor        | kleo master-data CRUD: `D:\kleo\kleo-ui\src\routes\(app)\kleo\master-data\machines\+page.svelte` (page shape) |
| Subscription plans      | New layout; model on charqol invoice list                                                  |
| Vendor management       | charqol customer/vendor screens (form-builder-ui will guide form patterns)                 |
| Reports (charts)        | rean BarChart / PieChart pages                                                              |
| Audit log               | New; tabular with diff viewer                                                              |
| Settings (theming/i18n) | rean theme.selector.ts; new i18n picker                                                   |

### #13 Customer app screens
| Screen                  | Reference                                                                                  |
|-------------------------|--------------------------------------------------------------------------------------------|
| Splash                  | Standard Flutter                                                                            |
| Login / OTP             | New (Flutter)                                                                              |
| Home                    | `D:\Batterlicious\customer-app 2\Views\DashboardPage.xaml`                                  |
| Service catalog         | `D:\Batterlicious\customer-app 2\Views\DashboardPage.xaml`                                  |
| Booking flow            | `D:\Batterlicious\customer-app 2\Views\{CartPage.xaml, ScheduleDeliveryPage.xaml}`          |
| Razorpay checkout (mock)| razorpay_flutter sample integration                                                         |
| Order tracking          | `D:\Batterlicious\customer-app 2\Views\MyOrdersPage.xaml` + OrderDetailsPage                |
| Profile                 | Standard                                                                                    |
| Subscriptions           | New                                                                                         |
| Settings (lang + theme) | New                                                                                         |

### #14 Seed data file (`rates.seed.ts`)
- TypeORM seeder pattern: `D:\Rean\reancare-service\src\startup\seeder.ts`
- Insert rates from BRIEF §2.3 verbatim (Dry-clean and Press-only). Author the Laundry rate schedule per BRIEF §2.3 ("you choose; flag clearly in data-model doc")
- Include vendor rates (bedsheet, pillow cover, curtain, sofa cover)

---

## BRIEF §8 — Rules of Engagement (process, not features)

No code reference needed — this is workflow discipline.

---

## Reverse map — "I'm in file X, what BRIEF section does it serve?"

| File                                                                                            | BRIEF section                                       |
|-------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts`                      | §2.2 bill delivery, §2.5 notifications              |
| `D:\Rean\reancare-service\src\auth\custom\*`                                                    | §2.1 roles, §2.5 audit, §3 auth                     |
| `D:\Rean\reancare-service\src\common\logger.ts`                                                 | §3 logger convention                                |
| `D:\Rean\reancare-service\src\common\api.error.ts`                                              | §3 error handling                                   |
| `D:\Rean\reancare-service\src\startup\seeder.ts`                                                | §2.3 seeded rate cards, #14 deliverable             |
| `D:\Rean\reancare-service\seed.data\role.privileges\`                                           | §2.1 RBAC seeding                                   |
| `D:\Rean\reancare-service\seed.data\cron.schedules.json`                                        | §2.5 BullMQ job catalogue (shape)                   |
| `D:\Rean\admin-portal-v2\svelte.config.js`, `vite.config.ts`, `eslint.config.js`                | §3 SvelteKit project skeleton                       |
| `D:\Rean\admin-portal-v2\src\hooks.server.ts`                                                   | §3 session auth                                     |
| `D:\Rean\admin-portal-v2\src\lib\components\home\Sidebar.svelte`                                | §3 Svelte 5 runes                                   |
| `D:\Rean\admin-portal-v2\src\lib\themes\*`                                                      | §2.5 theming                                        |
| `D:\Rean\admin-portal-v2\src\lib\components\toast\toast.store.ts`                               | §4 toasts (hi-fi)                                   |
| `D:\charqol\core-service\sister-service-api-keys.json`                                          | §3 inter-service auth                               |
| `D:\charqol\user-service\src\auth\user.auth\user.auth.handler.ts`                               | §2.1 RBAC, §3 auth middleware chain                 |
| `D:\charqol\user-service\src\events\event.emitter.ts`                                           | §3 domain events                                    |
| `D:\charqol\accounting-service\src\common\handlers\response.handler.ts`                         | §3 standard response envelope                       |
| `D:\charqol\accounting-service\src\database\models\customer.model.ts`                           | §2.1 customer+vendor, §3 entity convention          |
| `D:\charqol\form-builder-ui\package.json`                                                       | §3 Bits UI + superforms stack                       |
| `D:\Batterlicious\batterlicious-service\src\api\order\*`                                        | §2.2 order intake                                   |
| `D:\Batterlicious\batterlicious-service\src\domain.types\enums\order.status.enum.ts`            | §2.2 statuses                                       |
| `D:\Batterlicious\batterlicious-service\src\state.machines\payment.state.ts`                    | §2.2 payments, §2.5 reconciliation                  |
| `D:\Batterlicious\user-service\src\domain.types\users\user.enums.ts`                            | §2.1 OTP / login methods                            |
| `D:\Batterlicious\admin-portal\src\lib\x-components\`                                           | §4 hi-fi component library                          |
| `D:\Batterlicious\customer-app 2\Views\*.xaml`                                                  | §2.2 booking flow IA, #13 customer screens          |
| `D:\Batterlicious\customer-app 2\PERFORMANCE_OPTIMIZATIONS.md`                                  | §3 Flutter perf checklist (port)                    |
| `D:\kleo\kleo-backend-exp\src\database\typeorm\models\*`                                        | §3 entity conventions                               |
| `D:\kleo\kleo-backend-exp\src\auth\role.cache.ts`                                               | §2.5 cache (RBAC)                                   |
| `D:\kleo\kleo-backend-exp\bruno\kleo.service\`                                                  | §3 API contract testing                              |
| `D:\kleo\kleo-ui\src\routes\api\{server,services}\`                                             | §3 two-tier API client                              |
| `D:\kleo\kleo-ui\src\lib\stores\theme.ts`                                                       | §2.5 theming store                                  |
| `D:\kleo\kleo-ui\src\lib\utils\registerServiceWorker.ts`                                        | §2.5 offline (admin)                                |
| `D:\Amrutam\Hospital Operations & Patient Workflow Documentation\*`                             | §2.1 multi-role workflow design                     |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\subscription.entity.ts`     | §2.4 subscriptions (pause/resume/DoW) [06] §1       |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\delivery.*`                 | §2.2 home pickup/delivery domain [06] §2            |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\preparation.batch.entity.ts`| §2.2 in-shop wash batches [06] §3                   |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\product.daily.capacity.entity.ts` + `order.cutoff.entity.ts` | §2.2 slot capacity + cutoff [06] §4|
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\discounts.entity.ts`        | §2.4 plan discounts + coupons [06] §5               |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\wallet.entity.ts`           | §2.4 wallet, §2.1 B2B credit floor [06] §6          |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\vendor.settlements.entity.ts` | §2.1 vendor B2B settlements/payouts [06] §13     |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\address.entity.ts`          | §2.2 home pickup address (Indian conventions) [06] §14 |
| `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\product.variants.entity.ts` | §2.3 vendor item variants (bedsheet sizes) [06] §14 |
| `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\packaging\[orderId]\print-label\+page@.svelte` | §4 hi-fi print pages [06] §16    |
| `D:\Batterlicious\customer-app 2\Views\{BLWalletPage,ReviewPage,ContactUsPage,TrackOrderPage}.xaml` | #13 customer screens (wallet/review/support/track) [06] §15 |
| `D:\charqol\payroll-service\src\common\idempotency\idempotency.middleware.ts`                   | §2.5 idempotent retries (DB-backed) [06] §7         |
| `D:\charqol\user-service\src\api\users\mfa\mfa.controller.ts`                                   | §2.1 MFA for SystemAdmin [06] §8                    |
| `D:\charqol\core-service\src\api\` `OAuthController`                                            | §2.1 Google OAuth for customer login [06] §8        |
| `D:\charqol\payroll-service\src\logger\correlation.id.ts`                                       | §2.5 correlation IDs + structured logging [06] §10  |
| `D:\charqol\sales-service\src\api\lead\lead.controller.ts` (`@Trace` usage)                     | §3 distributed tracing [06] §11                     |
| `D:\charqol\accounting-service\src\api\recurring.invoice\`                                      | §2.4 recurring invoices [06] §12                    |
| `D:\charqol\accounting-service\src\database\models\invoice.template.model.ts`                   | §2.4 invoice template + GST tax codes [06] §12      |
| `D:\charqol\sales-service\src\api\activity\activity.controller.ts`                              | §2.2 customer-facing order activity timeline [06] §20 |

---

*End of feature map. Return to [`../IMPLEMENTATION-GUIDE.md`](../IMPLEMENTATION-GUIDE.md) for the overview.*
