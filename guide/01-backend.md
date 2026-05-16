# Backend Implementation Guide

> Companion to [`../IMPLEMENTATION-GUIDE.md`](../IMPLEMENTATION-GUIDE.md). Covers
> the **Node.js + TypeScript + Express + TypeORM + Redis** backend exactly as
> mandated by [`../BRIEF.md`](../BRIEF.md) §3.
>
> Stack-of-record references: **`D:\Rean\reancare-service`** (auth, scheduler, notifications, seeders), **`D:\charqol\*`** (microservice split, inter-service auth, event bus), **`D:\kleo\kleo-backend-exp`** (TypeORM 3-folder split, role cache, Bruno), **`D:\Batterlicious\batterlicious-service`** (order/payment state machines).

---

## 1. Service split (BRIEF §3 — “3–5 max”)

**Recommendation:** 3 services for phases 1–3, split to 5 once volume justifies it.

| Phase 1–3 (3 services)                              | Splits in phase 4+ (becomes 5) |
|-----------------------------------------------------|--------------------------------|
| `identity-service` — users, customers, vendors, RBAC, OTP, sessions | unchanged                      |
| `orders-service` — catalog/rates, orders, bills, status, deliveries, audit log | → `catalog-pricing-service` + `orders-service` |
| `notifications-service` — SMS/email/WhatsApp/FCM, templates, webhooks (Razorpay, Zoho) | → `notifications-service` + `payments-service` |

**Anchors for this decision:**
- Uniform layout per service: see all of `D:\charqol\user-service\src\`, `D:\charqol\accounting-service\src\`, `D:\charqol\payroll-service\src\` — they are identical in shape.
- Charqol uses 8 services for a far larger domain. 3 is appropriate at PT Kharade volume.
- For each service produce its own `Dockerfile`, `service.config.json`, `entrypoint.sh` — mirror `D:\charqol\user-service\` top level.

---

## 2. Folder skeleton (per service)

Copy this exact tree. Confirmed identical in `charqol/user-service`, `charqol/accounting-service`, `kleo-backend-exp`:

```
<service>/
├── Dockerfile                       ← copy from D:\kleo\kleo-backend-exp\Dockerfile
├── entrypoint.sh                    ← copy from charqol or kleo
├── service.config.json              ← shape below
├── tsconfig.json                    ← copy from D:\kleo\kleo-backend-exp\tsconfig.json
├── package.json
├── seed.data/                       ← JSON fixtures (role privileges, rate cards, etc.)
├── bruno/                           ← per D:\kleo\kleo-backend-exp\bruno\kleo.service\
├── tests/
└── src/
    ├── app.ts                       ← rean pattern: D:\Rean\reancare-service\src\app.ts
    ├── index.ts                     ← entry; loads dotenv, bootstraps Application
    ├── api/
    │   └── <domain>/                ← e.g. order/, customer/, rate-card/
    │       ├── <domain>.controller.ts
    │       ├── <domain>.routes.ts
    │       ├── <domain>.validator.ts
    │       └── <domain>.auth.ts     ← optional per-route AuthOptions (rean pattern)
    ├── auth/
    │   ├── user.authentication.middleware.ts    ← copy from D:\kleo\kleo-backend-exp\src\auth\
    │   ├── user.authorization.middleware.ts
    │   ├── client.app.auth.middleware.ts        ← x-api-key check
    │   ├── context.handler.ts
    │   ├── role.cache.ts
    │   └── role.permissions.cache.ts
    ├── common/
    │   ├── handlers/
    │   │   ├── error.handler.ts                 ← D:\kleo\kleo-backend-exp\src\common\handlers\error.handler.ts
    │   │   └── response.handler.ts              ← D:\charqol\accounting-service\src\common\handlers\response.handler.ts
    │   ├── api.error.ts                         ← D:\Rean\reancare-service\src\common\api.error.ts
    │   └── logger.ts                            ← D:\Rean\reancare-service\src\common\logger.ts
    ├── config/
    │   └── configuration.manager.ts             ← D:\charqol\payroll-service\src\config\configuration.manager.ts
    ├── database/
    │   ├── database.connector.ts                ← D:\charqol\accounting-service\src\database\database.connector.ts
    │   ├── database.injector.ts                 ← tsyringe wiring (rean)
    │   └── typeorm/
    │       ├── models/                          ← entities, one file per table
    │       ├── mappers/                         ← entity ↔ DTO (kleo)
    │       └── services/                        ← repository-shaped data services (kleo)
    ├── domain.types/                            ← interfaces, enums, DTOs
    ├── events/
    │   ├── event.emitter.ts                     ← D:\charqol\user-service\src\events\event.emitter.ts
    │   └── brokers/                             ← in.memory, kafka, rabbitmq, sqs
    ├── modules/                                 ← optional cross-domain modules (notifications, files, etc.)
    └── startup/
        ├── loader.ts
        ├── injector.ts                          ← D:\Rean\reancare-service\src\startup\injector.ts
        ├── scheduler.ts                         ← swap rean's node-cron for BullMQ (see §9)
        └── seeder.ts                            ← D:\Rean\reancare-service\src\startup\seeder.ts
```

---

## 3. Bootstrapping (`app.ts` + `index.ts`)

Pattern source: `D:\Rean\reancare-service\src\app.ts`.

Key choices to copy:
- `Application` singleton class; `index.ts` simply imports and calls `Application.instance().start()`.
- Express middleware order: `cors → helmet → json → urlencoded → contextSetter → routes → globalErrorHandler`.
- Listen on `process.exit` / `unhandledRejection` / `uncaughtException` and log via central Logger — `app.ts` lines around `setupExceptionHandlers()`.
- Routes wired through a single `Router` class (`D:\Rean\reancare-service\src\api\router.ts`) that imports every domain's `<domain>.routes.ts`. Easier to add/remove a feature.

---

## 4. Config (`service.config.json` + `ConfigurationManager`)

**File shape** (from `D:\kleo\kleo-backend-exp\service.config.json` + `D:\charqol\accounting-service\service.config.json`):

```json
{
  "SystemIdentifier": "PtKharade.OrdersService",
  "BaseUrl": "https://orders.ptkharade.in",
  "Auth": { "JwtExpirySeconds": 3600, "RefreshExpirySeconds": 2592000 },
  "Database": { "Dialect": "postgres" },
  "Logging": { "Provider": "Custom", "Level": "Information" },
  "TemporaryFolders": {
    "UploadFolder": "./tmp/uploads",
    "DownloadFolder": "./tmp/downloads",
    "LogFolder": "./logs",
    "CleanupEveryMinutes": 60
  },
  "FileStorage": { "Provider": "AWS-S3" },
  "Sms":            { "Provider": "Msg91" },
  "Email":          { "Provider": "SES"  },
  "MobileNotification": { "Provider": "Firebase" },
  "MessageBroker":  { "Provider": "InMemory" },
  "MaxUploadFileSize": 10485760
}
```

**Loader pattern** (use verbatim from `D:\charqol\payroll-service\src\config\configuration.manager.ts`):
- Static class `ConfigurationManager`
- `initialize()` runs at module load — merges `service.config.json` with `process.env` overrides
- Each setting is exposed as a static getter: `ConfigurationManager.BaseUrl()`, `MessageBrokerProvider()`, etc.

Local-dev overrides: prefer `.env.local` (loaded by `dotenv`) over a separate `service.config.local.json` — simpler ops, matches charqol.

---

## 5. Database — TypeORM 3-folder split

Adopt the kleo pattern wholesale: `src/database/typeorm/{models,mappers,services}/`. Reference paths:

```
D:\kleo\kleo-backend-exp\src\database\typeorm\models\work.order.entity.ts
D:\kleo\kleo-backend-exp\src\database\typeorm\mappers\<entity>.mapper.ts
D:\kleo\kleo-backend-exp\src\database\typeorm\services\<entity>.service.ts
```

**Entity conventions** (sample from `D:\charqol\accounting-service\src\database\models\customer.model.ts`):
- `@Entity({ name: 'snake_case_plural' })`
- UUID PK: `@PrimaryGeneratedColumn('uuid') id: string;`
- `@CreateDateColumn()` and `@UpdateDateColumn()` on every entity
- `@DeleteDateColumn()` for soft-delete-aware entities (orders, customers — yes; rate cards — yes; audit log — no)
- Multi-tenant scaffolding: every business entity carries `CompanyId` / `TenantId` (charqol) — even if we currently have one company, the column is there for the multi-branch phase
- Composite uniques: `@Unique(['CompanyId', 'CustomerCode'])` (charqol customer model)
- Relations explicit and named: `@ManyToOne(() => Customer, c => c.Orders)`

**Connector** — `database.connector.ts` (charqol pattern):
- Reads `process.env.DB_*`
- Switches between `postgres` / `mysql` / `better-sqlite3` (the last is for tests). Our default: `postgres`.
- `synchronize: true` is fine for **dev only** — for prod use TypeORM migrations.

**Migrations:** none of the references run migrations (they rely on `synchronize`). For production we must:
- Generate migrations under `src/database/typeorm/migrations/`
- Disable `synchronize` in prod
- Run migrations on container start in `entrypoint.sh` (see existing entrypoint in `D:\kleo\kleo-backend-exp\entrypoint.sh`)

---

## 6. Auth — JWT + OTP + RBAC

### 6.1 Authenticator chain
**Source of truth:** `D:\Rean\reancare-service\src\auth\custom\` + `D:\charqol\user-service\src\auth\user.auth\user.auth.handler.ts`.

Order is **fixed**:
1. `contextSetter` — attaches `{ context: 'Order.Create' }` and request id to `req`
2. `clientAppAuth` — verifies `x-api-key` against `sister-service-api-keys.json` (only inter-service calls; skip for browser routes)
3. `userAuthenticator` — validates JWT Bearer, hydrates `req.currentUser` with `{ UserId, TenantId, SessionId, RoleId }`
4. `userAuthorizer` — checks the route's `context` against the user's role privileges (cached)

### 6.2 OTP
**Source:** `D:\Batterlicious\user-service\src\domain.types\users\user.enums.ts`.

Enums to adopt verbatim:
```ts
export enum OTPScope        { Login, ChangePassword, ResetPassword, VerifyEmail, VerifyPhone }
export enum OTPChannel      { SMS, EMAIL }
export enum UserLoginMethod { EmailOtp, PhoneOtp, UsernamePassword, EmailPassword, PhonePassword, Oauth }
```
- OTP stored in **Redis** with TTL (BRIEF §2.5). Reference repos use DB-backed OTP via `otp.repo.interface.ts` (rean) — for PT Kharade, Redis is cleaner.
- 6-digit numeric, 5-minute TTL, max 3 verify attempts per code.
- Phone OTP via MSG91 (BRIEF), Email OTP via SES.

### 6.3 RBAC
**Source:** `D:\kleo\kleo-backend-exp\src\auth\role.cache.ts`, `role.permissions.cache.ts`, and `D:\Rean\reancare-service\seed.data\role.privileges\` (per-role JSON files).

- Roles for PT Kharade: `SystemAdmin`, `Receptionist`, `Customer`, `Vendor` (sub-type of Customer with credit). Vendor stays a *customer profile flag*, not a login role, per BRIEF §2.1.
- Permissions: tuple `'Resource.Action'` — `Order.Create`, `RateCard.Update`, `User.Manage`, `Report.View`, `Audit.View`.
- Seed permissions per role from `seed.data/role.privileges/<role>.json` (rean pattern).
- `role.cache.ts` keeps role → permission set in Redis with TTL; invalidated on permission update.
- Each route declares its context:
  ```ts
  router.post('/orders',
    AuthMiddleware.handle({ context: 'Order.Create', clientAppAuth: false }),
    OrderController.create);
  ```

### 6.4 Token rotation & sessions
- Access token: 1 h (per `service.config.json.Auth.JwtExpirySeconds`)
- Refresh token: 30 d, single-use, rotated on each refresh
- Active session id stored in Redis (`session:<userId>:<sessionId>` → JSON). On logout, delete the key.

### 6.5 MFA (SystemAdmin only)
Wire the full TOTP + backup-codes flow from `D:\charqol\user-service\src\api\users\mfa\mfa.controller.ts` (`setup-totp` → QR code → `verify-totp-setup` → on login, `/auth/login` returns `mfaRequired:true` → `validate-mfa` issues real tokens). Backup codes (10, single-use) regenerable from settings. **Receptionist and Customer roles do not require MFA** — adoption cost > value at this scope. Details and PT Kharade scoping in [`06-extended-patterns.md`](06-extended-patterns.md) §8.

### 6.6 OAuth (optional)
`D:\charqol\core-service\src\api\` `OAuthController` covers GitHub/Google/Facebook/Twitter. Adopt **Google only**, exposed as a "Continue with Google" button on the Flutter customer app, as a faster path than phone OTP for repeat users. Callback issues the same JWT pair used elsewhere. Adds `users.oauth_provider` and `users.oauth_subject` columns.

### 6.7 Device tracking
`D:\charqol\core-service\src\api\users\device.details\user.device.details.controller.ts` logs every login (UA, IP, device fingerprint). Expose `GET /users/me/devices` so a customer can review active sessions and revoke any. **Mandatory** for BRIEF deliverable #13 customer profile screen.

### 6.8 Password policy
From `service.config.json.Auth`: `PasswordExpirationDurationDays: 180`, `OtpValidityInMinutes: 5`. Validator regex enforces ≥ 8 chars, ≥ 1 each of lower/upper/digit/symbol (charqol `user.validator.ts`).

---

## 7. Validators — Joi + base validator

Pattern: `D:\charqol\accounting-service\src\api\customer\customer.validator.ts`.

Convention:
- One `<domain>.validator.ts` per controller.
- Class `<Domain>Validator extends BaseValidator`.
- One static async method per controller action: `validateCreate(req)`, `validateUpdate(req)`, `validateSearch(req)`.
- Method returns a strongly-typed DTO; throws on validation failure (caught by global error middleware).

Example (lifted from charqol style, retargeted for orders):
```ts
import Joi from 'joi';
import express from 'express';
import { ServiceType, OrderChannel } from '../../domain.types/enums/order.enums';

export class OrderValidator extends BaseValidator {
  static validateCreate = async (req: express.Request) => {
    const schema = Joi.object({
      CustomerId:   Joi.string().uuid().required(),
      ServiceType:  Joi.string().valid(...Object.values(ServiceType)).required(),     // DryClean | Laundry | PressOnly
      Channel:      Joi.string().valid(...Object.values(OrderChannel)).required(),    // HomePickup | DropAtShop
      DeliveryType: Joi.string().valid('HomeDelivery', 'CustomerPickup').required(),
      IsExpress:    Joi.boolean().default(false),
      BilledTo:     Joi.string().valid('Customer', 'Vendor').required(),
      Items: Joi.array().min(1).items(Joi.object({
        ItemId:   Joi.string().uuid().required(),
        Quantity: Joi.number().integer().min(1).required(),
        Note:     Joi.string().max(255).optional()
      })).required(),
      ScheduledAt: Joi.date().iso().optional(),
      AddressId:   Joi.string().uuid().optional()
    });
    await schema.validateAsync(req.body, { abortEarly: false });
    return req.body;
  };
}
```

---

## 8. Cache (Redis)

**BRIEF §2.5 mandates Redis** for catalog, rate cards, session, OTP, hot reads.

The references **do not** have a shared cache decorator — caching is embedded in services. Adopt a small library at `src/common/cache/`:

| Key shape                       | Used for                              | TTL          | Invalidated when               |
|---------------------------------|---------------------------------------|--------------|--------------------------------|
| `rate-card:<serviceType>`       | Pricing lookup hot path               | 1 h          | Admin updates rate card        |
| `rate-card:vendor:<vendorId>`   | Vendor-specific overrides             | 1 h          | Admin updates vendor rate      |
| `catalog:items`                 | Item list shown on order intake       | 1 h          | Admin edits item               |
| `session:<userId>:<sessionId>`  | Auth session                          | 1 h          | Logout, manual revoke          |
| `otp:<channel>:<destination>`   | OTP for login/verify                  | 5 min        | Verify success / TTL expiry    |
| `role:<roleId>:perms`           | RBAC permission set                   | 10 min       | Admin edits role permissions   |
| `slot:capacity:<slotId>:<date>` | Slot capacity check (see [06] §4)     | until evict  | Booking writes invalidate      |

Reference for role caching pattern: `D:\kleo\kleo-backend-exp\src\auth\role.cache.ts`.

> **Idempotency is NOT Redis-backed.** It is a TypeORM table with a cleanup job. The middleware reference is `D:\charqol\payroll-service\src\common\idempotency\idempotency.middleware.ts`; see [`06-extended-patterns.md`](06-extended-patterns.md) §7 for the full algorithm (header name, processing/replay semantics, cleanup job). Mount it on `POST /orders`, all webhook endpoints, and any other mutation that the client may retry.

---

## 9. Background jobs — BullMQ

**BRIEF §2.5 mandates BullMQ on Redis.** References use `node-cron` (`D:\Rean\reancare-service\src\startup\scheduler.ts`), so adapt the *job catalogue* from rean but the *runtime* is BullMQ.

**Job catalogue** (mirror `D:\Rean\reancare-service\seed.data\cron.schedules.json` shape):

| Queue                  | Trigger                                | Handler                                                       |
|------------------------|----------------------------------------|---------------------------------------------------------------|
| `notifications`        | Order status change, bill issued       | Fan-out to SMS/email/WhatsApp/FCM (see §11)                   |
| `invoices`             | Bill issued                            | Render PDF (pdfkit), upload to S3, push link to notifications |
| `payments-reconcile`   | Cron */10m                             | Fetch Razorpay/Zoho `pending` payments, reconcile             |
| `subscriptions-renew`  | Daily 02:00 IST                        | Find subs expiring in 24 h, charge via Razorpay Subscriptions |
| `status-reminders`     | Cron 18:00 IST                         | Nudge customers whose order is `Ready` and not picked up      |
| `audit-archival`       | Weekly Sunday 03:00                    | Move audit rows >180 d to cold storage                        |
| `temp-folder-cleanup`  | Hourly                                 | Delete files older than `CleanupEveryMinutes` (rean pattern)  |

**Workers** live under `src/startup/queues/` per service. Each worker file = one queue.

---

## 10. Domain events (outbox pattern)

**Source:** `D:\charqol\user-service\src\events\event.emitter.ts` + `src\events\brokers\`.

Adopt as-is:
- `EventStore` table persists every emitted event (`Pending → Published → Acked`).
- Pluggable broker — start with `InMemory` (phase 1–3), switch to **Redis Streams** in phase 4 (we already run Redis; no extra infra).
- Topic naming: `<service>.<aggregate>.<verb>` — `orders.order.created`, `orders.order.status_changed`, `payments.payment.captured`.
- Subscribers are services with a `@EventHandler('orders.order.created')` decorator on a method (kleo / rean DI pattern).
- Retry with exponential backoff; after 3 failures send to `events.dlq.<topic>`.

Use cases for events (matching BRIEF):
- `orders.order.status_changed` → notifications-service fans out SMS/WhatsApp/Push
- `payments.payment.captured` → orders-service marks bill paid; notifications-service sends receipt
- `subscriptions.subscription.renewed` → identity-service updates discount level
- `users.user.created` → notifications-service sends welcome message

---

## 11. Notifications

**Source of truth:** `D:\Rean\reancare-service\src\services\general\reminder.sender.service.ts`.

A single service in `notifications-service` (or `notifications` module pre-split) exposes:
```ts
notify({
  channels: ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH', 'IN_APP'],
  template: 'order.ready',
  recipient: { phone, email, fcmToken, userId },
  data: { orderId, customerName, totalInr }
});
```

Adapter wiring (lifted from rean):
- SMS → MSG91 (BRIEF) — rean uses Twilio; the adapter shape is identical, just swap the HTTP client.
- Email → AWS SES.
- WhatsApp → MSG91 WhatsApp API; behind feature flag (`MessageBroker.WhatsApp.Enabled`).
- Push (FCM) — read device token from `user.device.token` table; rean has full FCM adapter.
- In-app → write notification row, push via SSE/socket if user is online.

Templates: i18n-aware (English + Marathi). Store in `seed.data/notification.templates/<key>.<lang>.json`. Reference: rean has flat-message templates in seed; we add the `<lang>` axis.

---

## 12. Payments — Razorpay + Zoho with state machine

**State machine source:** `D:\Batterlicious\batterlicious-service\src\state.machines\payment.state.ts` + `src\domain.types\enums\payment.status.enum.ts`.

States: `Pending → Authorized → Captured → (Refunded | PartiallyRefunded) | Failed | Cancelled`.

Adopt the machine as-is. Wire two gateway adapters behind a common interface:
```ts
interface IPaymentGateway {
  createOrder(input: CreateOrderInput): Promise<GatewayOrder>;
  capture(paymentId: string): Promise<PaymentResult>;
  refund(paymentId: string, amount: number): Promise<RefundResult>;
  verifyWebhook(headers, body): WebhookEvent | null;
}
```
- `RazorpayGateway` — primary. SDK: `razorpay` npm package.
- `ZohoPayGateway` — secondary. SDK shape mirrored in `D:\Batterlicious\customer-app 2\Services\ZohoPaymentConfig.cs` (config only — port the auth/endpoint scheme).

**Subscriptions** (BRIEF §2.4) — Razorpay Subscriptions API. No direct reference; closest analogue is the recurring billing pattern in `D:\charqol\accounting-service\src\api\invoice\` (customer/vendor invoice with cycle). Use Razorpay's hosted page for subscription auth, store the `subscription_id`, run renewal worker (see §9).

**Webhooks:** mounted under `/webhooks/razorpay` and `/webhooks/zohopay`. Signature verification per gateway docs. Idempotency via `idempotency:<webhookId>` Redis key (24 h TTL). On success, publish `payments.payment.captured` event.

---

## 13. Logger, errors, response envelope

| Concern             | Pattern                                                                                          | Reference                                                                                 |
|---------------------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Logger              | **Structured** logger with auto-injected `correlationId`, `userId`, `tenantId`, `companyId`, `method`, `path`, `statusCode`, `duration` via `AsyncLocalStorage` | `D:\charqol\payroll-service\src\logger\structured.logger.ts` + `correlation.id.ts` — see [`06-extended-patterns.md`](06-extended-patterns.md) §10 |
| Error class         | `class ApiError extends Error { httpErrorCode; details }`                                       | `D:\Rean\reancare-service\src\common\api.error.ts`                                        |
| Error middleware    | Global Express middleware; logs stack; maps `ApiError` → response                               | `D:\Rean\reancare-service\src\middlewares\error.handling.middleware.ts`                   |
| Response envelope   | `{ Status, Message, HttpCode, Data, Trace, Client, User, Context, ... }`                        | `D:\charqol\accounting-service\src\common\handlers\response.handler.ts`                   |
| Distributed tracing | OpenTelemetry SDK init in `src/startup/telemetry.ts`; `@Trace('Controller.method')` decorator on hot paths; **Zipkin** exporter (self-hosted on the same VPS, free) | `D:\charqol\sales-service\src\api\lead\lead.controller.ts` for `@Trace`; OTel deps in `D:\charqol\accounting-service\package.json`. Details in [`06-extended-patterns.md`](06-extended-patterns.md) §11 |
| Correlation ID      | `X-Correlation-ID` request header; if absent, middleware generates a UUID v4; propagated to sister services via Axios interceptor | `D:\charqol\payroll-service\src\logger\correlation.id.ts` — adopt verbatim on day one     |

The internal response envelope includes diagnostics (`Trace`, `Request`, `User`) — strip these before sending to clients. Reference handler does this already.

---

## 14. Seeders

Pattern: `D:\Rean\reancare-service\src\startup\seeder.ts` + `seed.data/`.

For PT Kharade, the seeder must populate the BRIEF §2.3 rate tables on first boot. Deliverable #14 in the BRIEF is precisely this seed file. Skeleton:

```ts
// src/startup/seeder.ts
@injectable()
export class Seeder {
  constructor(
    @inject('IItemService')      private _items: IItemService,
    @inject('IRateCardService')  private _rateCards: IRateCardService,
    @inject('IRoleService')      private _roles: IRoleService,
    @inject('IUserService')      private _users: IUserService
  ) {}

  public seed = async () => {
    await this._seedRoles();          // from seed.data/role.privileges/*.json
    await this._seedItems();          // from seed.data/items.seed.json
    await this._seedRateCards();      // from seed.data/rates.seed.json   (BRIEF §2.3)
    await this._seedSystemAdmin();    // from seed.data/system.admin.seed.json
  };
}
```
`rates.seed.ts` (BRIEF deliverable #14) goes into `seed.data/` as JSON or `.ts`; the seeder iterates and calls `_rateCards.create()`. Rean's role-privilege loader is the cleanest reference for the "iterate JSON files in a folder" pattern.

---

## 15. Bruno API collections

Pattern: `D:\kleo\kleo-backend-exp\bruno\kleo.service\` — folders by domain, one `.bru` per request, ordered with `01- Create User\01 - Create user.bru`-style numeric prefixes.

For PT Kharade, mirror the folder structure:
```
bruno/pt-kharade/
├── 01 - Auth/
├── 02 - Customers/
├── 03 - Vendors/
├── 04 - Catalog/
├── 05 - Rate Cards/
├── 06 - Orders/
├── 07 - Bills/
├── 08 - Payments/
├── 09 - Subscriptions/
├── 10 - Notifications/
└── 11 - Reports/
```
Bruno collections are version-controlled — every endpoint must have at least one matching `.bru` request before merge. Charqol does not have Bruno; kleo does. Follow kleo.

---

## 16. Tests

| Layer            | Library                                | Reference                                              |
|------------------|----------------------------------------|--------------------------------------------------------|
| Unit (services)  | **Vitest** (modern; rean uses Mocha+Chai — Vitest is faster, drop-in) | `D:\Rean\admin-portal-v2\` (vitest workspaces show the config) |
| Integration (API)| Bruno collections **run in CI** via `bruno run --env test` | `D:\kleo\kleo-backend-exp\bruno\` (manual today; automate in CI) |
| E2E              | Done by SvelteKit Playwright + Flutter integration_test |  see sub-guides 02 + 03                                |

Target coverage: **70% of services and validators** for phase 1; **80% by phase 4**. No coverage required on controllers (thin glue) or mappers (generated).

---

## 17. Coding conventions (lifted from rean + charqol)

**TypeScript** (`D:\Rean\reancare-service\tsconfig.json`):
- `target: es6`, `module: commonjs`, `experimentalDecorators`, `emitDecoratorMetadata` — needed for tsyringe + reflect-metadata
- `strict: true` (rean has selective strict; for new code go full strict)

**ESLint** (`D:\Rean\reancare-service\.eslintrc.json`):
- `airbnb-base` + `@typescript-eslint`
- `no-console`: error (use Logger only)
- max line length **125**, 4-space indent, semicolons **required**
- File naming: kebab-case (`order.controller.ts`, `rate.card.entity.ts`)
- Class naming: PascalCase, single class per file
- Enum naming: PascalCase enum, PascalCase members (`OrderStatus.Booked`)

**Folder & file naming:**
- Backend folders: lower-kebab (`rate-card/`), file names: dot-separated (`rate.card.controller.ts`) — kleo convention
- Tests: `<thing>.test.ts` colocated under `tests/` mirror of `src/`

**Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
**Branching:** `main` (protected) ← `develop` ← `feature/<ticket>`. PR template enforces: linked ticket, Bruno collection updated, tests added.

---

## 18. Production runtime

Each service ships with the rean/charqol/kleo runtime contract:
- `Dockerfile` — multi-stage build, non-root user
- `entrypoint.sh` — waits for Postgres + Redis, runs migrations, starts node
- Healthcheck endpoint `GET /health/status` (rean pattern)
- Readiness endpoint `GET /health/ready` — checks DB + Redis + broker
- Graceful shutdown on `SIGTERM` (drains BullMQ workers; closes DB connections)

Single-VPS phase-1 setup (BRIEF §3): `docker compose` with one container per service plus Postgres + Redis. Migrate to managed K8s in phase 7 (BRIEF §6).

---

## 19. Quick checklist for a new domain

When adding `RateCard` (or any new aggregate), do these in order — each file has a direct reference:

1. Entity → `src/database/typeorm/models/rate.card.entity.ts` (model after `D:\charqol\accounting-service\src\database\models\customer.model.ts`)
2. DTO + enum → `src/domain.types/rate.card/rate.card.types.ts`
3. Mapper → `src/database/typeorm/mappers/rate.card.mapper.ts` (after kleo mapper)
4. Service → `src/database/typeorm/services/rate.card.service.ts` (after kleo service)
5. Validator → `src/api/rate-card/rate.card.validator.ts` (after `D:\charqol\accounting-service\src\api\customer\customer.validator.ts`)
6. Controller → `src/api/rate-card/rate.card.controller.ts`
7. Routes → `src/api/rate-card/rate.card.routes.ts` — declare `context('RateCard.*')`
8. Permission seed → `seed.data/role.privileges/<role>.json` — add `RateCard.Read` / `.Create` etc.
9. Bruno collection → `bruno/pt-kharade/05 - Rate Cards/*.bru`
10. Tests → `tests/api/rate-card/rate.card.service.test.ts`

If step ≥ 4 is unclear, open the kleo `customer` flow side-by-side — it covers all ten in one entity.

---

## 20. Domain modules to lift wholesale from references

These domains were under-covered in the first pass. Each has a near-complete entity model in the reference repos that can be ported with minor renaming. **All anchored in [`06-extended-patterns.md`](06-extended-patterns.md)** — open that file when implementing.

| Module                              | Primary reference path                                                                                    | Notes                                                                  |
|-------------------------------------|-----------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| Subscriptions (pause/resume/DoW)    | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\subscription.entity.ts` + `subscription.item.entity.ts` | Day-of-week mask, pause/resume with `TotalPausedDays`, split wallet+gateway payment. [`06`](06-extended-patterns.md) §1 |
| Recurring billing                   | `D:\charqol\accounting-service\src\api\recurring.invoice\` + `invoice.template.model.ts`                  | Frequency enum + `NextInvoiceDate` + template-driven render. [`06`](06-extended-patterns.md) §12 |
| Delivery (zones/hubs/partners/slots/charges) | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\delivery.*`                  | Eight-entity domain. Slot capacity atomic check. [`06`](06-extended-patterns.md) §2 |
| Slot capacity + product cutoffs     | `delivery.slot.entity.ts` (`MaxOrders`/`CurrentOrders`) + `product.daily.capacity.entity.ts` + `order.cutoff.entity.ts` | Critical for laundry slot management. [`06`](06-extended-patterns.md) §4 |
| Processing batches (wash cycles)    | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\preparation.batch.entity.ts` + `preparation.items.entity.ts` | Group orders into shop-floor batches. [`06`](06-extended-patterns.md) §3 |
| Discount engine + usage tracking    | `discounts.entity.ts` + `discount.usage.entity.ts`                                                        | Coupon / percent / flat / free-pickup; composition rule documented. [`06`](06-extended-patterns.md) §5 |
| Wallet (refunds + B2B credit)       | `wallet.entity.ts` + `wallet.transactions.entity.ts`                                                      | B2B credit = negative-floor wallet. [`06`](06-extended-patterns.md) §6 |
| Vendor settlements / payouts        | `vendor.settlements.entity.ts` + `settlement.transactions.entity.ts` + `vendor.bank.accounts.entity.ts`   | TDS + adjustments + bank payouts. [`06`](06-extended-patterns.md) §13 |
| Customer-facing order activity log  | (model after `D:\charqol\sales-service\src\api\activity\activity.controller.ts`)                          | Separate from admin audit log. [`06`](06-extended-patterns.md) §20 |
| Address with geo + Indian conventions | `address.entity.ts` (Society/Flat/Building/Landmark/Lat/Long)                                           | Replace any free-text address line with this. [`06`](06-extended-patterns.md) §14 |
| Product variants                    | `product.variants.entity.ts`                                                                              | Size/fabric variants — needed for bedsheet single/double/king. [`06`](06-extended-patterns.md) §14 |
| Multi-tenancy enforcement           | charqol entity examples with `OrganizationId` + `CompanyId` composite index                                | Future-proofs multi-branch. [`06`](06-extended-patterns.md) §9 |

---

*Backend guide ends here. Continue with [`02-admin-portal.md`](02-admin-portal.md). Open [`06-extended-patterns.md`](06-extended-patterns.md) alongside whenever this guide says "see 06".*
