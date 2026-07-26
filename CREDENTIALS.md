# Credentials & External Services — Setup Guide

> Everything the platform talks to, what it costs, how to get it, and exactly
> which env vars it fills. Written for whoever is putting PT Kharade live.
>
> **Nothing here is optional-by-accident.** Each section says what breaks if
> you skip it, so you can go live with a subset and know precisely what you
> have given up.

---

## 0. TL;DR — what you must have before go-live

| # | Service | Needed for | Can you launch without it? |
|---|---------|-----------|-----------------------------|
| 1 | **PostgreSQL** | Everything | No |
| 2 | **Redis** | Sessions, notification queue, live tracking | No |
| 3 | **SMS (MSG91)** | **OTP login** | **No — nobody can log in** |
| 4 | **Razorpay** | Online payment | Yes — cash-only shop |
| 5 | **SMTP** | Email receipts | Yes — SMS/WhatsApp still work |
| 6 | **WhatsApp (Meta)** | Receipts on WhatsApp | Yes — SMS still works |
| 7 | **Firebase (FCM)** | Push notifications | Yes — SMS still works |
| 8 | **Zoho Pay** | Alternative gateway | Yes — Razorpay is primary |

**The one that blocks everything is #3.** Login is OTP-over-SMS. Without an SMS
provider, `DevOtp` is only returned when `NODE_ENV != production`, so in
production the OTP is generated, never sent, and nobody gets in. Set up MSG91
first.

---

## 1. PostgreSQL

**What it is:** the database. Five logical DBs, one per service.

**Getting it:** any managed Postgres 14+ (DigitalOcean, RDS, Neon, Supabase) or
self-hosted. The shop's volume does not need anything large — 2 vCPU / 4GB is
generous.

```bash
# Every service takes the same block; only the DB name differs.
DB_DIALECT=postgres
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=ptk
DB_PASSWORD=<strong-random>
DB_SCHEMA=public

# Per service:
IDENTITY_DB_NAME=identity_db
CATALOG_PRICING_DB_NAME=catalog_db
ORDERS_DB_NAME=orders_db
PAYMENTS_DB_NAME=payments_db
NOTIFICATIONS_DB_NAME=notifications_db

# TypeORM auto-creates tables from the entities. Fine for first boot;
# turn OFF once live and manage changes with migrations, or a rename in code
# silently drops a column.
DB_SYNC=false
```

> **Before go-live:** set `DB_SYNC=false`. With it on, TypeORM will alter your
> production schema to match the code on every deploy.

---

## 2. Redis

**What it is:** three jobs, all load-bearing.
- admin-portal **sessions** (the portal refuses to start without it)
- the **notification queue** (BullMQ — retries a failed SMS)
- **live order tracking** (pub/sub fan-out to SSE clients)

**Getting it:** any managed Redis 6+ (Upstash, DO, ElastiCache) or the bundled
`docker-compose.yml` for dev.

```bash
REDIS_URL=redis://default:<password>@your-redis-host:6379
```

**If you skip it:** the portal won't boot. notifications fall back to inline
delivery with **no retry** (a 30-second SMS outage silently loses an order
confirmation). Live tracking only works if you run exactly one instance.

---

## 3. SMS — MSG91  ⚠️ REQUIRED FOR LOGIN

**Why MSG91:** Indian transactional SMS is DLT-regulated (TRAI). You cannot
send arbitrary text to Indian numbers — the template must be pre-registered.
MSG91 handles DLT registration for you. SMSCountry is also supported.

### How to get it

1. Sign up at **https://msg91.com** → *Sign Up*.
2. **Complete DLT registration** (this is the slow part — allow **3–7 working
   days**). You will need:
   - Business PAN + GST certificate
   - A letterhead authorisation
   - Your **Sender ID** (6 letters, e.g. `PTKHRD`) — must be approved
3. Register your **templates** under *Flow*. Every message you send must match
   an approved template exactly. Register at minimum:

   | Purpose | Template text to register |
   |---|---|
   | OTP | `{{VAR1}} is your verification code for PT Kharade. Valid 5 minutes. Do not share it.` |
   | Order booked | `PT Kharade: Order {{VAR1}} booked. Total Rs.{{VAR2}}.` |
   | Order ready | `PT Kharade: Order {{VAR1}} is ready for {{VAR2}}.` |
   | Out for delivery | `PT Kharade: {{VAR1}} is out for delivery with {{VAR2}}.` |

4. Copy your **Auth Key** from *Settings → API*.

```bash
SMS_PROVIDER=MSG91
MSG91_AUTH_KEY=<your-auth-key>
MSG91_SENDER=PTKHRD              # your approved 6-letter sender ID
MSG91_TEMPLATE_ID=<flow-id>      # the DLT flow id for the template
```

**Cost:** roughly ₹0.15–0.25 per transactional SMS.

> **Devanagari costs 2× more.** A Marathi SMS cannot use the GSM-7 alphabet, so
> it encodes as UCS-2: **70 characters per segment instead of 160**. A long
> Marathi message quietly becomes 3 billed segments. Our templates are
> length-checked in CI (`seed.templates.test.ts`) to stay within 3.

### Alternative: SMSCountry

```bash
SMS_PROVIDER=SMSCountry
SMSCOUNTRY_AUTH_KEY=<key>
SMSCOUNTRY_AUTH_TOKEN=<token>
SMSCOUNTRY_SENDER_ID=PTKHRD
```

### To develop without it

```bash
SMS_PROVIDER=Mock    # logs "would send N chars to +91..." and never sends
```
In `NODE_ENV != production`, `POST /auth/otp/send` returns the OTP in the
response as `DevOtp`, so you can log in. **This is disabled in production** —
which is why MSG91 is mandatory before go-live.

---

## 4. Razorpay — online payments

### How to get it

1. Sign up at **https://dashboard.razorpay.com**.
2. **Activate the account** (KYC): PAN, GST, bank account, address proof.
   Allow **2–5 working days**. You can use Test Mode immediately.
3. *Settings → API Keys* → **Generate Key**. You get `rzp_test_...` /
   `rzp_live_...` and a secret. **The secret is shown once.**
4. *Settings → Webhooks* → **Add New Webhook**:
   - URL: `https://payments.yourdomain.in/api/v1/webhooks/razorpay`
   - Secret: **generate your own strong random string** — you choose this, not
     Razorpay. Put the same value in `RAZORPAY_WEBHOOK_SECRET`.
   - Events: `payment.captured`, `payment.failed`, `refund.processed`

```bash
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<from step 3>
RAZORPAY_WEBHOOK_SECRET=<the random string you chose in step 4>
```

> **`RAZORPAY_WEBHOOK_SECRET` is not optional.** Webhook verification **fails
> closed**: with no secret, every webhook is rejected with 401 and no payment
> is ever confirmed. That is deliberate — the alternative (treating "no secret"
> as "no verification") would let anyone who finds the URL mark any order paid.

**Cost:** ~2% + GST per transaction. UPI is often cheaper — negotiate.

**Test cards:** card `4111 1111 1111 1111`, any future expiry, any CVV.
UPI test VPA: `success@razorpay`.

---

## 5. SMTP — email receipts

**Any SMTP provider works.** Recommended for India:

| Provider | Free tier | Notes |
|---|---|---|
| **Brevo** (ex-Sendinblue) | 300/day | Easiest to start |
| **Amazon SES** | 62k/mo from EC2 | Cheapest at volume; needs sandbox removal |
| **Zoho Mail** | — | Sensible if you already use Zoho |
| **Gmail/Workspace** | — | Needs an App Password, low limits |

### Brevo (fastest path)

1. Sign up at **https://www.brevo.com**.
2. *Senders, Domains & IPs* → **verify your domain** (add the DKIM/SPF records
   they give you to your DNS). Skipping this sends you to spam.
3. *SMTP & API → SMTP* → copy the login + **SMTP key**.

```bash
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<your-brevo-login>
SMTP_PASS=<smtp-key>
SMTP_FROM=PT Kharade <noreply@ptkharade.in>
```

**Notes on our implementation:**
- `SMTP_SECURE` is derived from the port (465 ⇒ implicit TLS). Don't set it
  unless you must.
- **STARTTLS is forced** on non-465 ports. If your relay doesn't offer it, we
  refuse to send rather than transmit your password in plaintext.
- `SMTP_ALLOW_INVALID_CERTS=true` exists **for a self-signed dev relay only**.
  It disables certificate validation and makes the connection MITM-able. Every
  reference implementation we drew on shipped this permanently on. Never do
  that.
- Credentials are verified **at boot**, so a wrong password shows up in the
  startup log rather than on the first real order.

---

## 6. WhatsApp — Meta Cloud API

**This is the one with real setup friction.** Budget a week.

### How to get it

1. **Facebook Business Manager** account → https://business.facebook.com
2. **Verify your business** (*Business Settings → Security Centre*). Needs GST
   certificate / incorporation docs. **1–5 working days.**
3. https://developers.facebook.com → *Create App* → type **Business**.
4. Add the **WhatsApp** product.
5. Add a phone number. **It must not be registered on normal WhatsApp** — use a
   fresh SIM, or delete the existing WhatsApp account on it first.
6. Copy the **Phone Number ID** (not the phone number itself) and the
   **Permanent Access Token** (*System User → Generate Token*; the temporary
   one expires in 24h).
7. **Register your message templates** (*WhatsApp Manager → Message Templates*)
   and wait for approval (minutes to 24h).

```bash
WHATSAPP_PHONE_NUMBER_ID=<numeric id from step 6>
WHATSAPP_ACCESS_TOKEN=<permanent system-user token>
WHATSAPP_API_VERSION=v21.0

# Maps OUR event codes to YOUR approved template names.
# The names are whatever Meta approved — they will not match our codes.
WHATSAPP_TEMPLATE_MAP=ORDER_BOOKED=ptk_order_booked,ORDER_READY=ptk_order_ready,OUT_FOR_DELIVERY=ptk_out_for_delivery,ORDER_DELIVERED=ptk_delivered,PAYMENT_RECEIVED=ptk_payment_received
```

### The 24-hour rule — read this

WhatsApp only allows **free-form** messages within 24 hours of the customer
last messaging *you*. Outside that window **only pre-approved templates are
delivered**; free-form is rejected (error 131047).

An order confirmation is almost always outside the window. **So the receipt
must be an approved template**, not free text. Register this as
`ptk_order_booked`, category **UTILITY**:

```
*PT Kharade Drycleaners & Laundry*

Hello {{1}}, we have your order.

*Order:* {{2}}
*Service:* {{3}}
*Items:* {{4}}
*Total:* Rs.{{5}}

{{6}}

Track: {{7}}
Receipt: {{8}}
```

Meta templates use **positional** `{{1}}`, `{{2}}` — not names. Order matters.

**Cost:** UTILITY conversations ~₹0.35 each in India. First 1,000/month free.

**If you skip it:** order receipts still go by SMS. Nothing breaks.

---

## 7. Firebase — push notifications

1. https://console.firebase.google.com → **Add project**.
2. *Project Settings → Service Accounts* → **Generate new private key** → a
   JSON file downloads.
3. Add your apps:
   - **Android:** package name → download `google-services.json` →
     `customer-app/android/app/`
   - **iOS:** bundle id → download `GoogleService-Info.plist` →
     `customer-app/ios/Runner/`. Also upload an **APNs key** (from your Apple
     Developer account) under *Cloud Messaging* — iOS push does not work
     without it.

```bash
# Prefer the JSON inline — containers get secrets as env vars, and a file path
# means baking a private key into your image.
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...",...}
# or
# FCM_SERVICE_ACCOUNT_PATH=/run/secrets/fcm.json
```

**Cost:** free.

**If you skip it:** push is marked `Skipped` (not `Sent` — we don't fake it).
SMS still goes out.

---

## 8. Zoho Pay (optional second gateway)

Only needed if you want Zoho alongside Razorpay.

1. https://payments.zoho.in → sign up, complete KYC.
2. https://api-console.zoho.in → **Self Client** → note Client ID + Secret.
3. Generate a **refresh token** (scope `ZohoPay.payments.CREATE`,
   `ZohoPay.payments.READ`). The refresh token is long-lived; access tokens are
   minted from it on demand and cached in-process.
4. Webhook → `https://payments.yourdomain.in/api/v1/webhooks/zohopay`, and copy
   the **signing key**.

```bash
ZOHOPAY_ACCOUNT_ID=<account id>
ZOHOPAY_CLIENT_ID=<client id>
ZOHOPAY_CLIENT_SECRET=<client secret>
ZOHOPAY_REFRESH_TOKEN=<refresh token>
ZOHOPAY_ACCOUNTS_URL=https://accounts.zoho.in
ZOHOPAY_MODE=live                 # sandbox | live
ZOHOPAY_WEBHOOK_SECRET=<signing key>
```

Same fail-closed rule as Razorpay: no `ZOHOPAY_WEBHOOK_SECRET`, no accepted
webhooks.

---

## 9. Platform secrets you generate yourself

These aren't from a vendor — **you** create them. Generate each with
`openssl rand -hex 32` and never reuse one across environments.

```bash
# Signs user JWTs. Every service verifies with it, so it MUST be identical
# across all five services. Rotating it logs everyone out.
JWT_SECRET=<openssl rand -hex 32>

# Signs public receipt links (the ones in WhatsApp/SMS). Falls back to
# JWT_SECRET if unset; give it its own so a receipt link can never be
# confused with a session token.
RECEIPT_LINK_SECRET=<openssl rand -hex 32>

# Inter-service auth. Every caller of a service presents one of these.
# Same value must be present in every service that ACCEPTS that caller.
API_KEY_ADMIN_PORTAL=<random>
API_KEY_CUSTOMER_APP=<random>
API_KEY_IDENTITY_SERVICE=<random>
API_KEY_ORDERS_SERVICE=<random>
API_KEY_CATALOG_PRICING_SERVICE=<random>
API_KEY_PAYMENTS_SERVICE=<random>
API_KEY_NOTIFICATIONS_SERVICE=<random>

# The seeded first admin. CHANGE THE PASSWORD before go-live.
SEED_ADMIN_EMAIL=admin@ptkharade.in
SEED_ADMIN_PASSWORD=<strong>
```

> The customer app compiles its key in at build time. If you change
> `API_KEY_CUSTOMER_APP`, rebuild the app with
> `--dart-define=API_KEY=<new value>` or **every request 401s**.

---

## 10. Business details (printed on the invoice)

```bash
BUSINESS_NAME=PT Kharade Drycleaners & Laundry
BUSINESS_ADDRESS=Mukundnagar, Pune, Maharashtra 411037
BUSINESS_PHONE=+91 98765 43210
BUSINESS_GSTIN=27XXXXXXXXXXZX          # printed on the tax invoice
SHOP_TIMEZONE=Asia/Kolkata             # buckets the dashboard's "today"

# Public URLs — used to build receipt/tracking links in messages.
PUBLIC_BASE_URL=https://orders.ptkharade.in
PUBLIC_APP_URL=https://app.ptkharade.in
```

---

## 11. Order of operations

Because some of these have multi-day lead times, start them in this order:

```
Day 1   ── Apply: MSG91 DLT registration      (3–7 days)  ⚠️ blocks login
        ── Apply: Meta business verification  (1–5 days)
        ── Apply: Razorpay KYC                (2–5 days)
Day 1   ── Provision Postgres + Redis         (minutes)
        ── Generate platform secrets          (minutes)
        ── Set up SMTP (Brevo)                (~1 hour incl. DNS)
        ── Set up Firebase                    (~1 hour)
Day 3-5 ── Razorpay approved → webhook + keys
Day 5-7 ── Meta verified → phone number → submit templates → approval
Day 7   ── MSG91 DLT approved → sender ID + templates → SMS live
Go-live ── DB_SYNC=false, rotate seeded admin password, verify webhooks
```

---

## 12. Pre-flight checklist

- [ ] `DB_SYNC=false`
- [ ] `SEED_ADMIN_PASSWORD` changed from the default
- [ ] `JWT_SECRET` is a fresh 32-byte random value, identical across all 5 services
- [ ] All 7 `API_KEY_*` values are non-default and present in every service
- [ ] `REDIS_URL` set (the portal will not start without it)
- [ ] `RAZORPAY_WEBHOOK_SECRET` set and matches the Razorpay dashboard
- [ ] Razorpay webhook URL is publicly reachable over HTTPS
- [ ] `SMTP_ALLOW_INVALID_CERTS` is **not** set
- [ ] MSG91 sender ID + templates approved; a real OTP arrives on a real phone
- [ ] WhatsApp templates approved and mapped in `WHATSAPP_TEMPLATE_MAP`
- [ ] Customer app rebuilt with the production `API_KEY`
- [ ] `BUSINESS_GSTIN` correct — it prints on every invoice

### Verifying it works

```bash
# 1. OTP actually arrives (the login-blocker)
curl -X POST https://identity.ptkharade.in/api/v1/auth/otp/send \
  -H 'content-type: application/json' -H 'x-api-key: <API_KEY_CUSTOMER_APP>' \
  -d '{"Phone":"+91XXXXXXXXXX"}'
# Expect 200 and no DevOtp in the body. The SMS should land in seconds.

# 2. Webhook signature verification is live (must be 401)
curl -X POST https://payments.ptkharade.in/api/v1/webhooks/razorpay \
  -H 'content-type: application/json' -d '{"event":"payment.captured"}'
# Expect: 401. A 200 means verification is off — stop and fix it.

# 3. Notification queue is draining
curl https://notifications.ptkharade.in/api/v1/notifications/queue-stats \
  -H 'x-api-key: <API_KEY_ADMIN_PORTAL>' -H 'authorization: Bearer <token>'
# "failed" should be 0 and "waiting" should not keep climbing.
```

---

## 13. Rotate these — they are already public

Found committed in the reference repos during this build:

- `D:\deft-dexterous\deft-source\...\appsettings.json` — a **live Razorpay test
  key + secret**, a DB password, and a JWT secret.
- `D:\charqol\core-service\.env` and `forms-service\.env` — a **live Brevo SMTP
  password**.

They are in working trees rather than committed to git, but they are real
credentials sitting in plaintext. Rotate them regardless of this project.
