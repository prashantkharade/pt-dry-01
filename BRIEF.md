# PT Kharade Drycleaners & Laundry — Project Brief / Claude Code Prompt

> Paste the entire contents of this file into a fresh Claude Code session.
> Claude will produce one deliverable at a time and pause for `next`.

---

You are acting as a **senior solution architect + tech lead**. Produce a complete set of deliverables for a real, production-grade laundry /dry-clean / press platform for an Indian SMB. Work artefact-by-artefact in the exact order listed in Section 7. **After each artefact, STOP and wait for me to say `next` before starting the following one.** Do not bundle multiple artefacts in one response.

---

## 1. Business Context

- Parent org: **PT Kharade Group of Industries**
- Operating unit: **PT Kharade Drycleaners and Laundry** (single shop today, designed to scale to multiple branches later)
- Core business: iron-press, laundry, and dry-cleaning for (a) walk-in customers and (b) B2B vendors (hotels, hospitals — bedsheets, curtains, couch covers, large/long-cycle items)
- Country: India. Currency: INR. Languages: English + Marathi.
- Treat data volumes as "looks small, behaves large" — design for caching, pagination, and async workflows from day one.

---

## 2. Functional Scope

### 2.1 Roles

1. **System Admin** — full access (catalog, pricing, users, reports, settings).
2. **Receptionist** — order intake, billing, status updates, customer/vendor lookup, payment collection. No access to pricing master, user management, or financial reports.
3. **Customer** — self-service via mobile/web app (book pickup, track order, pay, manage profile, subscriptions, addresses).

Vendors are modelled as a customer sub-type with B2B pricing + credit terms, not a separate login role (unless trivial to add).

### 2.2 Order Lifecycle

- **Service types:** Dry-clean, Laundry (wash+iron), Press-only.
- **Collection:** (a) Home pickup, (b) Customer drop-at-shop.
- **Delivery:** (a) Home delivery (extra charge), (b) Customer pickup at shop.
- **Statuses (suggested):** `Booked → Picked-up/Received → In-process → Ready → Out-for-delivery → Delivered → Closed`. Plus `Cancelled`, `On-hold`.
- **Bill issuance:** at intake; bill identifies whether billed to a  Customer or a Vendor (toggle on the bill screen).
- **Bill delivery channels:** SMS, WhatsApp (if feasible), Email, in-app.
- **Payments:** Razorpay (online) + Cash/UPI on delivery (offline), zoho pay (online)

### 2.3 Pricing (seed data — must be editable from Admin UI; load from seeders)

**Dry-clean (INR/piece):**

| Item            | Rate |
| --------------- | ---- |
| Shirt           | 50   |
| Pant            | 50   |
| Jerkin (jacket) | 120  |
| Towel           | 60   |
| Sari            | 120  |

**Press only (INR/piece):**

| Item         | Rate |
| ------------ | ---- |
| Shirt        | 10   |
| Pant         | 10   |
| Kurta        | 15   |
| Ladies Kurta | 20   |
| Sari         | 40   |

**Laundry (wash + iron):** define a sensible default schedule in the seeder (you choose; flag clearly in the data-model doc).

**Vendor / bulk items (hotel/hospital):** add seed rates for bedsheet, pillow cover, curtain (per sqft or per piece — recommend and justify), sofa cover. Vendor rates are separate from retail rates.

**Charges:**

- Home-delivery surcharge — configurable, default **₹40**
- Express / same-day surcharge — configurable, default **+25%**
- GST — design schema to support it even if currently not charged.

### 2.4 Subscriptions / Schemes

- Plan durations: Monthly, Quarterly, Half-yearly, Yearly.
- Plan types: customer plans + vendor plans (different pricing).
- Effect: percentage discount on listed rates, optional free pickups/month.
- Razorpay Subscriptions for recurring billing where applicable.

### 2.5 Cross-cutting Requirements

- **Backend cache:** Redis for catalog, rate cards, session, OTP, hot reads.
- **Background jobs:** queue (**BullMQ** on Redis) for notifications, invoice PDFs, scheduled status reminders, subscription renewals.
- **Notifications:** SMS (MSG91 or similar), Email (SES/SMTP), WhatsApp (optional, behind a flag), in-app push (FCM).
- **i18n:** English + Marathi across admin portal and mobile/web app.
- **Theming:** user-configurable background colour, border style, font family, font size (typography), light/dark — both in admin portal and customer app. Persist per-user.
- **Offline support (frontends):** admin portal must cache last-loaded lists for read; customer app must allow draft order creation offline and sync on reconnect.
- **Audit log** of admin/receptionist actions on orders and pricing.

---

## 3. Tech Stack (NON-NEGOTIABLE)

- **Backend:** Node.js + TypeScript + Express + TypeORM + PostgreSQL + Redis. Multiple microservices, but FEW (target **3–5 max**). Domain-driven
  boundaries — do not mix domains in one service.

  Suggested split (refine and justify if needed):
  1. `identity-service` — auth, users, roles, RBAC, customers, vendors
  2. `catalog-pricing-service` — items, rate cards, schemes, subscriptions
  3. `orders-service` — orders, bills, status, pickup/delivery routing
  4. `payments-service` — Razorpay, Zohopay invoices, reconciliation
  5. `notifications-service` — SMS/email/WhatsApp/push, templates

  Shared: API gateway / BFF, common libs (logger, error, validation, auth middleware), OpenAPI specs per service.

- **Admin portal:** **SvelteKit + Svelte 5 (runes), SSR pages, TypeScript.** Do NOT use React anywhere. Use Svelte 5 + SvelteKit.

- **Customer mobile + web app:** Flutter + Dart (single codebase for Android, iOS, and web).

- **Payments:** Razorpay and Zohopay (orders, payments, subscriptions, webhooks).

- **Infra (assume but don't deeply design now):** Docker, GitHub Actions CICD, deploy target = single VPS initially with room to move to managed Kubernetes.

---

## 4. Quality Bar

- **Code:** production-grade, typed, linted, tested (unit + a few integration).
- **Docs:** each artefact must be self-contained and copy-pasteable.
- **HTML mockups: Hi-fi** — realistic Indian data (names like _Rohan Patil_, Marathi sample strings, INR amounts, real-looking phone numbers `+91-XXXXXXXXXX`), micro-interactions, charts, dropdowns, modals, toasts, empty states, loading skeletons. Responsive. Clean, modern, domain-fitting (laundry palette: fresh blues / whites / mint — never cartoonish).
- **Estimates:** realistic Indian market rates (2026), separated by premium team vs medium-quality team.

---

## 5. Output Conventions

- All written deliverables are **Markdown** unless I explicitly ask for `.docx`.
- For `.docx` proposals, generate them with **python-docx** (write a script and run it). Place outputs under `./out/proposals/`.
- HTML mockups go under `./out/ui/<role>/<phase>/`.
- Backend / SQL / API docs go under `./out/docs/`.
- Use **mermaid** for sequence + ER diagrams inside markdown.
- Convert any relative time references to absolute dates from today (**2026-05-13**).

---

## 6. Phased Roadmap Requirements

Deliver a **phase-wise plan** where every phase ends with a demoable slice across backend + admin portal + customer app (**vertical slices**, not horizontal layers). For each phase, provide:

- Scope (features in that phase)
- Backend deliverables
- Admin portal deliverables
- Mobile/web app deliverables
- Man-days per role (BE, FE Svelte, Flutter, QA, DevOps, PM, UX)
- Calendar timeline (weeks) assuming team starts **2026-06-01**
- Cost in INR for **Premium team** and **Medium team** separately
- Risks & exit criteria

Phases (refine if needed):

1. Foundations + Auth + Master Data
2. Order intake + Billing + Status (admin portal first)
3. Customer app MVP (browse, book, pay, track)
4. Payments + Notifications (Razorpay + SMS/Email)
5. Subscriptions / Schemes + Vendor B2B
6. Offline + i18n (Marathi) + Theming + Reports
7. Hardening, analytics, multi-branch readiness

---

## 7. Deliverables — Produce In This Exact Order, One At A Time

After finishing each item, STOP and wait for my **`next`**.

1. **Architecture overview doc** → `./out/docs/01-architecture.md` — service map, why these N services, data flow, infra diagram, tech choices justified.

2. **Data model doc** → `./out/docs/02-data-model.md` — every entity in (a) tabular form (field, type, constraints, notes), (b) PostgreSQL DDL SQL, (c) mermaid ER diagram. Cover identity, catalog/pricing, orders, payments, subscriptions, notifications, audit.

3. **API + workflow doc** → `./out/docs/03-api-workflows.md` — full REST endpoint list grouped by service, in the order they're called for each workflow. Include mermaid sequence diagrams for: walk-in intake, home pickup, payment online, payment on delivery, vendor bulk order, subscription purchase, status update, refund. Include the RBAC matrix per endpoint.

4. **Phased implementation plan — Premium team** → `./out/docs/04-plan-premium.md` — per Section 6. Premium team = senior engineers, Indian top-tier rates.

5. **Phased implementation plan — Medium team** → `./out/docs/05-plan-medium.md` — lower-bound estimates, mid-level engineers, realistic Indian SMB   rates. Same structure as #4.

6. **Backend implementation prompt** → `./out/prompts/backend-prompt.md` — a single comprehensive prompt I can paste into a fresh Claude Code session to scaffold the Node.js + Express + TypeScript + TypeORM microservices. Must reference docs 01–03.

7. **Frontend (SvelteKit) implementation prompt** → `./out/prompts/frontend-prompt.md` — same idea for the admin portal. Svelte 5 + SvelteKit SSR. No React anywhere.

8. **Flutter app implementation prompt** → `./out/prompts/mobile-prompt.md` — for the Flutter customer app.

9. **Proposal — Medium plan** → `./out/proposals/proposal-medium.docx` — Microsoft Word, generated via python-docx. Cover page, exec summary, scope, features, tech stack (Svelte 5 + SvelteKit, Node.js + Express, Flutter — explicitly NOT React), phases, timeline, pricing in INR, payment milestones, assumptions, T&Cs.

10. **Proposal — Premium plan** → `./out/proposals/proposal-premium.docx` — same structure, premium pricing + scope additions (better SLAs, analytics, multi-branch, advanced reporting).

11. **HTML UI mockups — Stage 1: Admin Portal — Receptionist screens** → `./out/ui/receptionist/stage1/` — login, dashboard, new order intake (walk-in), bill preview, order list, order detail, status update modal, customer search. **Hi-fi.**

12. **HTML UI mockups — Stage 2: Admin Portal — System Admin screens** → `./out/ui/admin/stage2/` — users & roles, rate-card editor, subscription plan editor, vendor management, reports (charts), audit log, settings (theming + i18n).

13. **HTML UI mockups — Stage 3: Customer App screens** → `./out/ui/customer/stage3/` — splash, login/OTP, home, service catalog, booking flow (address,  pickup slot, items, price preview), Razorpay checkout (mock), order tracking, profile, subscriptions, settings(language + theme).

14. **Seed data file** → `./out/seeders/rates.seed.ts` — TypeORM seeder with the rate tables from Section 2.3, ready to plug into the backend.

---

## 8. Rules of Engagement

- **Pause** for confirmation after each numbered deliverable.
- If something is ambiguous, **list assumptions** at the top of that deliverable rather than blocking on questions.
- Do **not** skip the `.docx` generation by emitting markdown instead — actually run python-docx and produce the file.
- **No React.** No Tailwind-via-React. No Next.js. The frontend story is Svelte 5 + SvelteKit + Flutter, full stop.
- Keep file sizes manageable; if a deliverable would exceed ~1500 lines, split it into clearly named sibling files and reference them from an index.
- Use realistic Indian context everywhere (names, addresses in Maharashtra, Marathi sample strings, INR formatting `₹1,250`).

---

## 9. Start

Begin with deliverable **#1 (architecture overview) only**. Stop after that and ask for `next`.
