# Personalization (Theming + i18n) — Implementation Status

> **Status doc**, not a design doc. It records what was actually built in `impl/`
> for the BRIEF §2.5 **theming** and **i18n** requirements, maps each spec token
> to real files, and — as required — calls out every **deviation** from the
> guide and every **extra** added beyond the literal BRIEF.
>
> Companion specs: [`04-cross-cutting.md`](04-cross-cutting.md) §3 (i18n) & §4
> (theming), [`02-admin-portal.md`](02-admin-portal.md) §8–§9,
> [`03-customer-app-flutter.md`](03-customer-app-flutter.md) §10–§11.
>
> Last updated: 2026-07-11.

---

## 1. BRIEF §2.5 requirement → status

> **Theming:** user-configurable background colour, border style, font family,
> font size (typography), light/dark — both in admin portal and customer app.
> Persist per-user.
> **i18n:** English + Marathi across admin portal and mobile/web app.

| Token (guide 04 §4.1) | Customer app (Flutter) | Admin portal (SvelteKit) |
|-----------------------|------------------------|--------------------------|
| `mode` (light/dark/system) | ✅ `ThemeMode` on `MaterialApp` | ✅ `data-theme` on `<html>` |
| `background` colour   | ✅ 5 tint presets (light mode) | ✅ 5 tint presets (light mode) |
| `accent`              | ✅ 6 seed colours | ✅ 6 accent colours |
| `borderStyle` / `borderRadius` | ✅ soft/sharp/pill → inputs, buttons, cards | ✅ soft/sharp/pill → `--radius` |
| `fontFamily`          | ✅ Roboto / Inter / Noto Sans / Noto Sans Devanagari (`google_fonts`) | ✅ same allow-list via CSS font stacks + Google Fonts `<link>` |
| `fontSizeScale`       | ✅ slider → `MediaQuery.textScaler` | ✅ slider → `--font-scale` on `html` |
| **Persist per-user**  | ✅ local (`shared_preferences`) **+** backend `PATCH /users/me` | ✅ local (`localStorage`) + `ptk_lang` cookie |
| **i18n en + mr**      | ✅ `flutter_localizations` + gen-l10n ARB | ✅ custom typed dictionary (`src/lib/i18n.ts`) |

All five theming dimensions + light/dark + Marathi are live in **both** apps.

---

## 2. Where it lives

### Customer app (`impl/customer-app`)
- `lib/core/settings/settings_store.dart` — `SettingsStore` (singleton
  `ChangeNotifier`, mirrors `AuthStore`). Holds mode/accent/background/font/
  border/textScale/language; persists to `shared_preferences`; syncs to
  identity-service and hydrates from `GET /users/me`.
- `lib/app/theme.dart` — `AppTheme.light/dark(...)` builds `ThemeData` from the
  tokens (seed colour, background, Google font `TextTheme`, corner radius on
  `inputDecorationTheme` + `cardTheme`).
- `lib/app/app.dart` — `MaterialApp` wrapped in `AnimatedBuilder(settings)`;
  wires `theme`/`darkTheme`/`themeMode`/`locale`/`localizationsDelegates`/
  `supportedLocales` and a `MediaQuery.textScaler` override.
- `lib/features/settings/settings_screen.dart` — the Settings UI (`/settings`,
  reachable from the Home app-bar gear).
- `lib/l10n/app_en.arb`, `app_mr.arb`, `l10n.yaml` — translations (all screens).
- Backend sync target: identity-service `User.ThemePrefs` (jsonb) +
  `User.PreferredLanguage` via `PATCH /api/v1/users/me`.

### Admin portal (`impl/admin-portal`)
- `src/lib/settings.svelte.ts` — runes `settings` store + `apply/persist` +
  setters; writes `data-theme`, `--accent`, `--bg`, `--font`, `--radius`,
  `--font-scale` and `lang` onto `<html>`.
- `src/lib/i18n.ts` — `t(key)` over `en`/`mr` dictionaries (reactive on
  `settings.lang`).
- `src/routes/(app)/settings/+page.svelte` — the Settings page (nav entry added).
- `src/styles.css` — `:root[data-theme='ptk-dark']` tokens + `html { font-size:
  calc(100% * var(--font-scale)) }`.
- `src/app.html` — pre-paint no-FOUC script + Google Fonts `<link>`.
- Localized so far: app shell (nav/brand/sign-out), dashboard, settings page.

---

## 3. Deviations from the guide (04 §4 / 02 §8–9 / 03 §10–11)

These are intentional and noted here per the "document anything extra" rule.

1. **Backend storage location.** Guide 04 §4.1 says store at
   `user.preferences.theme`, cache in Redis `user:<id>:prefs` (10-min TTL).
   **Actual:** the existing identity-service schema already exposes
   `User.ThemePrefs` (free-form jsonb) + `User.PreferredLanguage` via
   `PATCH /users/me`; the app writes those. **No Redis prefs cache** was added
   (the field is read on login/splash, not hot-path). The stored `ThemePrefs`
   shape is `{ mode, accent, background, textScale, fontFamily, borderStyle }`
   and preserves the documented `{ "mode": "dark" }` example.
2. **Admin i18n library.** Guide 02 §9 / 04 §3 recommend `paraglide-js`.
   **Actual:** a ~60-line typed dictionary in `src/lib/i18n.ts` (no new
   dependency — the portal still ships only `zod`). BRIEF only requires en+mr,
   which is met. Swappable to paraglide later without touching call sites much.
3. **Admin font loading.** Guide suggests `@fontsource/*`. **Actual:** a Google
   Fonts `<link>` in `app.html` + system-font fallback stacks. Avoids adding npm
   font packages; degrades gracefully offline to system fonts.
4. **Theme hydration.** Guide 02 §8/04 §4.2 suggest SSR-injected inline `<style>`
   from `+layout.server.ts`. **Actual:** a synchronous pre-paint script in
   `app.html` reading `localStorage` (client-side, still no FOUC). Language also
   written to a `ptk_lang` cookie for future SSR use.
5. **`fontSizeScale` is continuous, not discrete.** Guide lists
   `0.875 | 1 | 1.125 | 1.25`. **Actual:** a slider (customer 0.85–1.40; admin
   0.9–1.3). Superset of the discrete steps.
6. **`background` is preset tints, not a free picker.** Guide 04 §4.1 allows
   "any picker value". **Actual:** 5 curated tints (default/white/warm/mint/
   lavender) for a cleaner UX; applies in light mode only (dark mode keeps the
   dark theme's `--bg`).
7. **Default accent.** Guide 04 §4.4 default is laundry-sky `#0EA5E9`.
   **Actual:** kept the app's shipped brand blue `#2563EB` as default (sky is
   not currently in the palette). Purely a default choice.
8. **No separate `surface` control.** The token list includes `surface`; it is
   derived from the theme rather than user-configurable (BRIEF §2.5 itself does
   not list surface).
9. **Multi-theme preset `.theme.ts` files** (guide 02 §8, rean pattern) were not
   used; a single token system driven by runtime CSS variables is used instead.

## 4. Extras added beyond the literal BRIEF list

- **Per-account sync + cross-device hydrate** for the customer app (write on
  change; read on splash and just after OTP login).
- **Reset-to-defaults** action on both Settings screens.
- **Live text-size preview** block on both Settings screens.
- **Marathi Devanagari auto-fallback**: when the UI language is Marathi, both
  apps force a Devanagari-capable face so glyphs never tofu, regardless of the
  chosen font (matches guide 03 §10 intent).

## 5. Admin-portal design-token system (aligned to `form-builder-ui`)

The admin portal's colour + typography system was upgraded to match the good
practices in the reference `D:\charqol\form-builder-ui` (a shadcn-svelte
project), adapted to the portal's **vanilla-CSS, no-Tailwind** setup
(`src/styles.css`):

- **Full semantic token set with `-foreground` pairings** — `background`,
  `card`, `popover`, `muted`, `secondary`, `primary`, `destructive`, `success`,
  `warning`, plus each one's readable foreground; `border`, `input`, and a
  dedicated **`--ring`** focus token (previously focus reused the accent).
- **`--primary-hsl` HSL triplet** as the accent source of truth, so tinted
  surfaces alpha-composite (`hsl(var(--primary-hsl) / 0.08)`) and follow the
  chosen accent — this replaced every hard-coded `rgba(37,99,235,…)` and stray
  hex across the pages (nav hover, active tabs/options, table row hover, badges,
  customer card).
- **Proper slate light/dark palette** (values ported from the reference) instead
  of a handful of ad-hoc hexes.
- **Typography scale** — explicit `h1–h4` sizes/weights, tuned `line-height`,
  negative letter-spacing on headings, `text-wrap: balance`, font-smoothing, and
  `--muted-foreground` for secondary text.
- **Backward-compatible aliases** (`--surface`, `--text`, `--accent`,
  `--accent-fg`, `--bg`, `--danger`) are retained so existing component styles
  keep working; the runtime store now drives `--primary-hsl`, `--background`,
  `--radius`, `--font`, `--font-scale`.

The Flutter customer app already gets this "for free" via **Material 3**
(`ColorScheme.fromSeed` → full semantic roles + on-colour pairings, plus the
Material type scale applied through the chosen Google font), so no parallel
colour refactor was needed there.

## 6. Known gaps / not done (still out of scope)

- Admin portal is localized for the **shell + dashboard + settings** only; the
  orders / customers / new-order / order-detail pages still show English. The
  i18n scaffold is in place to extend (`src/lib/i18n.ts`).
- No offline/PWA, audit log, or Redis prefs cache (unrelated BRIEF §2.5 items,
  tracked elsewhere).
- Customer-app `background` presets are colour tints only (no wallpaper images).
