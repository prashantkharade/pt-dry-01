# Admin Portal Implementation Guide (SvelteKit + Svelte 5)

> Stack mandate (`../BRIEF.md` §3): **Svelte 5 (runes) + SvelteKit 2 (SSR) + TypeScript. No React.**
>
> Primary references:
> - **`D:\Rean\admin-portal-v2`** — most mature SvelteKit 2 + Svelte 5 (runes) portal. Hooks-based session auth, Zod validation, theme selector, Chart.js dashboards, Playwright + Vitest, flash messages.
> - **`D:\kleo\kleo-ui`** — best **two-tier API client** (`routes/api/server/<x>/+server.ts` BFF → `routes/api/services/<x>.ts` HTTP wrapper). PWA service worker. Theme store.
> - **`D:\Batterlicious\admin-portal`** — order-business specific x-components library, route groups `(auth)` / `(admin)`, hooks.server session.
> - **`D:\charqol\form-builder-ui`** — **Bits UI + superforms + Zod** stack (the most modern stack of the bunch — pull this in for new forms).

---

## 1. Project skeleton

Bootstrap a fresh SvelteKit 2 + TS project, then copy these files verbatim from rean:

| File                                                  | From                                                              |
|-------------------------------------------------------|-------------------------------------------------------------------|
| `svelte.config.js`                                    | `D:\Rean\admin-portal-v2\svelte.config.js`                        |
| `vite.config.ts`                                      | `D:\Rean\admin-portal-v2\vite.config.ts` (Vite 6, Tailwind plugin, Vitest workspaces) |
| `tsconfig.json`                                       | `D:\Rean\admin-portal-v2\tsconfig.json` (extends `.svelte-kit/tsconfig.json`) |
| `eslint.config.js`                                    | `D:\Rean\admin-portal-v2\eslint.config.js` (flat config, ESLint 9) |
| `playwright.config.ts`                                | `D:\Rean\admin-portal-v2\playwright.config.ts`                    |
| `vitest-setup-client.ts`                              | `D:\Rean\admin-portal-v2\vitest-setup-client.ts`                  |
| `tailwind.config.js`                                  | `D:\kleo\kleo-ui\tailwind.config.js` (`darkMode: 'class'`, primary/secondary/neutral palette) |

**Adapter:** `@sveltejs/adapter-node` (single VPS deploy, BRIEF §3). Output → `build/`.

---

## 2. Route layout

Pattern: `D:\Batterlicious\admin-portal\src\routes\` + `D:\kleo\kleo-ui\src\routes\`.

Use SvelteKit **route groups** to separate auth, admin, and customer-facing sections:

```
src/routes/
├── +layout.svelte                ← root layout (toast renderer + flash message integration; rean pattern)
├── +layout.server.ts             ← server load wrapped with loadFlashMessage()
├── +error.svelte
├── (auth)/                       ← anonymous routes
│   ├── signin/+page.svelte
│   ├── signin/+page.server.ts    ← form action; calls identity-service
│   ├── otp/+page.svelte
│   └── reset-password/+page.svelte
├── (app)/                        ← authenticated; +layout.server.ts validates session
│   ├── +layout.svelte            ← shell w/ Sidebar + topbar
│   ├── +layout.server.ts         ← requires sessionUser; redirects to /signin if null
│   ├── dashboard/+page.svelte    ← Chart.js KPIs (rean BarChart/PieChart pattern)
│   ├── orders/
│   │   ├── +page.svelte          ← OrderTable (Batterlicious x-components)
│   │   ├── new/+page.svelte      ← Receptionist intake (BRIEF deliverable #11)
│   │   └── [orderId]/+page.svelte
│   ├── customers/
│   ├── vendors/
│   ├── rate-cards/+page.svelte   ← rate-card editor (BRIEF deliverable #12)
│   ├── subscriptions/
│   ├── reports/
│   ├── settings/
│   │   ├── theming/+page.svelte
│   │   ├── i18n/+page.svelte
│   │   └── audit-log/+page.svelte
│   └── users/                    ← admin-only; gate via load fn
└── api/                          ← server-only BFF endpoints (see §4)
    ├── server/
    │   ├── orders/+server.ts
    │   ├── customers/+server.ts
    │   └── ...
    ├── services/                 ← typed HTTP wrappers to identity/orders/payments services
    └── cache/
        └── session/session.manager.ts
```

**Receptionist-only vs Admin-only:** in each `+layout.server.ts` or `+page.server.ts`, check `event.locals.sessionUser.roleName` and throw `redirect(302, '/forbidden')` if mismatched. Reference: rean's `(app)/admin/...` paths gate by role in load.

**Print-friendly pages — `+page@.svelte` breakout layout.** Batterlicious puts invoice/label/packing-slip printables under e.g. `routes/.../packaging/[orderId]/print-label/+page@.svelte`. The `@` suffix on `+page` **resets to the root layout**, so the page renders without dashboard chrome — perfect for A4/A6 printing. Adopt this exact pattern for:
- `/orders/[orderId]/print-invoice/+page@.svelte` — customer/vendor invoice PDF preview
- `/orders/[orderId]/print-tag/+page@.svelte` — garment tag (A6) with order id, item code, intake date, customer phone
- `/orders/[orderId]/print-receipt/+page@.svelte` — intake receipt for walk-in customers
See [`06-extended-patterns.md`](06-extended-patterns.md) §16 for the route map.

**Role-prefixed routes.** Batterlicious splits routes by role under `routes/users/{sys-admin|vendor|sys-user}/[userId]/...`. PT Kharade has fewer roles — collapse to **two trees** under `(app)/`: `(app)/admin/...` for SystemAdmin-only sections (users, rate cards, reports, audit log, settings) and the unprefixed `(app)/orders|customers|vendors` for shared Admin+Receptionist pages. Receptionist-only check happens in the page-level `+page.server.ts`.

---

## 3. Svelte 5 runes — required usage

Adopt runes for **all new components**. Reference: `D:\Rean\admin-portal-v2\src\lib\components\home\Sidebar.svelte`.

| Rune          | Use for                                                  |
|---------------|----------------------------------------------------------|
| `$state(...)` | All local reactive state (replaces `let x = ...` with implicit reactivity) |
| `$props()`    | Component props (destructured). Use `$bindable()` for two-way bind |
| `$derived(x)` | Computed values (replaces `$:`)                          |
| `$effect(fn)` | Side-effects that run on dependency change               |
| `$inspect`    | Dev-only debugging                                       |

**Example skeleton** (sidebar pattern, rean):
```svelte
<script lang="ts">
  let { showSidebar = $bindable(), sessionUser, navItems } = $props<{
    showSidebar: boolean;
    sessionUser: SessionUser;
    navItems: NavItem[];
  }>();

  let activeTab = $state('Home');
  const visibleItems = $derived(navItems.filter(i => can(sessionUser, i.permission)));

  $effect(() => {
    if (navigating) showSidebar = false;
  });
</script>
```

**Stores migration:** the existing `D:\Rean\admin-portal-v2\src\lib\store\` files use the legacy `writable`/`derived`. New stores should use runes-in-class pattern (`$state` inside an exported `class`) or stay as `writable` for cross-component reactive arrays — both are valid in Svelte 5; pick one per store and don't mix.

---

## 4. Two-tier API client (the most important pattern)

This is **the** SvelteKit pattern in this codebase. Reference:

- `D:\kleo\kleo-ui\src\routes\api\server\kleo\customers\+server.ts` — BFF endpoint (browser-callable)
- `D:\kleo\kleo-ui\src\routes\api\services\customers\customers.ts` — typed HTTP wrapper around the actual backend service

```
+page.svelte  ── fetch('/api/server/orders')           (Svelte page; sessionId from cookie auto-included)
       │
       ▼
+server.ts ─── server endpoint with event.locals.sessionUser
       │       Validates input (Zod), authorises, calls service wrapper
       ▼
services/orders/orders.ts ── HTTP client to https://orders.ptkharade.in
       │
       ▼
orders-service (Node backend) ─ JWT validated, returns ResponseDto
```

**Why two-tier:**
- Browser **never** sees the backend URL or JWT — only the SvelteKit session cookie.
- BFF can aggregate calls across services (rean's careplan endpoint aggregates from 6 backend services in one page load).
- Input validation lives at the BFF edge (Zod) and again at the backend (Joi) — defence in depth.

**Server endpoint template** (kleo pattern):
```ts
// src/routes/api/server/orders/+server.ts
import type { RequestEvent } from '@sveltejs/kit';
import { createOrderSchema } from '$lib/validation/orders.schema';
import { ResponseHandler } from '$lib/helper/response';
import { createOrder } from '../../services/orders/orders';

export const POST = async (event: RequestEvent) => {
  const sessionUser = event.locals.sessionUser;
  if (!sessionUser) return ResponseHandler.unauthorized();

  const data = await event.request.json();
  const parsed = createOrderSchema.safeParse(data);
  if (!parsed.success) return ResponseHandler.badRequest(parsed.error.flatten());

  const result = await createOrder(sessionUser.sessionId, parsed.data);
  return ResponseHandler.success(result);
};
```

**Service wrapper template** (kleo pattern):
```ts
// src/routes/api/services/orders/orders.ts
import { BACKEND_API_URL } from '$env/static/private';
import { post_, get_, put_, delete_ } from '../client';

export const createOrder = async (sessionId: string, body: OrderCreateModel) => {
  const url = `${BACKEND_API_URL}/orders`;
  return post_(url, body, /* requiresAuth */ true, sessionId);
};
```

The `post_/get_/put_/delete_` helpers wrap axios; they attach `Authorization: Bearer <jwt-from-session>` and the inter-service `x-api-key` if needed.

---

## 5. Session auth — `hooks.server.ts`

Source: `D:\Rean\admin-portal-v2\src\hooks.server.ts` + `D:\Batterlicious\admin-portal\src\hooks.server.ts`.

Adopt verbatim:
```ts
export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('sessionId');
  if (sessionId) {
    const session = await SessionManager.getSession(sessionId);
    if (session) {
      event.locals.sessionUser = {
        sessionId,
        userId: session.userId,
        tenantId: session.tenantId,
        email: session.email,
        username: session.username,
        roleId: session.roleId,
        roleName: session.roleName,
        profileImageUrl: session.profileImageUrl
      };
    }
  }
  return resolve(event);
};

export const handleError: HandleServerError = ({ error, event }) => ({
  message: extractMessage(error),
  code: extractCode(error),
  userId: event.locals.sessionUser?.userId
});
```

**`SessionManager`** (`D:\Rean\admin-portal-v2\src\routes\api\cache\session\session.manager.ts`):
- Reads session from in-memory cache; falls back to Redis; falls back to identity-service.
- TTL aligned with backend JWT expiry (1 h).

**`event.locals` typing:** declare in `src/app.d.ts`:
```ts
declare global {
  namespace App {
    interface Locals { sessionUser: SessionUser | null; }
    interface PageData {}
    interface Error { code?: string; }
    interface Platform {}
  }
}
```

---

## 6. Forms & validation

Two valid patterns in the references; pick one per page and don't mix.

### 6.1 Custom helper + Zod (rean)
Use this for **simple forms** (signin, OTP, single-field edit).
- Helper: `D:\Rean\admin-portal-v2\src\lib\helper\validate.form.ts` (`validateFormData(formData, schema)`).
- Server: form action returns `fail(400, { error, errors })` or `redirect(303, url, flash)`.

### 6.2 sveltekit-superforms + Zod (charqol form-builder-ui)
Use this for **complex forms** (order intake, rate-card editor, subscription plan). Reference: `D:\charqol\form-builder-ui\package.json` lists `sveltekit-superforms@2.23.1`. Pattern:
```ts
// +page.server.ts
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { createOrderSchema } from '$lib/validation/orders.schema';

export const load = async () => ({ form: await superValidate(zod(createOrderSchema)) });

export const actions = {
  default: async ({ request, locals }) => {
    const form = await superValidate(request, zod(createOrderSchema));
    if (!form.valid) return fail(400, { form });
    const res = await createOrder(locals.sessionUser.sessionId, form.data);
    redirect(303, `/orders/${res.id}`);
  }
};
```

**Zod schemas** live in `src/lib/validation/<domain>.schema.ts` — reference: `D:\kleo\kleo-ui\src\lib\validation\customer.schema.ts`. Co-locate enums imported from `$lib/types`.

---

## 7. Component library

**Decision: hybrid.** Use **Bits UI + Tailwind** for headless primitives (dropdown, dialog, popover, command, tooltip) and a **custom `x-components/<domain>/` folder** for branded domain components.

| Need                                 | What to use                                 | Reference                                                                 |
|--------------------------------------|---------------------------------------------|---------------------------------------------------------------------------|
| Headless primitives                  | **Bits UI** (already used in charqol)       | `D:\charqol\form-builder-ui\package.json`                                  |
| Theme tokens / colors                | Tailwind v4 + CSS variables (rean/kleo)     | `D:\kleo\kleo-ui\tailwind.config.js`                                       |
| Icons                                | `@iconify/svelte` (rean)                    | `D:\Rean\admin-portal-v2\package.json`                                     |
| Charts                               | **Chart.js** wrapped per type               | `D:\Rean\admin-portal-v2\src\lib\components\` (BarChart, PieChart, Line)   |
| Toast notifications                  | Custom store + renderer (rean)              | `D:\Rean\admin-portal-v2\src\lib\components\toast\toast.store.ts`          |
| Modals / dialogs                     | Custom (rean) or Bits UI Dialog             | `D:\Rean\admin-portal-v2\src\lib\components\confirm.modal.svelte`          |
| Data tables / lists                  | Custom Table.svelte + pagination via query  | `D:\kleo\kleo-ui\src\lib\components\common\Table.svelte` + Batterlicious `OrderTable.svelte` |
| Form inputs                          | Custom (rean has `input/`, kleo has full set) | `D:\kleo\kleo-ui\src\lib\components\` (`Input`, `Select`, `DatePicker`)   |
| Tree view (nested menus, categories) | rean `tree-view.svelte`                     | `D:\Rean\admin-portal-v2\src\lib\components\tree-view.svelte`              |
| Status badges                        | kleo `StatusBadge.svelte`                   | `D:\kleo\kleo-ui\src\lib\components\` (use for order status)               |
| Offline banner                       | kleo `OfflineIndicator.svelte`              | `D:\kleo\kleo-ui\src\lib\components\` (network status)                     |

**Folder convention** (Batterlicious):
```
src/lib/x-components/
├── order/
│   ├── OrderTable.svelte
│   ├── OrderDetailModal.svelte
│   ├── StatusUpdateModal.svelte
│   └── BillPreview.svelte
├── rate-card/
├── customer/
├── vendor/
├── delivery-management/    ← lift wholesale from D:\Batterlicious\admin-portal\src\lib\x-components\delivery-management\
│   ├── DeliveryTabBar.svelte
│   ├── DeliveryStatsCard.svelte
│   ├── HubSelector.svelte
│   ├── SlotSelector.svelte
│   ├── PartnerDetailModal.svelte
│   ├── DeliveryAssignmentModal.svelte
│   ├── ZoneDetailModal.svelte
│   ├── AssignSlotModal.svelte
│   └── AssignZoneModal.svelte
└── settlement/             ← for vendor payouts; build new on shape from D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\revenue\vendor-payouts\+page.svelte
```

**Naming:** PascalCase Svelte files for domain components; kebab-case Svelte files for shared atoms (rean has both; standardise on this rule for new code).

---

## 8. Theming (BRIEF §2.5)

BRIEF requires user-configurable background colour, border style, font family, font size, light/dark — **persisted per user**.

Approach (combine rean + kleo):
1. **Theme tokens** in `src/lib/themes/<theme>.theme.ts` — see rean's `aha.theme.ts`, `gmu.theme.ts`, `rean.theme.ts`. Each exports CSS variable values for `--bg`, `--surface`, `--border`, `--text`, `--accent`, `--font-family`, `--font-size-base`, `--radius`.
2. **Theme store** (`src/lib/stores/theme.ts`) — kleo pattern. Writable holds `{ themeKey, mode: 'light' | 'dark' }`. Subscribes to localStorage. On change, writes `data-theme` and `class="dark"` on `<html>`.
3. **Tailwind setup** — `darkMode: 'class'`; reference Tailwind colors via the CSS variables (`bg-[--bg]`) for custom background, **or** define a Tailwind plugin that maps `bg-surface` to `var(--surface)`.
4. **User settings page** (`/settings/theming`) — sliders/colorpickers update the store; on save, persist to identity-service `user.preferences` so it follows the user across devices.
5. **SSR-safe** — initial theme read in `+layout.server.ts` from cookie + user prefs and injected as inline `<style>` to avoid FOUC.

**Font family options** — limit to a curated allow-list (Inter, Noto Sans, Noto Sans Devanagari for Marathi, Roboto). Load via `@fontsource/*`.

---

## 9. Internationalisation (English + Marathi)

**No reference repo implements this.** Recommendation: **`paraglide-js`** (compile-time, type-safe, SvelteKit-first).

Set-up:
1. `pnpm add -D @inlang/paraglide-js @inlang/paraglide-sveltekit`
2. `project.inlang/settings.json` lists `en` and `mr` (Marathi).
3. Message catalogues at `messages/en.json`, `messages/mr.json` — flat keys (`orders.new.title`, `actions.save`).
4. `+layout.server.ts` reads `Accept-Language` and user preference; sets `locale` on `event.locals` and a cookie.
5. Wrap root layout in `<ParaglideJS i18n={i18n}>`.
6. Marathi sample (BRIEF §4 demands realistic Marathi strings):
   - `orders.new.title` → "नवीन ऑर्डर"
   - `customers.search.placeholder` → "ग्राहक शोधा…"
7. **Backend-side i18n** for notifications (SMS/email) — store templates per locale, see `01-backend.md` §11.

**Marathi rendering check** — Noto Sans Devanagari covers Marathi glyphs cleanly.

---

## 10. Offline support (BRIEF §2.5)

Admin portal must cache last-loaded lists for read.

Reference: `D:\kleo\kleo-ui\src\lib\utils\registerServiceWorker.ts`. SvelteKit ships a service worker hook (`src/service-worker.ts`).

Strategy:
- **Network-first** for `/api/server/*` GETs; on failure, return last cached response.
- **Cache-first** for `/_app/*` static assets.
- Cache key per route + query string; max 50 entries per route.
- `OfflineIndicator.svelte` (kleo) listens on `online`/`offline` window events and renders a banner.
- For pages opened offline: render last-cached list with a "Showing offline data" notice.

**Do not** attempt offline writes from the admin portal (it's a desktop-bound tool; offline-write complexity belongs in the Flutter app).

---

## 11. Charts & reports

Reference: `D:\Rean\admin-portal-v2\src\lib\components\` contains `BarChart.svelte`, `PieChart.svelte`, `Line.svelte` wrapping Chart.js.

For BRIEF §6 Phase 6 reports:
- Revenue by service type (stacked bar)
- Orders by status (donut)
- Daily intake count (line)
- Top customers (table + horizontal bar)
- Vendor outstanding credit (table)

Each report has a `+page.server.ts` that calls the BFF (which aggregates from orders-service + payments-service). Cache the aggregation in Redis with 5-min TTL — reports do not need to be real-time.

---

## 12. Audit log UI

Display audit entries paginated under `/settings/audit-log`. Filters: user, resource, date range, action.

Audit row shape (matches backend audit entity — see `01-backend.md`):
```
{ id, userId, userName, action, resource, resourceId, before, after, ip, userAgent, createdAt }
```

`before` / `after` show as a diff (`json-diff-svelte` or render side-by-side). Receptionist cannot access this page (gate by role).

---

## 13. Testing

| Type             | Tool                       | Location          | Reference                                                         |
|------------------|----------------------------|-------------------|-------------------------------------------------------------------|
| Unit (components)| Vitest + @testing-library/svelte (jsdom) | `*.svelte.test.ts` next to component | rean Vitest workspaces in `vite.config.ts` |
| Unit (server)    | Vitest (node)              | `*.spec.ts`       | rean Vitest workspaces                                            |
| E2E              | Playwright                 | `e2e/*.spec.ts`   | `D:\Rean\admin-portal-v2\playwright.config.ts` (runs on `preview` :4173) |
| Visual regression| Playwright snapshots       | `e2e/__snapshots__/` | optional                                                       |

E2E smoke flows (must exist by phase 2):
- Signin → Dashboard
- Receptionist creates a walk-in order
- Admin edits a rate card and the change reflects in a new order's price preview

---

## 14. Build & deploy

- `pnpm build` → `build/` directory (adapter-node)
- Dockerfile multi-stage build (refer rean Dockerfile)
- Healthcheck endpoint: `/healthz` returns 200 if Redis + identity-service reachable
- Behind nginx in single-VPS phase

---

## 15. Coding conventions

Inherited from rean:
- **Prettier** with `prettier-plugin-svelte` + `prettier-plugin-tailwindcss`
- **ESLint flat config**, `@sveltejs/eslint-plugin-svelte`, `typescript-eslint`
- File naming: `.svelte` components PascalCase if branded, kebab-case if generic; `.ts` always kebab-case
- One default export per `.svelte` file
- Always type `$props()` and `$state()`
- Never directly `fetch()` to backend URLs from the browser — always go through `/api/server/...`
- Never store JWTs in localStorage or sessionStorage — only HTTP-only `sessionId` cookie
- Path aliases: `$lib`, `$routes`, `$themes` (rean uses these)

---

## 16. Quick checklist for a new admin page

Adding **/orders** (list + create + detail) — every file has a reference:

1. `src/routes/(app)/orders/+page.server.ts` → load orders via `/api/server/orders` (kleo pattern)
2. `src/routes/(app)/orders/+page.svelte` → `OrderTable` x-component, search input, pagination
3. `src/routes/(app)/orders/new/+page.server.ts` → `superValidate` form with `createOrderSchema`
4. `src/routes/(app)/orders/new/+page.svelte` → step-wise intake (BRIEF deliverable #11 walkthrough)
5. `src/routes/(app)/orders/[orderId]/+page.server.ts` → load order + history
6. `src/routes/(app)/orders/[orderId]/+page.svelte` → detail, status badge, action buttons (gated by role)
7. `src/lib/validation/orders.schema.ts` → Zod schemas (mirror backend Joi)
8. `src/lib/x-components/order/OrderTable.svelte` → reusable list (Batterlicious pattern)
9. `src/lib/x-components/order/StatusUpdateModal.svelte` → Bits UI Dialog wrapper
10. `src/routes/api/server/orders/+server.ts` (GET, POST) + `[orderId]/+server.ts` (GET, PATCH) → BFF endpoints
11. `src/routes/api/services/orders/orders.ts` → HTTP wrapper
12. `e2e/orders.spec.ts` → Playwright smoke

Open `D:\Batterlicious\admin-portal\src\routes\` next to your new code while writing — it covers nearly the same shape.

---

## 17. Admin pages to lift wholesale

Batterlicious has working Svelte implementations for several pages PT Kharade will need. Each is a "look at this and adapt" reference, not a "copy-paste":

| PT Kharade page                              | Reference page                                                                                                                                          |
|----------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/orders` list                                | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\orders\+page.svelte`                                                                |
| `/orders/preparations` (laundry batches)      | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\orders\preparations\+page.svelte` — see [`06`](06-extended-patterns.md) §3           |
| `/orders/subscriptions`                       | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\orders\subscriptions\+page.svelte`                                                  |
| `/discounts`                                  | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\orders\discounts\+page.svelte`                                                      |
| `/products` (items + categories)              | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\products\+page.svelte` and `product-categories\+page.svelte`                        |
| `/vendors`                                    | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\vendors\+page.svelte`                                                                |
| `/delivery` (zones/hubs/partners/slots)        | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\delivery\+page.svelte` — see [`06`](06-extended-patterns.md) §2                       |
| `/customers`                                  | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\all-users\+page.svelte`                                                              |
| `/packaging` (intake → out-for-delivery)       | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\packaging\+page.svelte` (+ print-label / print-order sub-pages)                     |
| `/revenue` (dashboard)                        | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\revenue\+page.svelte`                                                                |
| `/revenue/transactions/[id]/print-invoice`    | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\revenue\transactions\[transactionId]\print-invoice\+page@.svelte`                   |
| `/revenue/vendor-payouts`                     | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\revenue\vendor-payouts\+page.svelte`                                                |
| `/revenue/wallets`                            | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\revenue\wallets\+page.svelte`                                                       |
| `/analytics`                                  | `D:\Batterlicious\admin-portal\src\routes\users\sys-admin\[userId]\analytics\+page.svelte`                                                              |

For each, the matching `x-components/<domain>/` folder ships the table, modals, and detail components.

---

*Admin portal guide ends here. Continue with [`03-customer-app-flutter.md`](03-customer-app-flutter.md).*
