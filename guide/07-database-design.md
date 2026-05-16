# Database Design — Master Index

> Companion to [`../BRIEF.md`](../BRIEF.md) §3 (5-service split) and
> [`06-extended-patterns.md`](06-extended-patterns.md) (the deep-dive findings
> all of these tables draw on).
>
> This index lays out the **conventions, cross-service contracts, and seed-data
> contract** for the full schema. Per-service DDL + ER lives in
> [`db/01–05`](db/).
>
> **Equivalent to BRIEF deliverable #2** (`./out/docs/02-data-model.md`) — once
> approved, this directory is what the data-model deliverable ships.

---

## 1. Service split and database boundaries

PT Kharade runs **five logical services**, each owning its own Postgres
schema. In phase 1 they share a single Postgres cluster with one schema per
service (cheap, single VPS); in phase 7+ each schema can move to its own
cluster without code changes.

```
postgres://pt_kharade:****@host:5432/
  ├── identity_db
  ├── catalog_pricing_db
  ├── orders_db
  ├── payments_db
  └── notifications_db
```

| Service                  | Schema doc                                                | Owns                                                                                              |
|--------------------------|-----------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| `identity-service`       | [`db/01-identity-schema.md`](db/01-identity-schema.md)    | Tenants, branches, users, OAuth, devices, MFA, roles & permissions, customers, vendors, addresses, audit log, client-app keys |
| `catalog-pricing-service`| [`db/02-catalog-pricing-schema.md`](db/02-catalog-pricing-schema.md) | Item categories, items, variants, rate cards, vendor rate overrides, surcharge config, tax codes, subscription plans, discounts |
| `orders-service`         | [`db/03-orders-schema.md`](db/03-orders-schema.md)        | Orders, order items, status history, activities, reviews, subscriptions, preparation batches, slot capacity, full delivery domain (zones, hubs, partners, slots, charges, assignments) |
| `payments-service`       | [`db/04-payments-schema.md`](db/04-payments-schema.md)    | Bills, bill lines, recurring invoices, payments + state machine, refunds, webhook events (idempotency), payment methods, wallets, wallet transactions, vendor settlements, settlement transactions |
| `notifications-service`  | [`db/05-notifications-schema.md`](db/05-notifications-schema.md) | Notification templates, dispatch attempts, user preferences, in-app inbox, contact-us, terms & policies (CMS), generated-PDF index |

**Shared infrastructure tables (every service):**
- `event_store` — outbox for the pluggable broker (charqol pattern, [`06`](06-extended-patterns.md) §11/charqol)
- `idempotency_keys` — DB-backed idempotency middleware ([`06`](06-extended-patterns.md) §7)

These are defined once at the bottom of this index (Section 6) and instantiated identically per service.

---

## 2. Cross-service reference contracts

Services do **not** join across databases. Foreign-shaped columns (`customer_id`,
`item_id`, etc.) refer to entities owned by another service — these are stored
as **UUID-only references, no DB-level foreign key constraint**. Integrity is
maintained via:
1. **Domain events** ([`01-backend.md`](01-backend.md) §10) — when `users.user.deleted`
   fires, every service listens and soft-deletes its dependent rows.
2. **Read-time validation** — services treat unknown referenced IDs as orphans
   and surface them in a daily reconciliation report.

```
identity-service ──(user_id, customer_id, vendor_id)──────► orders-service
                                                            │
                                                            │ order_id, bill_id, subscription_id
                                                            ▼
catalog-pricing-service ──(item_id, plan_id, rate_card_id)─► orders-service
                                                            │
                                                            │ events
                                                            ▼
                                                       payments-service ──► notifications-service
                                                       (webhook events)    (user_id, channel,
                                                                            template_key, data)
```

| From service       | Column                  | Refers to                                          | Resolved via                              |
|--------------------|-------------------------|----------------------------------------------------|-------------------------------------------|
| orders             | `"CustomerId"`          | `identity_db.customers.id`                          | sister-service API `GET /customers/:id` (cached) |
| orders             | `"VendorId"` (nullable) | `identity_db.customers.id` with `"CustomerType" = 'Vendor'` | same                                     |
| orders             | `"BranchId"`            | `identity_db.branches.id`                            | configured at boot                        |
| orders             | `"ItemId"`              | `catalog_pricing_db.items.id`                        | sister-service API + Redis cache (1 h)    |
| orders             | `"AppliedPlanId"`       | `catalog_pricing_db.subscription_plans.id`          | sister-service API                        |
| orders             | `"RateCardId"`          | `catalog_pricing_db.rate_cards.id`                  | sister-service API                        |
| orders             | `"AddressId"`           | `identity_db.customer_addresses.id`                 | sister-service API                        |
| payments           | `"OrderId"`, `"BillId"` | `orders_db.orders.id`, `payments_db.bills.id`       | local in payments (bills are owned here)  |
| payments           | `"CustomerId"`          | `identity_db.customers.id`                           | sister-service API                        |
| notifications      | `"UserId"`              | `identity_db.users.id`                               | sister-service API                        |
| notifications      | `"OrderId"`, `"BillId"` | upstream                                            | sister-service API                        |

**Naming rule:** every cross-service ID column has a `Cross-service` note in
that table's "notes" cell so this contract is self-documenting in the DDL.

---

## 3. Schema conventions (apply to every table)

### 3.1 Naming
- **Tables**: `snake_case_plural`, unquoted — `orders`, `delivery_partners`, `wallet_transactions`. TypeORM `@Entity({ name: 'orders' })`.
- **Columns**: **PascalCase, double-quoted** — `"CreatedAt"`, `"TenantId"`, `"CustomerCode"`. Matches the charqol/kleo entity pattern (PascalCase TypeScript property → PascalCase Postgres identifier). Without quotes Postgres folds to lowercase, so **every column reference in raw SQL must be double-quoted**.
- **Primary key**: `id` (lowercase, unquoted) — TypeORM `@PrimaryGeneratedColumn('uuid')` default; deliberately the one exception.
- **Index name**: `ix_<table>_<col1>_<col2>` for non-unique, `ux_<table>_<col1>_<col2>` for unique. (Index names stay lowercase/snake_case — they're Postgres-internal, not entity-mapped.)
- **Foreign key constraint name**: `fk_<table>_<col>_<ref_table>`.
- **CHECK constraint name**: `ck_<table>_<intent>`.
- **Enum types**: lowercase snake_case with `_enum` suffix — `order_status_enum`, `payment_state_enum`. TypeORM default; no quoting needed.

### 3.2 Required columns on every business table

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
"TenantId"    UUID NOT NULL,                              -- = organisation; default = seeded PT Kharade Group of Industries
"BranchId"    UUID NOT NULL,                              -- = shop; default = seeded Mukundnagar shop
"CreatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
"UpdatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
"DeletedAt"   TIMESTAMPTZ,                                -- null = not deleted (soft delete)
"CreatedBy"   UUID,                                       -- UserId (cross-service ref)
"UpdatedBy"   UUID                                        -- UserId (cross-service ref)
```

Composite index `ix_<table>_tenant_branch` on `("TenantId", "BranchId")` is **mandatory** unless the table is platform-level (tenants, branches, tax_codes, system templates).

**Lookup/master tables exception:** roles, permissions, tax_codes, item_categories — `"TenantId"` and `"BranchId"` may be optional/null for platform-shared rows; document explicitly per table.

### 3.3 UUID generation
- Postgres `gen_random_uuid()` from `pgcrypto` (`CREATE EXTENSION IF NOT EXISTS pgcrypto;` in `0001_init.sql`).
- All IDs are UUID v4. Never auto-incrementing integers (kills sharding + leaks volume).

### 3.4 Timestamps
- **Always `TIMESTAMPTZ`** (timezone-aware). Store UTC; render IST in clients (Asia/Kolkata).
- `created_at`, `updated_at` populated by TypeORM `@CreateDateColumn` / `@UpdateDateColumn`. No app-level writes.

### 3.5 Money
- Store as **`NUMERIC(15, 2)`** for INR (15 digits total, 2 after the decimal). Range covers up to ₹9,999,999,999,999.99 — comfortable.
- Never store in paise as int64 (Razorpay returns paise; convert at the boundary). Rationale: spreadsheets and SQL reports stay human-readable.
- Currency code column where multi-currency matters: `"Currency" CHAR(3) NOT NULL DEFAULT 'INR'`.

### 3.6 Phone & email
- `"Phone" VARCHAR(20)` storing in E.164 format `+91XXXXXXXXXX`. Validate at the app boundary.
- `"Email" VARCHAR(255)` lowercased on save. CITEXT (`pgcrypto`-free) or app-side lowercase.

### 3.7 Enums
- Postgres native enums (`CREATE TYPE ... AS ENUM (...)`). Generated by TypeORM.
- Never re-order enum members (causes Postgres re-cluster); only append.
- Mirror as TypeScript enum in `src/domain.types/enums/`.

### 3.8 JSON columns
- Use `JSONB` (not `JSON`) — gives indexing, faster reads.
- Use sparingly: only for free-shaped data (audit before/after diffs, webhook payloads, theme tokens, notification template variables).
- Index a JSONB column with GIN if it gets queried: `CREATE INDEX ... ON table USING gin (col jsonb_path_ops);`

### 3.9 Soft delete
- `"DeletedAt" TIMESTAMPTZ NULL`. TypeORM `@DeleteDateColumn`.
- Every read query filters `WHERE "DeletedAt" IS NULL` automatically via TypeORM defaults; explicit `.withDeleted()` for admin recovery.
- Composite unique indexes that should still allow soft-deleted reuse: include `"DeletedAt"` in the index or use partial index `WHERE "DeletedAt" IS NULL`. Documented per table.

### 3.10 Audit `"CreatedBy"` / `"UpdatedBy"`
- Populated by a small Express middleware that reads `req.currentUser.UserId` and attaches to TypeORM subscriber. Reference: `D:\Rean\reancare-service\src\auth\custom\`.

### 3.11 Indexes
- Index every FK column.
- Index every column used in a WHERE that ships in a paginated list (e.g. `orders."Status"`, `orders."PromisedPickupAt"`).
- Avoid over-indexing on write-heavy tables (`order_status_history`, `wallet_transactions`, `audit_entries`) — write cost > read cost.

### 3.12 Partial indexes for common predicates
```sql
CREATE INDEX ix_orders_active ON orders ("CreatedAt") WHERE "DeletedAt" IS NULL AND "Status" NOT IN ('Closed','Cancelled');
CREATE INDEX ix_subscriptions_active ON subscriptions ("NextInvoiceDate") WHERE "Status" = 'Active' AND "DeletedAt" IS NULL;
```

### 3.13 GIN trigram for fuzzy search
For customer name / phone search (receptionist screen, BRIEF deliverable #11):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_customers_name_trgm ON customers USING gin ("Name" gin_trgm_ops);
CREATE INDEX ix_customers_phone_trgm ON customers USING gin ("Phone" gin_trgm_ops);
```

### 3.14 Multi-tenancy enforcement (RLS, optional phase 7)
For phase 7 multi-branch readiness, enable Row-Level Security:
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_tenant_iso ON orders
  USING ("TenantId" = current_setting('app.tenant_id')::uuid
     AND "BranchId" = current_setting('app.branch_id')::uuid);
```
App sets `app.tenant_id` / `app.branch_id` per session via `SET LOCAL`. Off by default in phase 1 to avoid early surprises.

---

## 4. ER overview (cross-service)

```mermaid
erDiagram
  TENANT ||--o{ BRANCH : has
  BRANCH ||--o{ USER : employs
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : has
  ROLE ||--o{ ROLE_PERMISSION : has
  PERMISSION ||--o{ ROLE_PERMISSION : has

  USER ||--o| CUSTOMER : "may-be"
  USER ||--o{ USER_DEVICE : owns
  USER ||--o| USER_MFA : "may-have"
  USER ||--o{ USER_OAUTH : "may-have"
  CUSTOMER ||--o{ CUSTOMER_ADDRESS : has
  CUSTOMER ||--o{ VENDOR_BANK_ACCOUNT : "if-vendor"

  ITEM_CATEGORY ||--o{ ITEM : groups
  ITEM ||--o{ ITEM_VARIANT : "may-have"
  ITEM ||--o{ RATE_CARD : priced-in
  RATE_CARD ||--o{ VENDOR_RATE_OVERRIDE : "may-override"
  SUBSCRIPTION_PLAN ||--o{ PLAN_BENEFIT : grants
  DISCOUNT ||--o{ DISCOUNT_USAGE : used-as

  CUSTOMER ||--o{ ORDER : places
  ORDER ||--o{ ORDER_ITEM : contains
  ORDER ||--o{ ORDER_STATUS_HISTORY : has
  ORDER ||--o{ ORDER_ACTIVITY : has
  ORDER ||--o| ORDER_REVIEW : "may-have"
  ORDER ||--|| BILL : invoiced-as
  BILL ||--o{ BILL_LINE : has
  BILL ||--o{ PAYMENT : "may-be-paid-by"
  ORDER }|--|| DELIVERY_SLOT : booked-in
  ORDER }o--|| DELIVERY_PARTNER : "may-be-assigned"
  ORDER ||--o{ ORDER_NOTE : has

  CUSTOMER ||--o{ SUBSCRIPTION : holds
  SUBSCRIPTION_PLAN ||--o{ SUBSCRIPTION : is-a
  SUBSCRIPTION ||--o{ SUBSCRIPTION_ITEM : has
  SUBSCRIPTION ||--o{ RECURRING_INVOICE : generates

  DELIVERY_ZONE ||--o{ DELIVERY_SOCIETY : contains
  DELIVERY_ZONE ||--o{ PARTNER_ZONE_ASSIGNMENT : covers
  DELIVERY_PARTNER ||--o{ PARTNER_ZONE_ASSIGNMENT : "works-in"
  DELIVERY_SLOT ||--o{ PARTNER_SLOT_ASSIGNMENT : "covered-by"
  DELIVERY_PARTNER ||--o{ PARTNER_SLOT_ASSIGNMENT : "works-in"
  DELIVERY_HUB ||--o{ DELIVERY_PARTNER : "based-at"

  PREPARATION_BATCH ||--o{ PREPARATION_BATCH_ITEM : has

  PAYMENT ||--o{ PAYMENT_EVENT : has
  PAYMENT ||--o{ REFUND : "may-have"
  WALLET ||--o{ WALLET_TRANSACTION : has
  WALLET_TRANSACTION }o--o| ORDER : refers-to
  WALLET_TRANSACTION }o--o| SUBSCRIPTION : refers-to
  VENDOR_SETTLEMENT ||--o{ SETTLEMENT_TRANSACTION : has

  USER ||--o{ IN_APP_NOTIFICATION : "receives"
  NOTIFICATION_TEMPLATE ||--o{ NOTIFICATION_ATTEMPT : rendered-from
  USER ||--o| USER_NOTIF_PREF : has
```

(Per-service ER diagrams in each `db/0X-*.md` are the authoritative ones; this
is the cross-service summary.)

---

## 5. Per-service tables — at a glance

| Service               | # tables | Detail file                                                        |
|-----------------------|----------|--------------------------------------------------------------------|
| identity              | 14       | [`db/01-identity-schema.md`](db/01-identity-schema.md)             |
| catalog-pricing       | 12       | [`db/02-catalog-pricing-schema.md`](db/02-catalog-pricing-schema.md)|
| orders                | 22       | [`db/03-orders-schema.md`](db/03-orders-schema.md)                 |
| payments              | 14       | [`db/04-payments-schema.md`](db/04-payments-schema.md)             |
| notifications         | 7        | [`db/05-notifications-schema.md`](db/05-notifications-schema.md)   |
| shared (per service)  | 2        | Section 6 below                                                    |
| **Total**             | **~71**  |                                                                    |

---

## 6. Shared infrastructure tables (defined once, deployed in every service DB)

### 6.1 `event_store` (outbox)

Source pattern: `D:\charqol\user-service\src\events\event.emitter.ts` — emits domain events with the outbox pattern.

| Field             | Type              | Constraints                                          | Notes                                                                  |
|-------------------|-------------------|------------------------------------------------------|------------------------------------------------------------------------|
| `id`              | UUID              | PK                                                   | Event id, propagates to subscribers                                    |
| `Topic`           | VARCHAR(128)      | NOT NULL                                             | `orders.order.created`                                                 |
| `EventType`       | VARCHAR(64)       | NOT NULL                                             | Subset of topic; coarse handlers                                       |
| `Version`         | INT               | NOT NULL DEFAULT 1                                   |                                                                        |
| `Source`          | VARCHAR(64)       | NOT NULL                                             | `orders-service`                                                       |
| `CorrelationId`   | UUID              | NOT NULL                                             | Joins to logger correlation id                                          |
| `TenantId`        | UUID              |                                                      | Cross-service                                                          |
| `UserId`          | UUID              |                                                      | Cross-service                                                          |
| `Payload`         | JSONB             | NOT NULL                                             |                                                                        |
| `Status`          | event_status_enum | NOT NULL DEFAULT 'Pending'                           | `Pending / Published / Acked / Failed`                                  |
| `Retries`         | INT               | NOT NULL DEFAULT 0                                   |                                                                        |
| `LastError`       | TEXT              |                                                      |                                                                        |
| `PublishedAt`     | TIMESTAMPTZ       |                                                      | Set after broker publish                                               |
| `CreatedAt`       | TIMESTAMPTZ       | NOT NULL DEFAULT now()                               |                                                                        |

```sql
CREATE TYPE event_status_enum AS ENUM ('Pending','Published','Acked','Failed');

CREATE TABLE event_store (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Topic"         VARCHAR(128) NOT NULL,
  "EventType"     VARCHAR(64)  NOT NULL,
  "Version"       INT          NOT NULL DEFAULT 1,
  "Source"        VARCHAR(64)  NOT NULL,
  "CorrelationId" UUID         NOT NULL,
  "TenantId"      UUID,
  "UserId"        UUID,
  "Payload"       JSONB        NOT NULL,
  "Status"        event_status_enum NOT NULL DEFAULT 'Pending',
  "Retries"       INT          NOT NULL DEFAULT 0,
  "LastError"     TEXT,
  "PublishedAt"   TIMESTAMPTZ,
  "CreatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_event_store_status_created ON event_store ("Status", "CreatedAt") WHERE "Status" IN ('Pending','Failed');
CREATE INDEX ix_event_store_topic_created  ON event_store ("Topic", "CreatedAt");
```

### 6.2 `idempotency_keys`

Source: `D:\charqol\payroll-service\src\common\idempotency\idempotency.middleware.ts`.

| Field               | Type             | Constraints                                  | Notes                                                                  |
|---------------------|------------------|----------------------------------------------|------------------------------------------------------------------------|
| `IdempotencyKey`    | UUID             | PK                                           | Client-supplied `Idempotency-Key` header                                |
| `UserId`            | UUID             | NOT NULL                                     | Scoped per user; cross-service                                          |
| `Route`             | VARCHAR(255)     | NOT NULL                                     | `POST /orders`                                                          |
| `RequestBodyHash`   | VARCHAR(64)      | NOT NULL                                     | SHA-256 of body — protects against same-key/different-body abuse        |
| `IsProcessing`      | BOOLEAN          | NOT NULL DEFAULT TRUE                        | Set to false when handler returns; in-flight ⇒ duplicate gets 409       |
| `ResponseStatus`    | INT              |                                              | Cached final HTTP status                                                |
| `ResponseBody`      | JSONB            |                                              | Cached final body                                                       |
| `CreatedAt`         | TIMESTAMPTZ      | NOT NULL DEFAULT now()                       |                                                                        |
| `ExpiresAt`         | TIMESTAMPTZ      | NOT NULL                                     | Set to `CreatedAt + 24h`; cleanup job removes after                    |

```sql
CREATE TABLE idempotency_keys (
  "IdempotencyKey"  UUID PRIMARY KEY,
  "UserId"          UUID         NOT NULL,
  "Route"           VARCHAR(255) NOT NULL,
  "RequestBodyHash" VARCHAR(64)  NOT NULL,
  "IsProcessing"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "ResponseStatus"  INT,
  "ResponseBody"    JSONB,
  "CreatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "ExpiresAt"       TIMESTAMPTZ  NOT NULL
);

CREATE INDEX ix_idempotency_keys_expires ON idempotency_keys ("ExpiresAt");
```

Cleanup BullMQ job hourly: `DELETE FROM idempotency_keys WHERE "ExpiresAt" < now();`.

---

## 7. Migration strategy

- **Tool**: TypeORM migrations (the reference repos rely on `synchronize: true` — fine for dev, **never for prod**).
- **One migration file per atomic change**: `migrations/<timestamp>__<verb>_<noun>.ts`.
- **Order of initial migrations** per service:
  1. `0001_init.sql` — extensions (`pgcrypto`, `pg_trgm`), enums, shared tables (`event_store`, `idempotency_keys`)
  2. `0002_create_master.sql` — tenants/branches/roles/permissions (identity); item_categories/tax_codes (catalog) etc.
  3. `0003_create_<aggregate>.sql` — one file per aggregate root
  4. `0010_seed.sql` — seeded reference data (the rates from BRIEF §2.3, the role privileges, etc.)
- **Never run `synchronize: true` in staging or prod**. Set explicitly in env: `DB_SYNCHRONIZE=false`.
- **Schema diff in CI**: each PR runs `typeorm schema:log` against an empty DB after applying all migrations; the diff must be empty (catches "I forgot to write a migration").

---

## 8. Seed data inventory

Per the rean pattern (`D:\Rean\reancare-service\seed.data\` + `src\startup\seeder.ts`), each service has a `seed.data/` folder loaded at first boot.

| Service          | Seed files                                                                                                              |
|------------------|-------------------------------------------------------------------------------------------------------------------------|
| identity         | `tenants.seed.json`, `branches.seed.json`, `roles.seed.json`, `permissions.seed.json`, `role_privileges/<role>.json`, `system_admin.seed.json`, `client_apps.seed.json` |
| catalog-pricing  | `item_categories.seed.json`, `items.seed.json`, `tax_codes.seed.json`, **`rate_cards.seed.json`** (BRIEF §2.3 — deliverable #14), `surcharge_config.seed.json`, `subscription_plans.seed.json`, sample `discounts.seed.json` |
| orders           | `delivery_zones.seed.json` (Pune zones), `delivery_hubs.seed.json` (Mukundnagar), `delivery_slots.seed.json` (morning/afternoon/evening windows) |
| payments         | (none — operational data only)                                                                                          |
| notifications    | **`notification_templates/<key>.<lang>.json`** — every template in en + mr, BRIEF §2.5                                  |

BRIEF deliverable #14 (`rates.seed.ts`) maps to `catalog-pricing` service's `rate_cards.seed.json` — produced verbatim from BRIEF §2.3 tables.

---

## 9. Backup & retention

| Data class                              | Hot retention            | Cold retention           | Backup cadence    |
|-----------------------------------------|--------------------------|--------------------------|-------------------|
| Orders + Bills (regulatory)             | 2 years live             | **8 years** in S3 cold   | Daily snapshot    |
| Payments + Refunds                      | 2 years live             | 8 years in S3 cold       | Daily snapshot    |
| Audit log                               | 180 days live            | 5 years S3 cold          | Daily archive job |
| Order activity (customer timeline)      | Forever (small footprint)| —                        | Daily snapshot    |
| Sessions (Redis)                        | TTL 1 h                  | —                        | None              |
| OTP (Redis)                             | TTL 5 min                | —                        | None              |
| Event store                             | 90 days                  | Optional cold for replay | Weekly archive    |
| Idempotency keys                        | 24 h (TTL via expires_at)| —                        | None              |
| Webhook event payloads (payments)       | 90 days hot              | 1 year cold              | Weekly archive    |

Indian Income Tax Act mandates 8 years on financial records — drives the 8-year cold tier on Orders, Bills, Payments.

---

## 10. Production checklist (DB)

Before going live:
- [ ] All migrations applied; `synchronize: false` in prod env
- [ ] `pgcrypto` and `pg_trgm` extensions installed in every service DB
- [ ] Connection pool: `max=20` per service instance (~80 total at 4 services × 1 instance; raise per scale)
- [ ] PgBouncer in transaction mode in front of Postgres if running > 2 instances per service
- [ ] WAL archiving on; daily snapshots replicated off-host
- [ ] PITR (point-in-time recovery) tested at least once before launch
- [ ] Long-query monitor (Datadog / pg_stat_statements) wired
- [ ] Row counts of seed tables match expected counts (smoke test)
- [ ] RLS optional; defer to phase 7 with multi-branch
- [ ] Secrets in env, never in `service.config.json` (in repo)
- [ ] `DEFAULT now()` on every `*_at` column — verified via `\d <table>` in psql

---

*Master index ends here. Open the per-service docs in `db/` for the actual DDL,
table-by-table.*
