# Extended Patterns — Second-Pass Findings

> A second deep-dive on `D:\Batterlicious` and `D:\charqol` surfaced features that
> the first pass missed. This file is a **focused catalogue** of those patterns,
> grouped by concern, with absolute paths and short notes on how each maps to a
> PT Kharade requirement.
>
> When a section here contradicts something in `01–05`, **this file wins** — it
> is based on the more thorough survey. Notable corrections:
> - **Idempotency is DB-backed** (TypeORM table), not Redis. Updated in [`§7`](#7-idempotency-db-backed-not-redis).
> - **MFA / OAuth flows exist** in charqol user-service — full TOTP + provider stack. See [`§8`](#8-mfa--oauth-charqol).
> - **OpenTelemetry is already wired** in charqol services via the `@Trace()` decorator. See [`§11`](#11-observability--opentelemetry).

---

## 1. Subscriptions — pause / resume / day-of-week (Batterlicious)

Batterlicious's subscription module is **substantially richer** than first reported. Adopt it nearly verbatim — it is a direct fit for BRIEF §2.4 (laundry subscriptions).

**Entities:**
- `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\subscription.entity.ts`
- `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\subscription.item.entity.ts`

**Key fields to adopt on `Subscription`:**

| Field                  | Type        | Why it matters for PT Kharade                                                                       |
|------------------------|-------------|-----------------------------------------------------------------------------------------------------|
| `Status`               | enum        | `Active / Paused / Cancelled / Expired`                                                              |
| `StartDate`, `EndDate` | date        | Plan duration window (monthly / quarterly / half-yearly / yearly)                                   |
| `TotalAmount`          | decimal     | Full plan price                                                                                     |
| `WalletPaidAmount`     | decimal     | Split-payment portion paid from wallet                                                              |
| `GatewayPaidAmount`    | decimal     | Split-payment portion paid via Razorpay/Zoho                                                        |
| `PaymentStatus`        | enum        | `Pending / Completed`                                                                                |
| `PausedAt`             | timestamp   | Set when customer pauses (vacation, festival)                                                       |
| `ResumedAt`            | timestamp   | Set on resume                                                                                       |
| `TotalPausedDays`      | int         | Cumulative — extends `EndDate` by this many days                                                    |
| `SelectedDays`         | int[] / str | Day-of-week mask (e.g., Mon/Wed/Fri pickup); critical for "weekly laundry pickup" plans             |
| `DeliverySlotId`       | FK          | Fixed slot binding so the customer doesn't re-pick every week                                       |

**Behaviour to mirror:**
- **Pause**: stop generating orders; on `Resume`, extend `EndDate` by elapsed paused days.
- **Day-of-week selection**: a background BullMQ job (`subscription-orders-generator`, daily 22:00 IST) reads active subscriptions, finds those whose `SelectedDays` contains tomorrow, and pre-creates draft orders for next-day pickup.
- **Split payment**: `WalletPaidAmount + GatewayPaidAmount = TotalAmount`. Use the wallet first, fall back to gateway. Records two `WalletTransaction` rows + one `Payment` row.

**Admin pages** (SvelteKit):
- `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\orders\subscriptions\+page.svelte` — admin overview
- `D:\Batterlicious\admin-portal\src\routes\users\vendor\[userId]\orders\subscriptions\+page.svelte` — vendor fulfilment view (relevant if a vendor manages branch deliveries later)

**Customer app pages** (MAUI — port to Flutter):
- `CreateSubscriptionPage.xaml` → `lib/features/subscriptions/create_screen.dart`
- `MySubscriptionsPage.xaml` → `lib/features/subscriptions/list_screen.dart`
- `SubscriptionDetailsPage.xaml` → `lib/features/subscriptions/detail_screen.dart` (pause/resume/cancel buttons)

**Recurring billing job** — see Charqol's `RecurringInvoiceController` in [`§12`](#12-recurring-invoices-charqol-accounting) for the invoice-generation half.

---

## 2. Delivery management — full domain (Batterlicious)

The first pass under-reported this. Batterlicious models **eight** delivery sub-domains; PT Kharade needs roughly **five** (zones, slots, partners, charges, assignments) and can defer hubs + buildings + society to phase 7.

| Sub-domain         | Entity                                                                                                     | Purpose                                                                |
|--------------------|------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| **Zones**          | `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\delivery.zones.entity.ts`              | Geographic region (Name, Code, Coverage, IsActive)                     |
| **Society**        | `delivery.society.entity.ts`                                                                                | Residential community in a zone (Lat/Long, IsActive)                   |
| **Buildings**      | `delivery.buildings.entity.ts`                                                                              | Building within a society (FloorCount, FlatCount)                      |
| **Hubs**           | `delivery.hub.entity.ts`                                                                                    | Distribution centre (Manager, Address, City, Pincode)                  |
| **Partners**       | `delivery.partner.entity.ts`                                                                                | Delivery person (VehicleType, VehicleNo, LicenseNo, CoverageAreas, Rating, ShiftPreference, MaxDeliveriesPerDay, IsAvailable, TotalDeliveries) |
| **Slots**          | `delivery.slot.entity.ts`                                                                                   | Time window (StartTime, EndTime, MaxOrders, CurrentOrders, SlotName)   |
| **Charges**        | `delivery.charges.entity.ts`                                                                                | Per-order: UserId, DistanceKm, DeliveryChargeRateId, FinalCharge       |
| **Charge Rate**    | `delivery.charge.rate.entity.ts`                                                                            | Tiered rate table (ServiceType, MinDistance, MaxDistance, BaseCharge, ChargePerKm) — BRIEF §2.3 default ₹40 fits in the lowest bracket |
| **Assignments**    | `delivery.assignments.entity.ts`, `partner.zone.assignments.entity.ts`, `partner.slot.assignments.entity.ts` | Order → Partner; Partner → Zones; Partner → Slots                    |

**Slot capacity** (very useful for PT Kharade): `Slot.MaxOrders` + `Slot.CurrentOrders`. When booking a pickup or delivery, atomically check `CurrentOrders < MaxOrders` and increment in the same transaction. Reject the slot in the UI when full.

**Delivery charge calculation:**
```
final_charge = base_charge + (charge_per_km × distance_km)
```
Look up `delivery.charge.rate` row where `DistanceKm BETWEEN MinDistance AND MaxDistance` for the given `ServiceType`. For PT Kharade phase 1, keep it simple — one row with `(0, 5, 40, 0)`; the BRIEF's flat ₹40 fits.

**Distance:** `Address.Latitude`, `Address.Longitude` (decimal 10,7) → nearest hub Haversine distance. Both Batterlicious and our schema must carry lat/long on every address.

**Admin x-components** (`D:\Batterlicious\admin-portal\src\lib\x-components\delivery-management\`):
- `DeliveryTabBar.svelte`, `DeliveryStatsCard.svelte`
- `HubSelector.svelte`, `SlotSelector.svelte`
- `PartnerDetailModal.svelte`, `DeliveryAssignmentModal.svelte`
- `ZoneDetailModal.svelte`, `AssignSlotModal.svelte`, `AssignZoneModal.svelte`

Adopt these wholesale for BRIEF deliverable #12 (System Admin screens — vendor/delivery management).

---

## 3. Preparation batches → Laundry processing batches (Batterlicious)

**Entity:** `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\preparation.batch.entity.ts` + `preparation.items.entity.ts`.

**Fields:** `BatchId`, `DeliverySlot`, `Status` (`pending / in-prep / prepared / expired`), `TotalItems`, `PreparedItems`, `PendingItems`, `StartedAt`, `CompletedAt`.

**Direct PT Kharade mapping:** a "preparation batch" is a **laundry processing batch** — multiple orders queued for the same wash cycle. The batch entity gives operators (admin/manager) a way to:
- Group several orders into one wash load
- Track wash → dry → press → fold per batch
- Block new orders from joining a batch once it's `in-prep`

**Status flow for laundry:** `Pending → Sorting → Washing → Drying → Ironing → QualityCheck → ReadyForDelivery`.

**Implementation note:** this is **not** in the BRIEF but is a high-value addition that maps perfectly to a real laundry shop floor. Suggest including in phase 7 hardening, or surface in BRIEF deliverable #1 as an "optional capability".

---

## 4. Product daily capacity + order cutoff (Batterlicious)

**Highly relevant** for laundry — there's a per-day limit on how many shirts the shop can iron, and a cutoff after which today's slot is closed.

**Entities:**
- `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\product.daily.capacity.entity.ts` — `MaxQuantity`, `Unit`, `DeliverySlot`, `DeliveryDate` (UNIQUE composite). Prevents overselling.
- `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\order.cutoff.entity.ts` — `CalculatedCutoffTime`, `BasedOnProductId`, `IsBlocked`, `BlockedReason`.

**For PT Kharade:**
- `ItemDailyCapacity { itemId, serviceType, date, slotId, maxQty, bookedQty }`
- `OrderCutoff { slotId, date, cutoffTime, isBlocked }` — if `cutoffTime < now()`, hide the slot in customer-app booking.
- Use Redis cache for hot lookups during slot-selection screen.

---

## 5. Discount engine (Batterlicious)

**Entity:** `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\discounts.entity.ts`.

| Field                  | Type          | PT Kharade use case                                              |
|------------------------|---------------|------------------------------------------------------------------|
| `DiscountName`         | string        | "Diwali 20% off", "Vendor 1000+ pieces"                          |
| `DiscountType`         | enum          | `Percent / Flat / FreeItem / FreePickup`                          |
| `DiscountValue`        | number        | 20 (for 20%) or 100 (for ₹100 flat)                              |
| `MaxDiscountAmount`    | decimal       | Cap percentage discounts                                         |
| `MinPurchaseAmount`    | decimal       | Eligibility threshold                                            |
| `ApplicableTo`         | enum          | `Order / Product / Category` — granular targeting                |
| `CouponCode`           | string        | Customer-entered coupon                                          |
| `UsageLimit`           | int           | Total redemption cap (per coupon) — implement total + per-user   |
| `ValidFrom`, `ValidTo` | timestamp     | Campaign window                                                  |
| `VendorId`             | FK (nullable) | Vendor-specific discount (B2B contract pricing)                  |

**Usage tracking:** `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\discount.usage.entity.ts` — every redemption logged with `DiscountAmount`, `UsedAt`, `OrderId`. Use for fraud detection and analytics.

**Composition rule (recommend):** subscription discount applies **first** to per-item rates, then coupon discount applies to the subtotal, then surcharges (delivery, express, GST) layer on top. Document this in `02-data-model.md`.

**Offer banners** (CMS-style) — `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\offer.entity.ts`. Title, subtitle, image, ButtonText, ActionUrl. Promotional only, no discount logic — admin uploads, customer app renders on home screen.

---

## 6. Wallet — store credit / prepaid (Batterlicious)

**Useful for two things in PT Kharade:**
1. Refunds — if a customer cancels an already-paid order, credit the refund to wallet instead of bank reversal (faster, cheaper).
2. **Vendor credit limit** for B2B (BRIEF §2.1) — model the credit limit as a *negative wallet floor*; vendor balance goes negative up to `-CreditLimit`.

**Entities:**
- `wallet.entity.ts` — `Balance`, `TotalCredited`, `TotalDebited`, `IsActive`
- `wallet.transactions.entity.ts` — full audit: `TransactionType (Debit/Credit)`, `Amount`, `Description`, `PaymentMethod`, `TransactionStatus`, `BalanceBefore`, `BalanceAfter`, `ReferenceType (Order|Subscription|TopUp|Refund)`, `OrderId/SubscriptionId` FK

**Invariant:** every wallet transaction snapshots `BalanceBefore` and `BalanceAfter` — never trust real-time aggregation when reconciling.

**Customer app page:** `BLWalletPage.xaml` → Flutter `lib/features/wallet/wallet_screen.dart` showing balance + top-up + transaction list.

---

## 7. Idempotency — DB-backed, NOT Redis (charqol)

**Correction to `01-backend.md` §8.** First pass assumed Redis; the reference repo uses **TypeORM table-backed idempotency**.

**File:** `D:\charqol\payroll-service\src\common\idempotency\idempotency.middleware.ts` + `idempotency.service.ts`.

**Algorithm:**
1. Header: `Idempotency-Key` (UUID v4; rejected if format invalid)
2. Middleware applied to **POST** routes only when env `IDEMPOTENCY_ENABLED === 'true'`
3. On first request: insert row `{ idempotencyKey, userId, isProcessing: true, requestBody }`. Intercept `response.json()` to write `{ responseStatus, responseBody, isProcessing: false }` post-handler.
4. On duplicate while still processing → return **409 Conflict**.
5. On duplicate after complete → **replay the cached response** (same status + body).
6. **Cleanup:** dedicated scheduled job `cleanupExpiredIdempotencyKeys()` removes rows after their TTL.

**Why DB-backed (not Redis):** survives Redis restart; replay must be exact, so persistence is a feature not a cost; payment webhooks need this guarantee.

**Mount:**
```ts
import { createIdempotencyMiddleware } from './common/idempotency/idempotency.middleware';
app.use('/api/v1/payments', createIdempotencyMiddleware(dataSource));
```

**PT Kharade scope:** apply to payments webhooks and to `POST /orders` (so flaky mobile networks don't create duplicate orders on retry).

---

## 8. MFA + OAuth (charqol user-service)

The first pass said "JWT auth" — but the charqol stack has a **full MFA and OAuth implementation** ready to copy.

**MFA (TOTP + backup codes):** `D:\charqol\user-service\src\api\users\mfa\mfa.controller.ts`
- `POST /users/mfa/setup-totp` → returns QR code as `data:image/png;base64,...` + temporary secret
- `POST /users/mfa/verify-totp-setup` → confirms with 6-digit code, persists secret on user
- `POST /users/mfa/validate` → during login second step; accepts TOTP code or backup code
- `POST /users/mfa/disable` → re-prompts password + TOTP
- `POST /users/mfa/backup-codes` → regenerates 10 single-use codes

**PT Kharade application:** **System Admin role only** must enable MFA (settings page). Receptionist and Customer roles do not require MFA — over-applying it hurts adoption.

**OAuth providers** (`D:\charqol\core-service\src\api\` `OAuthController`): GitHub, Google, Facebook, Twitter. Each provider has `GET /oauth/{provider}/login` (redirect URL) + `GET /oauth/{provider}/callback` (returns user + tokens).

**PT Kharade application:** add **Google OAuth** for customer login as a faster alternative to OTP — single tap on Android Auto-Selected Account. Plug the callback into the same JWT issuance path.

**Device tracking:** `D:\charqol\core-service\src\api\users\device.details\user.device.details.controller.ts` — logs every login with device fingerprint. Endpoint `GET /users/me/devices` returns active sessions; user can revoke any. Recommend exposing this in BRIEF deliverable #13 (customer profile → "active sessions").

**Password policy:** `Auth.PasswordExpirationDurationDays: 180` and `Auth.OtpValidityInMinutes: 5` in `service.config.json`. Pull both into our config.

---

## 9. Multi-tenancy enforcement — OrganizationId + CompanyId (charqol)

Confirmed: charqol enforces tenancy via **two columns** on every entity, not just `CompanyId`.

```ts
@Entity()
@Index(['OrganizationId', 'CompanyId'])     // composite tenant index
class Anything {
  @Column('uuid') OrganizationId: string;
  @Column('uuid') CompanyId: string;
  // ...
}
```

**For PT Kharade:** flatten this slightly — `tenantId` (= organisation) + `branchId` (= company / shop). Single tenant today, single branch today; the columns are non-null with default values referencing the seeded `PT Kharade Group of Industries` row and `Mukundnagar shop` row. Multi-branch enablement in phase 7 (BRIEF §6) is then a config flip + UI gate, not a migration.

---

## 10. Correlation ID — AsyncLocalStorage (charqol)

**Files:** `D:\charqol\payroll-service\src\logger\correlation.id.ts` + `correlationIdMiddleware`.

**Pattern:**
- Header `X-Correlation-ID` — generated as UUID v4 if not provided
- Stored in `AsyncLocalStorage` so every Logger call automatically picks it up regardless of how deep in the call stack
- Propagated across `x-api-key` calls to sister services via an Axios interceptor adding `X-Correlation-ID` from the current context
- Logger emits `{ timestamp, correlationId, userId, companyId, organizationId, method, path, statusCode, duration, msg }` — **all of it** automatically

**Critical for PT Kharade**: a customer "where's my order?" support call ends in one trace ID that follows the request through identity → orders → payments → notifications. Adopt this on day one — adding correlation IDs after the fact requires touching every log line.

---

## 11. Observability — OpenTelemetry (charqol)

**Already wired** in `D:\charqol\accounting-service\package.json`:
- `@opentelemetry/sdk-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/exporter-zipkin`
- `@opentelemetry/instrumentation-express`

**Manual instrumentation** via decorator: `D:\charqol\sales-service\src\api\lead\lead.controller.ts` uses:
```ts
@Trace('LeadController.create')
public async create(req, res) { ... }
```

**For PT Kharade:**
- Init OTel SDK in `src/startup/telemetry.ts` (each service)
- Apply `@Trace('<Service>.<Method>')` to every controller method and to slow service methods (DB queries, gateway calls)
- Exporter: **Zipkin** is free, self-hostable on the same VPS; OTLP later if we adopt managed observability (Datadog / Honeycomb)

This + correlation IDs (§10) gives full distributed tracing without external SaaS spend in phase 1.

---

## 12. Recurring invoices (charqol accounting)

**File:** `D:\charqol\accounting-service\src\api\recurring.invoice\recurring.invoice.controller.ts` + `D:\charqol\accounting-service\src\database\models\recurring.invoice.model.ts`.

**Fields:**
- `Frequency` enum (Monthly / Quarterly / HalfYearly / Yearly)
- `NextInvoiceDate`
- `EndDate` (subscription end)
- `IsActive`
- `TemplateId` → `InvoiceTemplate` with `PaymentTermsDays` (default 30), `ShowTax`, `CurrencyCode`, header/footer text
- Line items reference `TaxCodeId` for GST

**Flow for PT Kharade subscriptions:**
1. Customer purchases plan → `Subscription` row + `RecurringInvoice` row created
2. Daily BullMQ job `subscriptions-renew` (BRIEF §2.5) selects `WHERE NextInvoiceDate <= today AND IsActive`
3. For each: render invoice from template, charge Razorpay (saved card / subscription mandate), publish `subscriptions.subscription.renewed` event
4. Advance `NextInvoiceDate` by frequency

**Tax codes:** `TaxCode` table (charqol) holds GST rates (`GST / IGST / CGST / SGST`). Even if PT Kharade doesn't charge GST today (BRIEF §2.3), seed the table empty and reference it on every line item. Flipping GST on becomes a row insert + admin toggle.

---

## 13. Vendor settlements + payouts (Batterlicious)

**Highly relevant** for BRIEF §2.1 vendor B2B. Adopt the entities:

| Entity                                            | Purpose                                                                                       |
|---------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `vendor.settlements.entity.ts`                    | Periodic settlement: `TotalSales`, `TotalCommission`, `PlatformFee`, `TdsAmount`, `AdjustmentAmount`, `AdjustmentReason`, `PaidAmount`, `RemainingAmount`, `Status` |
| `settlement.transactions.entity.ts`               | Individual orders in a settlement                                                              |
| `vendor.bank.accounts.entity.ts`                  | Bank details for payouts (account no, IFSC, holder name)                                       |
| `settlement.audit.log.entity.ts`                  | Every adjustment / dispute, who made it, when                                                  |
| `order.vendor.commissions.entity.ts`              | Commission per order (for multi-vendor platforms — only relevant if PT Kharade onboards franchisees later) |

**For PT Kharade phase 1 (single shop):** skip the commission split logic but still model `VendorSettlement` so vendor invoices accumulate into a fortnightly/monthly statement with TDS deduction. Indian SMB B2B always needs TDS handling.

---

## 14. Product variants + addresses with geo (Batterlicious)

**Product variants:** `product.variants.entity.ts` — `VariantName`, `VariantType (Size|Color|...)`, `Sku`, `Price`, `Stock`, `IsDefault`, `PriceAdjustments`, `Unit`.

**For PT Kharade:** model variants for items where rate differs by size — e.g., **king-size vs single-size bedsheet** for vendor rates. BRIEF §2.3 hints at it ("per sqft or per piece — recommend and justify"). Variants give us a clean way: parent item `Bedsheet`, variants `Single (₹X)`, `Double (₹Y)`, `King (₹Z)`.

**Addresses with lat/long:** `address.entity.ts` carries `Latitude` and `Longitude` (decimal 10,7), `Society`, `Flat`, `Building`, `Landmark`, `IsDefault`. Replicate **exactly** — the Society/Flat/Building decomposition matches Indian address conventions much better than free-text `addressLine1/2`.

---

## 15. Customer-app pages — full IA (Batterlicious MAUI)

The MAUI app has more screens than first reported. Each must have a Flutter equivalent. Update `03-customer-app-flutter.md` page-map with:

| MAUI page                          | Flutter destination                                          | Notes                                                       |
|------------------------------------|--------------------------------------------------------------|-------------------------------------------------------------|
| `WelcomePage.xaml`                 | `lib/features/auth/welcome_screen.dart`                      | Onboarding carousel                                          |
| `OTPVerificationPage.xaml`         | `lib/features/auth/otp_screen.dart`                          | Already in guide                                             |
| `ItemSelectionPage.xaml`           | `lib/features/catalog/item_selection_screen.dart`            | Per-service-type item picker                                  |
| `ManageAddressesPage.xaml`         | `lib/features/profile/addresses_screen.dart`                 | List + default flag                                          |
| `AddressDetailPage.xaml`           | `lib/features/profile/address_edit_screen.dart`              | Lat/long capture via map                                     |
| `ProfileDetailPage.xaml`           | `lib/features/profile/profile_edit_screen.dart`              | Edit name/email/phone                                        |
| `OrderHistoryDetailPage.xaml`      | `lib/features/orders/order_history_detail_screen.dart`       | Past order + **Reorder** button                              |
| `TrackOrderPage.xaml`              | `lib/features/orders/track_screen.dart`                      | Live status + (optional) map of delivery partner             |
| `ReviewPage.xaml`                  | `lib/features/orders/review_screen.dart`                     | Post-delivery rating/feedback — feeds `order.review` entity  |
| `BLWalletPage.xaml`                | `lib/features/wallet/wallet_screen.dart`                     | Balance + top-up + transactions (uses `wallet.transactions`)|
| `ContactUsPage.xaml`               | `lib/features/support/contact_screen.dart`                   | Submit form → `ContactUs` entity on backend                  |
| `TermsPolicyPage.xaml`             | `lib/features/legal/terms_screen.dart`                       | CMS content from `terms.and.policy` entity                   |
| `ThemeModalPage.xaml`              | Bottom-sheet in `lib/features/settings/theme_picker.dart`    | Light/dark + tokens (BRIEF §2.5)                             |
| `CreateSubscriptionPage.xaml`      | `lib/features/subscriptions/create_screen.dart`              | Day-of-week + slot + items                                    |
| `SubscriptionDetailsPage.xaml`     | `lib/features/subscriptions/detail_screen.dart`              | Pause / Resume / Cancel buttons                              |

`ContactUs` and `TermsAndPolicy` exist as backend entities — `D:\Batterlicious\batterlicious-service\src\database\typeorm\models\contact.us.entity.ts` and `terms.and.policy.entity.ts`.

---

## 16. Admin portal — role-split routes (Batterlicious)

The Batterlicious admin portal uses **three role-prefixed route trees**: `sys-admin/`, `vendor/`, `sys-user/`. PT Kharade can flatten to **two**: `admin/` and `receptionist/`. The structure is still worth copying because each top-level domain page has a print-friendly child page.

**Notable extras:**
- `revenue/transactions/[transactionId]/print-invoice/+page@.svelte` — print-friendly invoice using SvelteKit's **breakout layout** (`+page@.svelte` — the `@` resets to root layout, so the print page renders without the dashboard chrome). Adopt this exact pattern for PT Kharade.
- `packaging/[orderId]/print-label/+page@.svelte` — shipping/garment-tag label, A6 size.
- `packaging/[orderId]/print-order/+page@.svelte` — packing slip listing items.
- `orders/preparations/+page.svelte` — batch preparation tracking (see §3 above).
- `revenue/vendor-payouts/+page.svelte` — settlement listing (see §13 above).
- `revenue/wallets/+page.svelte` — wallet overview for support / finance team.
- `analytics/+page.svelte` — sys-admin-only metrics dashboard.
- `older/` — archived v1 routes; remove on first cut, don't carry baggage.

---

## 17. Bruno collection coverage (Batterlicious — full inventory)

The first pass listed 4 collections; the actual count is **23**. Use this as the **definitive list of API surfaces** to build for PT Kharade (laundry equivalents in the right column):

| # | Batterlicious collection      | PT Kharade equivalent                                  |
|---|-------------------------------|--------------------------------------------------------|
| 01 | users_addresses               | customer_addresses                                      |
| 02 | product_categories            | item_categories (drycleanable, washable, press-only)    |
| 03 | vendors                       | vendors (B2B customers)                                 |
| 04 | products                      | items (shirt, pant, sari, bedsheet, etc.)               |
| 05 | product_variants              | item_variants (size, fabric)                            |
| 06 | shopping_carts                | order_drafts                                            |
| 07 | delivery_partners             | delivery_partners                                       |
| 08 | discounts                     | discounts/coupons                                       |
| 09 | orders                        | orders                                                  |
| 10 | order_items                   | order_items                                             |
| 11 | order_histories               | order_status_history                                    |
| 12 | subscription_plans            | subscription_plans                                      |
| 13 | user_subscriptions            | user_subscriptions                                      |
| 15 | payment_methods               | payment_methods                                         |
| 16 | user_wallets                  | user_wallets                                            |
| 17 | wallet_transactions           | wallet_transactions                                     |
| 18 | delivery_slots                | pickup_slots + delivery_slots                           |
| 19 | order_delivery_slots          | order_slot_bookings                                     |
| 20 | user_reviews                  | order_reviews                                           |
| 21 | delivery_charges              | delivery_charges                                        |
| 22 | inventories                   | (optional — laundry consumables only)                   |
| 23 | offers/banners                | marketing_banners                                       |

---

## 18. Charqol cron schedules (correction)

Earlier note implied charqol has no scheduler. **Correction:** `D:\charqol\accounting-service\src\startup\scheduler.ts` uses `node-cron` (v3.0.2) with schedule definitions in `seed.data/cron.schedules.json`, environment-keyed. Stubbed handlers include `scheduleDailyReminders()` and `scheduleMonthlyLedgerProcessing()`.

**PT Kharade still uses BullMQ** per BRIEF §2.5, but the **job catalogue shape** from this file is a faithful template:
- Per-environment schedule (dev runs every 5 min for testability; prod runs daily)
- Each schedule has `name`, `cron`, `enabled`, `description`

Lift that JSON shape into `seed.data/bullmq.schedules.json` for our queues.

---

## 19. Mocha + ts-mocha + nyc test harness (charqol)

The first pass was right that charqol uses Mocha; the second pass found the **test factory + helpers** which are worth reusing.

**Files** (charqol/accounting-service/):
- `test/helpers/test.helper.ts` — `TestHelper.generateTestToken()`, `TestHelper.createTestUser({roles})`, `TestHelper.createAdminUser()`.
- `test/helpers/test.database.helper.ts` — `TestDatabaseHelper.setup()`, `cleanDatabase()`, `ensureTestPrerequisites()`.

**Pattern to adopt** (even if we use Vitest):
- One `TestHelper` namespace per service for token + user factories
- One `TestDatabaseHelper` for setup/teardown — runs migrations, seeds the same fixtures used in dev
- Integration tests hit a **real Postgres** (preferably a Docker test container started by the test runner), not mocked
- Three suites: `test:unit`, `test:integration`, `test:e2e` — with progressively longer timeouts (10s / 60s / 30s) and separate `npm` scripts

**Coverage tool:** `nyc` for Mocha; for Vitest the built-in `--coverage` is simpler.

---

## 20. Sales-service "activity" pattern (charqol) → laundry order timeline

Even though we don't need CRM, the **Activity log model** in `D:\charqol\sales-service\src\api\activity\activity.controller.ts` is a clean generic event-history pattern. PT Kharade can adopt it as `OrderActivity` (every order has a history of activities — picked up, washed, ready, delivered) **separate** from the audit log (which is admin-action focused).

| Concept              | Audit log                         | Order activity                                    |
|----------------------|-----------------------------------|---------------------------------------------------|
| Who                  | Admin / Receptionist              | System or staff member                            |
| What                 | "Updated rate card"               | "Order moved to In-Process"                       |
| Why                  | Compliance / forensic             | Customer-facing timeline                          |
| Visible to customer? | No                                | **Yes** (rendered in app "Order tracking")         |
| Retention            | 180 d hot                         | Forever                                            |

Generic schema (same fields, two tables):
```ts
@Entity({ name: 'order_activities' })
class OrderActivity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') OrderId: string;
  @Column() Actor: string;      // 'System' | 'Rohan Patil (Receptionist)'
  @Column() Type: string;       // 'StatusChanged' | 'PaymentReceived' | 'NoteAdded'
  @Column({ nullable: true }) FromStatus: string;
  @Column({ nullable: true }) ToStatus: string;
  @Column({ nullable: true }) Note: string;
  @Column('jsonb', { nullable: true }) Meta: any;
  @CreateDateColumn() CreatedAt: Date;
}
```

---

## 21. Config keys we missed (charqol service.config.json)

Add these to the canonical `service.config.json` shape in `01-backend.md` §4:

```json
{
  "Auth": {
    "AccessTokenExpiresInSeconds": 3600,
    "RefreshTokenExpiresInSeconds": 2592000,
    "PasswordExpirationDurationDays": 180,    // ← new
    "OtpValidityInMinutes": 5,                 // ← new
    "SendPasswordBySms": false,                // ← new
    "SendPasswordByEmail": true                // ← new
  },
  "Analytics": { "Enabled": false },           // ← new (feature flag style)
  "Telemetry": true                            // ← new (toggles OTel SDK init)
}
```

Notably **missing** from charqol configs (and that we should add): rate-limit config, CORS allow-list, feature-flag map. Put these in a `Security` section in `service.config.json` for PT Kharade.

---

## 22. Forms-service (charqol) — useful for admin dynamic forms (optional)

Not strictly required by BRIEF, but powerful: `D:\charqol\forms-service\src\database\models\form.template\form.template.model.ts` + `form.field\form.field.model.ts` define a **dynamic form builder**:

- `FormTemplate { Title, Version, Type (Survey|Intake|...), NavigationStrategy (AllAtOnce|Sequential), ScoringApplicable, DefaultSectionNumbering, ApprovalRequired, Tags }`
- `FormField { ResponseType (Text|Number|Date|SingleChoice|MultiChoice|...), IsRequired, Score, Options (jsonb), RangeMin/Max, Hint }`
- Separate entities for `validation.logic`, `skip.logic`, `calculation.logic` — each with rules and operations (math, logical, function-expression, iterate, composition)

**PT Kharade use case:** vendor onboarding form (varied questions per vendor type), customer feedback form (after delivery), garment-condition checklist at intake. **Defer to phase 7** — overkill before scale.

---

## 23. Surprises that do NOT exist in references

To save people the search:
- **xstate / explicit state-machine library** — not used. Charqol payment state machine is hand-rolled with a transitions map (see `01-backend.md` §12).
- **Redis pub/sub** — not used; event bus is via message broker outbox.
- **Saga / distributed transactions** — not used; trust the outbox + eventual consistency.
- **GraphQL** — not used.
- **WebSocket / SSE for backend ↔ client** — only in `deft-dexterous` for code-streaming UX. Not in charqol/Batterlicious/Rean. For PT Kharade order-tracking we'll add SSE in phase 4 (small, optional).
- **Feature flags** — no in-repo system. Adopt `Unleash` (self-host) only if BRIEF Phase 7 analytics demands toggles.
- **A/B testing** — not present.
- **Live chat / support widget** — not present (only a static "ContactUs" form).

---

## 24. Quick refinement summary — what changed since `01–05`

| Topic                                    | First-pass guidance                | Refined guidance (this file)                                                                |
|------------------------------------------|------------------------------------|---------------------------------------------------------------------------------------------|
| Idempotency storage                      | Redis                              | **DB-backed TypeORM table** ([§7](#7-idempotency-db-backed-not-redis))                       |
| MFA / OAuth                              | "out of scope" / TODO              | **Wired in charqol; copy verbatim** for SystemAdmin role ([§8](#8-mfa--oauth-charqol))      |
| OpenTelemetry                            | "no reference"                     | **Already in charqol via `@Trace()`** ([§11](#11-observability--opentelemetry))             |
| Correlation IDs                          | "use Logger"                       | **AsyncLocalStorage + `X-Correlation-ID` propagation** ([§10](#10-correlation-id--asynclocalstorage-charqol))|
| Multi-tenancy                            | "single tenantId column"           | **OrganizationId + CompanyId composite index** ([§9](#9-multi-tenancy-enforcement--organizationid--companyid-charqol)) |
| Subscriptions                            | "no direct reference, build new"   | **Batterlicious subscription.entity has pause/resume, day-of-week, split payment** ([§1](#1-subscriptions--pause--resume--day-of-week-batterlicious)) |
| Delivery management                      | "TBD"                              | **8-entity domain in Batterlicious** ([§2](#2-delivery-management--full-domain-batterlicious)) |
| Discount engine                          | "build new"                        | **Batterlicious discount + usage entities cover coupon/percent/flat/free-pickup** ([§5](#5-discount-engine-batterlicious)) |
| Wallet / credit                          | "no reference"                     | **Full Batterlicious wallet + transactions; B2B credit limit = negative wallet floor** ([§6](#6-walletstore-credit--prepaid-batterlicious)) |
| Recurring invoices                       | "no reference"                     | **Charqol recurring.invoice.controller + invoice.template with PaymentTermsDays, ShowTax, TaxCodeId** ([§12](#12-recurring-invoices-charqol-accounting)) |
| Vendor settlements / payouts             | "build new"                        | **Batterlicious vendor.settlements full schema with TDS, adjustments** ([§13](#13-vendor-settlements--payouts-batterlicious)) |
| Address modelling                        | "addressLine + city + pin"         | **Society / Flat / Building / Landmark + Lat/Long — matches Indian conventions** ([§14](#14-product-variants--addresses-with-geo-batterlicious)) |
| Product variants                         | "single rate per item"             | **Variant entity supports size/fabric — needed for vendor bedsheet sizes** ([§14](#14-product-variants--addresses-with-geo-batterlicious)) |
| Slot capacity                            | "TBD"                              | **Slot.MaxOrders + CurrentOrders + atomic check on book; daily product capacity** ([§4](#4-product-daily-capacity--order-cutoff-batterlicious)) |
| Processing batches                       | not covered                        | **Preparation batch entity → laundry wash-cycle batching** ([§3](#3-preparation-batches--laundry-processing-batches-batterlicious)) |
| Print pages                              | not covered                        | **SvelteKit `+page@.svelte` breakout layout for invoice/label/packing-slip** ([§16](#16-admin-portal--role-split-routes-batterlicious)) |
| Order activity (customer-facing timeline)| conflated with audit log           | **Separate `order_activities` table for tracking UX; audit log stays admin-only** ([§20](#20-sales-service-activity-pattern-charqol--laundry-order-timeline)) |

---

*End of extended patterns. Cross-references from `01–05` files now point here for the corrected/expanded guidance.*
