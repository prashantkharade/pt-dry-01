# PT Kharade — Vertical Slice Implementation

A working slice of the PT Kharade Drycleaners & Laundry platform across all
three layers: **two backend microservices**, the **SvelteKit admin portal**,
and the **Flutter customer app**.

This is a focused vertical slice — auth + an order intake flow end-to-end —
rather than a complete implementation of every feature in the guides. It is
designed to *actually run*, with a real Postgres + Redis, real JWTs, real
order pricing and status machine. See **What's in the slice** below for the
exact scope.

## Layout

```
impl/
├── docker-compose.yml             Postgres 16 + Redis 7
├── .env  /  .env.example
├── infra/init-db.sql              Bootstrap identity_db / orders_db / notifications_db
├── backend/
│   ├── packages/shared/           Shared TS lib: logger, ApiError, ResponseHandler,
│   │                              ConfigurationManager, JWT, auth middleware
│   └── services/
│       ├── identity-service/      Auth (OTP + password), users, customers, RBAC
│       └── orders-service/        Catalog, rate cards, pricing, orders + state machine
├── admin-portal/                  SvelteKit 2 + Svelte 5 (runes)
│   ├── src/routes/signin/
│   ├── src/routes/(app)/
│   │   ├── dashboard/
│   │   ├── orders/(list, new, [id])
│   │   └── customers/
│   └── src/lib/server/backend.ts  Two-tier API client (BFF → service wrapper)
└── customer-app/                  Flutter (Android/iOS/web from one codebase)
    └── lib/
        ├── core/api/api_client.dart
        ├── core/auth/auth_store.dart      flutter_secure_storage
        └── features/{splash,auth,home,booking,orders}/
```

## What's in the slice

**Working end-to-end (verified via smoke test):**

- Postgres (Docker) seeded with one tenant `PT Kharade Group of Industries`,
  one branch `Mukundnagar Shop`, four roles, a SystemAdmin user, and the
  BRIEF §2.3 catalog + rate cards + surcharges.
- Identity service: password login, OTP send/verify (dev mode returns OTP in
  the response), `/users/me`, customer CRUD with phone-uniqueness, address
  capture.
- Orders service: catalog endpoints, `/pricing/quote` that resolves retail or
  vendor rates with home-delivery (₹40 flat) and express (+25%) surcharges,
  `/orders` create that calls identity for customer lookup via `x-api-key`,
  paginated order list, order detail with status history, status machine
  (`Booked → PickedUp → Received → InProcess → Ready → OutForDelivery →
  Delivered → Closed`, plus `Cancelled` / `OnHold`).
- Admin portal: cookie session, login form, sidebar shell, dashboard KPIs,
  searchable orders list, **new-order intake page** (service tabs, item
  selector, channel/delivery toggles, express, quote preview, place), order
  detail with status transitions, customer search + create.
- Customer app: OTP login, home with service tiles, **booking screen** with
  the same item picker + quote preview as the admin portal, my-orders list,
  order detail with timeline.

**Out of scope for this slice (planned in the guides, not built here):**

- Notifications service (SMS/email/WhatsApp/FCM, templates) — code stubbed in
  identity-service as `OtpService` writing to Redis only.
- Subscriptions, vendor B2B credit floors, wallet, discounts, settlements,
  delivery zones/slots, processing batches.
- Razorpay / Zoho Pay — order is created in `Booked` with no online payment.
  Adding the gateway is one new service file plus a webhook route.
- Marathi i18n (the data has `NameMr` fields seeded; the UI shows English only).
- Theming page, offline service worker, audit log UI.
- MFA, OAuth, device tracking.
- TypeORM migrations (the slice uses `synchronize: true`).

## Prerequisites

- Node 20+
- Docker Desktop (for Postgres + Redis)
- Flutter 3.22+ (only required to run the customer app)

A local Postgres on port 5432 will collide — that's why the container is
mapped to host port **5544** (override in `.env`).

## Run

```powershell
cd e:\WORK\PTDRY\impl

# 1) Install once
npm install

# 2) Copy env (defaults are fine for dev)
copy .env.example .env

# 3) Start Postgres + Redis
npm run up                # docker compose up -d

# 4) Run the two backend services (separate terminals)
npm run identity:dev      # http://localhost:4001
npm run orders:dev        # http://localhost:4002   (waits 1s for identity)

# 5) Run the admin portal
cd admin-portal
copy .env.example .env
npm run dev               # http://localhost:5173

# 6) (Optional) Run the Flutter app
cd ..\customer-app
flutter pub get
flutter run               # picks an attached device or emulator
```

## Verified smoke test

```bash
# 1. Login as the seeded SystemAdmin
TOKEN=$(curl -s -X POST -H 'content-type: application/json' \
  -d '{"emailOrPhone":"admin@ptkharade.in","password":"Admin@12345"}' \
  http://localhost:4001/auth/login | jq -r .Data.accessToken)

# 2. Create a customer
curl -X POST -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"Name":"Rohan Patil","Phone":"+919876543210","CustomerType":"Retail"}' \
  http://localhost:4001/customers

# 3. List items for Dry Clean, pick the SHIRT id
curl -H "authorization: Bearer $TOKEN" \
  'http://localhost:4002/catalog/items?service=DRY_CLEAN'

# 4. Place an order: 3 shirts, home delivery, express
curl -X POST -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"customerId":"<id>","serviceTypeCode":"DRY_CLEAN","channel":"DropAtShop",
       "deliveryType":"HomeDelivery","isExpress":true,
       "items":[{"itemId":"<shirt-id>","quantity":3}]}' \
  http://localhost:4002/orders
# → 3 × ₹50 = ₹150 subtotal + ₹40 delivery + 25% express = ₹227.50
```

The admin portal `/dashboard` will show this order in its "Recent orders"
table within seconds.

## Default credentials

- **SystemAdmin (admin portal):** `admin@ptkharade.in` / `Admin@12345`
- **Customer app OTP:** in dev mode the OTP is returned in the
  `POST /auth/otp/send` response body as `devOtp` (also logged by the
  identity-service). Use it on the OTP screen.

## Architecture notes (from the guides)

The slice respects the conventions from
[`../IMPLEMENTATION-GUIDE.md`](../IMPLEMENTATION-GUIDE.md) §7:

- Per-service `src/{api,database,services,startup}` layout (collapsed: no
  separate `mappers/` folder yet — would split out in phase 2).
- Joi validators colocated with controllers; all responses through
  `ResponseHandler.success/.failure`.
- Custom `ApiError` is the only thrown error from services; the global error
  middleware maps it to the response envelope.
- JWT access (1h) + refresh (30d), session id mirrored to Redis for revocation.
- Inter-service calls carry `x-api-key` (admin portal key, customer app key,
  orders-service key — all seeded into `client_apps`).
- Order status transitions are enforced by `STATUS_NEXT` in
  `orders.service.ts` — invalid moves return 409.

## Next steps (matching BRIEF phases)

| Phase | What to add to this slice |
|-------|---------------------------|
| 1     | TypeORM migrations; replace Redis-backed sessions with a proper `SessionManager`; permissions seed + role-permission cache. |
| 2     | Bills + invoice PDF (pdfkit); order activity log; print-friendly `+page@.svelte` invoice/label. |
| 3     | Razorpay gateway + state machine; webhook endpoints + idempotency middleware. |
| 4     | Subscriptions (pause/resume/DoW), vendor settlements, wallet. |
| 5     | Notifications service (MSG91 SMS, SES email, FCM push, in-app), Marathi templates. |
| 6     | paraglide-js i18n in admin portal; flutter_localizations in app; theming page persisted to `users.ThemePrefs`. |
| 7     | OpenTelemetry tracing; Bruno collections; Playwright E2E + integration tests. |
