# PT Kharade Drycleaners & Laundry — Digital Ecosystem

End-to-end platform for **PT Kharade Group of Industries** covering the
laundry, dry-clean, and iron-press business: backend microservices,
SvelteKit admin portal, and Flutter customer app (Android, iOS, web).

## Repository layout

```
PTDRY/
├── README.md           ← this file (short overview + how to use)
├── BRIEF.md            ← full project brief / Claude Code prompt
└── out/                ← all generated artefacts land here
    ├── docs/           architecture, data model, API + workflows, phase plans
    ├── prompts/        backend / frontend / mobile implementation prompts
    ├── proposals/      Word proposals (medium & premium)
    ├── ui/             hi-fi HTML mockups, grouped by role and stage
    └── seeders/        rate-card seed data for the backend
```

## Tech stack (fixed)

| Layer            | Stack                                                         |
|------------------|---------------------------------------------------------------|
| Backend          | Node.js + TypeScript + Express + TypeORM + PostgreSQL + Redis |
| Admin portal     | Svelte 5 + SvelteKit (SSR) — **no React**                     |
| Customer app     | Flutter + Dart (Android, iOS, web from one codebase)          |
| Payments         | Razorpay (orders, payments, subscriptions, webhooks)          |
| Notifications    | SMS (MSG91-class), Email (SES/SMTP), WhatsApp (optional), FCM |
| Infra (initial)  | Docker + GitHub Actions, single VPS → managed K8s later       |

## Scope at a glance

- **Services:** dry-clean, laundry (wash+iron), press-only
- **Collection:** home pickup *or* drop at shop
- **Delivery:** home delivery (surcharge) *or* customer pickup at shop
- **Customers:** retail walk-ins **and** B2B vendors (hotels, hospitals — bedsheets, curtains, couch covers)
- **Roles:** System Admin · Receptionist · Customer
- **Subscriptions:** monthly / quarterly / half-yearly / yearly plans with discounted rates
- **i18n:** English + Marathi (admin portal and customer app)
- **Theming:** user-configurable background, borders, font family, font size
- **Offline:** admin portal read-cache; customer app draft-and-sync

## How to use this repo with Claude Code

1. Open this folder in Claude Code: `claude e:\WORK\PTDRY`
2. Paste the contents of [`BRIEF.md`](BRIEF.md) into a fresh session.
3. Claude will produce one deliverable at a time (see Section 7 in the brief)
   and pause after each. Reply `next` to advance.
4. All output is written under `./out/` — review, commit, repeat.

## Phased delivery (vertical slices)

Each phase ends with a demoable slice across **backend + admin + app**.

1. Foundations + Auth + Master Data
2. Order intake + Billing + Status (admin portal first)
3. Customer app MVP (browse, book, pay, track)
4. Payments + Notifications (Razorpay + SMS/Email)
5. Subscriptions / Schemes + Vendor B2B
6. Offline + Marathi i18n + Theming + Reports
7. Hardening, analytics, multi-branch readiness

Costs and man-day estimates are produced in INR for both a **premium team**
and a **medium-quality team** (see `out/docs/04-plan-premium.md` and
`out/docs/05-plan-medium.md` once generated).

## Owner

**PT Kharade Group of Industries** — operating unit *PT Kharade Drycleaners and Laundry*.
