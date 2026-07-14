# PT Kharade Drycleaners & Laundry — Implementation

Flat layout: every microservice, the admin portal and the customer app live
directly under `impl/` and run independently. There is no monorepo and no
workspace package — each service has its own `package.json`, `node_modules`,
`.env`, `Dockerfile` and entrypoint.

> **Just want to run everything?** See **[RUNNING.md](RUNNING.md)** for the
> copy-paste quick-start, or run `.\start-all.ps1` from `impl/` to launch all
> five backends + the admin portal in one go.

```
impl/
├── docker-compose.yml              shared infra: Postgres 16 + Redis 7
├── start-all.ps1                   launch all 5 services + admin portal (Windows)
├── RUNNING.md                      consolidated run-everything guide
├── infra/init-db.sql               bootstraps the 5 per-service databases
├── identity-service/               :4001  auth, users, customers, tenants, branches, RBAC
├── catalog-pricing-service/        :4002  items, rate cards, surcharges, /pricing/quote
├── orders-service/                 :4003  orders, status workflow, bills
├── payments-service/               :4004  Razorpay / Zohopay + webhooks
├── notifications-service/          :4005  SMS / Email / WhatsApp / FCM
├── admin-portal/                   :5173  SvelteKit 2 + Svelte 5 (runes), SSR
└── customer-app/                          Flutter (Android / iOS / web)
```

The backend layout follows the canonical Express + TypeORM + tsyringe pattern
used across our sister projects (Batterlicious, charqol, kleo): a singleton
`Application` bootstrap, per-domain `api/{domain}/{controller, routes,
validator, auth}`, a `database/typeorm/{models, services, mappers}` tree, a
thin `common/` for errors and response envelopes, and a `startup/` group
(Loader, Injector, Router, Seeder, Scheduler).

### Per-service canonical tree

```
<service-name>/
├── Dockerfile, entrypoint.sh, service.config.json
├── package.json, tsconfig.json, README.md
├── .env, .env.example
└── src/
    ├── index.ts                       dotenv + reflect-metadata + Application.start()
    ├── app.ts                         Singleton Application
    ├── @types/express/index.d.ts      Request.currentUser augmentation
    ├── api/{domain}/                  controller.ts, routes.ts, validator.ts, auth.ts
    ├── auth/                          user.auth/ + client.app.auth/ + context.handler.ts
    ├── common/                        api.error.ts, http.status.codes.ts, handlers/
    ├── config/                        configuration.manager.ts + config.json + config.local.json
    ├── database/
    │   ├── database.connector.ts
    │   ├── database.config.ts
    │   └── typeorm/
    │       ├── typeorm.database.connector.ts
    │       ├── models/                {name}.model.ts (entities)
    │       ├── mappers/               static toDto(entity) → DTO
    │       └── services/              {name}.service.ts (extends BaseService)
    ├── domain.types/                  enums/ + DTOs per domain
    ├── events/event.initializer.ts
    ├── logger/logger.ts               Winston + DailyRotateFile in prod
    ├── middlewares/                   common.middlewares.ts, error.handling.middleware.ts
    ├── modules/                       module.injector.ts + plug-in adapters
    └── startup/                       injector, loader, route.handler, seeder, scheduler
```

## Prerequisites

- Node 22+
- Flutter 3.22+ (only required to run the customer app)
- Postgres / MySQL / Docker — **optional**. Each service defaults to **SQLite**
  (file-backed, no infra). Bring up real DBs only if you want them.

## Database — pick your dialect

Each service reads `DB_DIALECT` from its own `.env`. Supported values:

| Dialect    | Infra required          | Default file / DB                                |
| ---------- | ----------------------- | ------------------------------------------------ |
| `sqlite`   | nothing — zero install  | `./data/<service>.sqlite` per service            |
| `postgres` | Postgres 14+ on :5432   | `identity_db`, `catalog_pricing_db`, …           |
| `mysql`    | MySQL 8+ on :3306       | same five database names                         |

Schema is auto-created (`DB_SYNC=true`) so you do **not** need to run a
migration. To switch dialects later: edit one line in the service's `.env`,
restart, done. Each service is fully self-contained — they don't share a DB.

### Optional: bring up Postgres + Redis via Docker

```bash
cd impl
docker compose up -d              # Postgres :5544, Redis :6379
docker compose logs -f postgres
docker compose down
```

`infra/init-db.sql` creates the five per-service databases on first boot.
If you use this, set `DB_DIALECT=postgres` and `DB_PORT=5544` in each
service's `.env` (or use the URL form: `postgres://ptk:ptk@localhost:5544/<db>`).

### Optional: run with MySQL

1. Install MySQL locally (or `docker run -p 3306:3306 -e MYSQL_ROOT_PASSWORD=ptk mysql:8`).
2. Create the five databases:
   ```sql
   CREATE DATABASE identity_db;
   CREATE DATABASE catalog_pricing_db;
   CREATE DATABASE orders_db;
   CREATE DATABASE payments_db;
   CREATE DATABASE notifications_db;
   CREATE USER 'ptk'@'%' IDENTIFIED BY 'ptk';
   GRANT ALL ON *.* TO 'ptk'@'%';
   ```
3. In each service's `.env`, set:
   ```
   DB_DIALECT=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=ptk
   DB_PASSWORD=ptk
   ```
4. `npm install` re-runs (mysql2 driver is already in package.json).

## Run a microservice independently

Every service is fully standalone — no Docker, no Redis, no Postgres needed
in the default SQLite mode. From its own directory:

```bash
cd impl/<service-name>
cp .env.example .env              # only the first time (already populated)
npm install
npm run dev                       # tsx watch — picks up file changes
```

The five backend services:

| Service                     | Port | Health-check URL                           |
| --------------------------- | ---- | ------------------------------------------ |
| identity-service            | 4001 | http://localhost:4001/health-check         |
| catalog-pricing-service     | 4002 | http://localhost:4002/health-check         |
| orders-service              | 4003 | http://localhost:4003/health-check         |
| payments-service            | 4004 | http://localhost:4004/health-check         |
| notifications-service       | 4005 | http://localhost:4005/health-check         |

Startup order (because seeders in catalog-pricing / orders / notifications call
identity-service to discover the seeded tenant):

1. `identity-service` (wait for `seed complete`)
2. `catalog-pricing-service`, `orders-service`, `payments-service`,
   `notifications-service` — can run in parallel after step 1.

Redis is **optional** — if `REDIS_URL` is not set, OTPs and sessions live in
an in-process in-memory cache (fine for single-instance dev, NOT for
multi-replica prod).

For production: `npm run build` then `npm run start` (PM2 is bundled in the
Dockerfile).

## Inspect the database

### SQLite (default)

The DB file lives at `<service>/data/<name>.sqlite`. Open it with any SQLite
viewer:

- **DB Browser for SQLite** — <https://sqlitebrowser.org/> (free, GUI).
- **TablePlus** / **DBeaver** — both support SQLite natively.
- **VS Code extension** — "SQLite Viewer" by Florian Klampfer.
- **CLI**:
  ```powershell
  npx sqlite3 .\identity-service\data\identity.sqlite ".tables"
  npx sqlite3 .\identity-service\data\identity.sqlite "select * from users;"
  ```

### Postgres

If you started Postgres via `docker compose up -d`:

```powershell
# 1. Open psql inside the container
docker exec -it ptk_postgres psql -U ptk identity_db

# Useful psql commands once inside:
\l            -- list databases
\c orders_db  -- switch to another database
\dt           -- list tables
select * from users;
\q            -- quit
```

GUI tools:
- **pgAdmin 4** — <https://www.pgadmin.org/download/>
  Connect with: host `127.0.0.1`, port `5544`, user `ptk`, password `ptk`.
- **DBeaver** — universal client; same connection details.
- **TablePlus** — paid but excellent on Windows.
- **VS Code** — install "PostgreSQL" by Chris Kolkman, then connect to
  `127.0.0.1:5544` with `ptk` / `ptk`.

Connection string template:
```
postgres://ptk:ptk@127.0.0.1:5544/identity_db
postgres://ptk:ptk@127.0.0.1:5544/catalog_pricing_db
postgres://ptk:ptk@127.0.0.1:5544/orders_db
postgres://ptk:ptk@127.0.0.1:5544/payments_db
postgres://ptk:ptk@127.0.0.1:5544/notifications_db
```

### MySQL

GUI: **MySQL Workbench** (<https://dev.mysql.com/downloads/workbench/>),
**DBeaver**, or **TablePlus**.

CLI:
```powershell
mysql -h 127.0.0.1 -P 3306 -u ptk -p
# password: ptk
USE identity_db;
SHOW TABLES;
SELECT * FROM users;
```

## Frontends

```bash
# Admin portal (SvelteKit)
cd impl/admin-portal
cp .env.example .env
npm install
npm run dev                       # http://localhost:5173

# Customer app (Flutter)
cd impl/customer-app
flutter pub get
flutter run -d chrome             # web
flutter run                       # Android / iOS device
```

## Default seeded admin

```
Email    : admin@ptkharade.in
Phone    : +919999900001
Password : Admin@12345
```

Override with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD`
in `identity-service/.env`.

For the customer app's OTP login, in dev the `POST /api/v1/auth/otp/send`
response includes the generated OTP as `Data.DevOtp` so end-to-end testing
works without an SMS gateway.

## Smoke test (after all services are up)

```bash
# 1. Login as the seeded SystemAdmin
TOKEN=$(curl -s -X POST -H 'content-type: application/json' \
  -d '{"EmailOrPhone":"admin@ptkharade.in","Password":"Admin@12345"}' \
  http://localhost:4001/api/v1/auth/login | jq -r .Data.AccessToken)

# 2. Create a customer
curl -X POST -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"Name":"Rohan Patil","Phone":"+919876543210","CustomerType":"Retail"}' \
  http://localhost:4001/api/v1/customers

# 3. List Dry-Clean items from the catalog service
curl -H "authorization: Bearer $TOKEN" \
  'http://localhost:4002/api/v1/catalog/items?Service=DRY_CLEAN'

# 4. Place an order: 3 shirts, home delivery, express
curl -X POST -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"CustomerId":"<id>","ServiceTypeCode":"DRY_CLEAN","Channel":"DropAtShop",
       "DeliveryType":"HomeDelivery","IsExpress":true,
       "Items":[{"ItemId":"<shirt-id>","Quantity":3}]}' \
  http://localhost:4003/api/v1/orders
# → 3 × ₹50 = ₹150 subtotal + ₹40 delivery + 25% express = ₹227.50
```

## Conventions

- **Response envelope:** every endpoint returns
  `{ Status, Message, HttpCode, Data, Errors?, ApiVersion, ServiceName }`.
- **Errors:** services throw `ApiError` via `ErrorHandler.throw*`; the global
  error middleware maps to the envelope.
- **Auth:** `Authorization: Bearer <jwt>` for user calls; sister services add
  `x-api-key: <seeded key>` per `client_apps` seed.
- **DI:** `tsyringe` — services are `@injectable()` singletons registered in
  `modules/module.injector.ts` and resolved via `container.resolve(...)` in
  controllers.
- **Validation:** Joi schemas in `{domain}.validator.ts`; controllers stay
  free of validation concerns.
- **DB:** TypeORM `synchronize: true` in dev (set `DB_SYNC=false` and switch
  to migrations for prod). Entity column names use PascalCase to match the
  wire format.

## Personalization (customer app + admin portal)

Both frontends ship a **Settings** surface with live, per-user personalization:

- **Theme** — light / dark / follow-system.
- **Accent colour** — 6 seed colours applied to the whole UI.
- **Background** — selectable tint (both apps; light mode).
- **Font family** — Roboto / Inter / Noto Sans / Noto Sans Devanagari
  (Marathi auto-forces a Devanagari face).
- **Border/corner style** — soft / sharp / pill (radius) across inputs, buttons, cards.
- **Text size** — a scale slider (typography).
- **Language** — **English + Marathi (मराठी)**, fully translated UI.

This covers the full BRIEF §2.5 theming token set (background, border style, font
family, font size, light/dark) for **both** frontends — see
`../guide/08-personalization-status.md` for the spec-to-implementation map.

Customer app: a `SettingsStore` (`shared_preferences`) drives the `MaterialApp`
theme/locale/`textScaler`; choices sync to identity-service via
`PATCH /users/me` (`ThemePrefs` + `PreferredLanguage`) so they follow the
account across devices. Strings live in `lib/l10n/app_{en,mr}.arb` (Flutter
`gen-l10n`). Admin portal: a runes `settings` store + a tiny `i18n` dictionary
apply theme/accent/scale to `<html>` and switch language client-side.

## Out-of-scope (planned, scaffolded)

- BullMQ-on-Redis fan-out for notifications (queue worker is stubbed).
- TypeORM migrations (currently `synchronize: true` per-service).
- OpenTelemetry tracing, audit log UI, offline-first PWA.
