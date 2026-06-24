# Running everything — PT Kharade

This is the practical, copy-paste guide to bring up **all five backend services,
the admin portal, and the customer app** on a local Windows dev box. For
architecture and conventions see [README.md](README.md).

```
identity-service        :4001   auth, users, customers, tenants, branches, RBAC
catalog-pricing-service :4002   items, rate cards, surcharges, /pricing/quote
orders-service          :4003   orders, status workflow, bills
payments-service        :4004   Razorpay / Zohopay + webhooks
notifications-service   :4005   SMS / Email / WhatsApp / FCM
admin-portal            :5173   SvelteKit 2 + Svelte 5 (SSR)
customer-app                    Flutter (Android / iOS / web / desktop)
```

---

## 0. Prerequisites (this machine already has them)

| Tool      | Version present | Needed for           |
| --------- | --------------- | -------------------- |
| Node      | 24.x            | all backends + admin |
| npm       | 11.x            | all backends + admin |
| Flutter   | 3.22+           | customer app only    |
| PostgreSQL| 18 on `:5432`   | all backends         |

> `node_modules` and `.env` are already in place for every service and the admin
> portal, so no `npm install` / `cp .env.example .env` step is needed on this box.

---

## 1. Database (Native Postgres on :5432)

The five services connect to a **local Postgres** at `127.0.0.1:5432` as user
`postgres` (see each `<service>/.env`). All five databases already exist:
`identity_db`, `catalog_pricing_db`, `orders_db`, `payments_db`,
`notifications_db`. Schema is auto-created on boot (`DB_SYNC=true`) — no
migrations to run.

If you ever need to recreate the databases (fresh machine / wiped Postgres):

```powershell
$env:PGPASSWORD = '<your-postgres-password>'   # see DB_PASSWORD in identity-service/.env
foreach ($db in 'identity_db','catalog_pricing_db','orders_db','payments_db','notifications_db') {
    psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE $db;"
}
# pgcrypto / pg_trgm extensions are created by the services as needed; or apply infra/init-db.sql.
```

Verify connectivity:

```powershell
$env:PGPASSWORD = '<your-postgres-password>'
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\l" | Select-String "_db"
```

> The bundled `docker-compose.yml` (Postgres on **:5544**, Redis :6379) is an
> *alternative* to native Postgres and is **not** used in this setup — the
> `.env` files point at the native instance on :5432. Only use docker-compose if
> you switch the `.env` `DB_PORT` to 5544.

Redis is **optional** — without `REDIS_URL`, OTPs/sessions use an in-process
cache (fine for single-instance dev).

---

## 2. Run all backends + admin portal — one command

From `impl/`:

```powershell
.\start-all.ps1
```

This starts each service in **its own PowerShell window**, in the right order
(identity-service first; it seeds the tenant the other seeders depend on), waits
for each `/health-check` to return 200, then launches the admin portal.

Flags:

```powershell
.\start-all.ps1 -NoAdmin       # backends only
.\start-all.ps1 -SkipDbCheck   # skip the Postgres port pre-check
```

To stop: close each service window, or run in `impl/`:

```powershell
Get-Process node | Stop-Process    # stops all node processes (be careful if you run other node apps)
```

### Manual alternative (one terminal per service)

If you prefer manual control, open a terminal per service. **Start
identity-service first and wait for `seed complete`**, then the rest:

```powershell
cd impl\identity-service        ; npm run dev   # wait for "seed complete"
cd impl\catalog-pricing-service ; npm run dev
cd impl\orders-service          ; npm run dev
cd impl\payments-service        ; npm run dev
cd impl\notifications-service   ; npm run dev
cd impl\admin-portal            ; npm run dev   # http://localhost:5173
```

Health checks:

| Service                 | Health URL                            |
| ----------------------- | ------------------------------------- |
| identity-service        | http://localhost:4001/health-check    |
| catalog-pricing-service | http://localhost:4002/health-check    |
| orders-service          | http://localhost:4003/health-check    |
| payments-service        | http://localhost:4004/health-check    |
| notifications-service   | http://localhost:4005/health-check    |
| admin-portal            | http://localhost:5173                 |

---

## 3. Customer app (Flutter)

The customer app reads its API base URLs from `--dart-define` flags, defaulting
to `http://10.0.2.2:<port>` (the Android-emulator alias for host loopback). The
backends must be running first.

**Web / desktop / iOS simulator** (use `localhost`):

```powershell
cd impl\customer-app
flutter pub get
flutter run -d chrome `
  --dart-define=IDENTITY_BASE=http://localhost:4001 `
  --dart-define=CATALOG_PRICING_BASE=http://localhost:4002 `
  --dart-define=ORDERS_BASE=http://localhost:4003 `
  --dart-define=PAYMENTS_BASE=http://localhost:4004 `
  --dart-define=NOTIFICATIONS_BASE=http://localhost:4005
```

**Android emulator** — the defaults (`10.0.2.2`) already work, so just:

```powershell
cd impl\customer-app
flutter pub get
flutter run                      # pick the running emulator
```

**Physical device** — replace the host with your machine's LAN IP, e.g.
`--dart-define=IDENTITY_BASE=http://192.168.1.20:4001` (and so on), and make
sure the device is on the same network.

OTP login in dev: `POST /api/v1/auth/otp/send` returns the generated OTP as
`Data.DevOtp`, so you can log in without an SMS gateway.

---

## 4. Seeded admin (for the admin portal)

```
Email    : admin@ptkharade.in
Phone    : +919999900001
Password : Admin@12345
```

(Override via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD` in
`identity-service/.env`.)

---

## 5. Smoke test (after services are up)

```bash
TOKEN=$(curl -s -X POST -H 'content-type: application/json' \
  -d '{"EmailOrPhone":"admin@ptkharade.in","Password":"Admin@12345"}' \
  http://localhost:4001/api/v1/auth/login | jq -r .Data.AccessToken)

curl -H "authorization: Bearer $TOKEN" \
  'http://localhost:4002/api/v1/catalog/items?Service=DRY_CLEAN'
```

---

## Troubleshooting

| Symptom                                   | Fix                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Service window flashes `ECONNREFUSED`/DB  | Postgres not running on :5432, or wrong `DB_PASSWORD` in `.env`.     |
| Catalog/orders seeder errors on boot      | identity-service wasn't healthy first — restart it, then the rest.  |
| `start-all.ps1` won't run (exec policy)   | `powershell -ExecutionPolicy Bypass -File .\start-all.ps1`          |
| Admin portal can't reach services         | Confirm all five `/health-check` return 200; check `admin-portal/.env` URLs. |
| Customer app (web) network errors         | You used the `10.0.2.2` defaults — pass `localhost` dart-defines (§3). |
| Port already in use                       | Another instance is running; close its window or kill the node PID. |
