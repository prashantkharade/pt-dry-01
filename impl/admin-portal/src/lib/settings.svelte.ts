import { browser } from '$app/environment';

/** Admin-portal personalization: theme mode, accent, text size and language.
 *
 * Client-side and reactive (Svelte 5 runes). Choices persist to localStorage
 * and are applied to `<html>` via CSS custom properties + a `data-theme`
 * attribute, mirroring the customer app's SettingsStore. Language is also
 * written to a cookie so it survives reloads. */

export type ThemeMode = 'system' | 'light' | 'dark';
export type Lang = 'en' | 'mr';

/** Accent (seed) colours — kept in sync with the customer app's palette.
 *  Hex is used for the picker swatches; the HSL triplet drives `--primary-hsl`
 *  so the token can be alpha-composited across the UI. */
export const ACCENTS: Record<string, string> = {
  blue  : '#2563eb',
  teal  : '#0d9488',
  green : '#059669',
  purple: '#7c3aed',
  orange: '#ea580c',
  pink  : '#db2777',
};

/** Accent id → HSL triplet for `--primary-hsl` (space-separated, no hsl()). */
export const ACCENT_HSL: Record<string, string> = {
  blue  : '221 83% 53%',
  teal  : '173 80% 32%',
  green : '161 84% 30%',
  purple: '262 83% 58%',
  orange: '21 90% 48%',
  pink  : '330 81% 51%',
};

/** Light-mode background tints (dark mode uses the dark theme's own --bg). */
export const BACKGROUNDS: Record<string, string> = {
  default : '#f5f7fb',
  white   : '#ffffff',
  warm    : '#fdf6ec',
  mint    : '#eff7f1',
  lavender: '#f3f0fa',
};

export const LANGS: Lang[] = ['en', 'mr'];
export const MIN_SCALE = 0.9;
export const MAX_SCALE = 1.3;

/** Font-family allow-list → CSS font stack (BRIEF §2.5 / guide 04 §4.1). */
export const FONTS: Record<string, string> = {
  Inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'Noto Sans': "'Noto Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  'Noto Sans Devanagari': "'Noto Sans Devanagari', 'Noto Sans', system-ui, sans-serif",
  Roboto: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif",
};

/** Border style → corner radius in px (guide 04 §4.1: soft|sharp|pill). */
export const BORDER_STYLES: Record<string, string> = {
  soft: '10px',
  sharp: '3px',
  pill: '999px',
};

/** Font that renders Devanagari — prepended when the UI is in Marathi. */
const DEVANAGARI = "'Noto Sans Devanagari'";

const KEY = 'ptk.settings';

export const settings = $state({
  mode: 'system' as ThemeMode,
  accent: 'blue',
  background: 'default',
  fontScale: 1,
  lang: 'en' as Lang,
  font: 'Inter',
  border: 'soft',
});

function clamp(n: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
}

/** Reads saved choices and applies them. Call once on mount. */
export function loadSettings(): void {
  if (!browser) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (['system', 'light', 'dark'].includes(s.mode)) settings.mode = s.mode;
      if (ACCENTS[s.accent]) settings.accent = s.accent;
      if (typeof s.fontScale === 'number') settings.fontScale = clamp(s.fontScale);
      if (LANGS.includes(s.lang)) settings.lang = s.lang;
      if (FONTS[s.font]) settings.font = s.font;
      if (BORDER_STYLES[s.border]) settings.border = s.border;
      if (BACKGROUNDS[s.background]) settings.background = s.background;
    }
  } catch {
    /* corrupt storage — fall back to defaults */
  }
  applySettings();
}

function persist(): void {
  if (!browser) return;
  localStorage.setItem(KEY, JSON.stringify({ ...settings }));
  document.cookie = `ptk_lang=${settings.lang}; path=/; max-age=31536000; samesite=lax`;
}

/** Pushes the current settings onto the document root. */
export function applySettings(): void {
  if (!browser) return;
  const root = document.documentElement;
  const dark =
    settings.mode === 'dark' ||
    (settings.mode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', dark ? 'ptk-dark' : 'ptk-light');
  // Accent drives the semantic --primary-hsl triplet; --primary/--ring/--accent
  // derive from it in styles.css.
  root.style.setProperty('--primary-hsl', ACCENT_HSL[settings.accent]);
  // Background tint applies in light mode only; in dark mode the dark theme's
  // own --background must win, so clear any inline override.
  if (dark) root.style.removeProperty('--background');
  else root.style.setProperty('--background', BACKGROUNDS[settings.background]);
  root.style.setProperty('--font-scale', String(settings.fontScale));
  root.style.setProperty('--radius', BORDER_STYLES[settings.border]);
  // Marathi forces a Devanagari-capable face so glyphs never fall back to tofu.
  const stack = FONTS[settings.font];
  root.style.setProperty('--font', settings.lang === 'mr' ? `${DEVANAGARI}, ${stack}` : stack);
  root.setAttribute('lang', settings.lang);
}

export function setMode(m: ThemeMode): void {
  settings.mode = m;
  persist();
  applySettings();
}

export function setAccent(a: string): void {
  if (!ACCENTS[a]) return;
  settings.accent = a;
  persist();
  applySettings();
}

export function setBackground(b: string): void {
  if (!BACKGROUNDS[b]) return;
  settings.background = b;
  persist();
  applySettings();
}

export function setFontScale(n: number): void {
  settings.fontScale = clamp(n);
  persist();
  applySettings();
}

export function setLang(l: Lang): void {
  if (!LANGS.includes(l)) return;
  settings.lang = l;
  persist();
  applySettings();
}

export function setFont(f: string): void {
  if (!FONTS[f]) return;
  settings.font = f;
  persist();
  applySettings();
}

export function setBorder(b: string): void {
  if (!BORDER_STYLES[b]) return;
  settings.border = b;
  persist();
  applySettings();
}

export function resetSettings(): void {
  settings.mode = 'system';
  settings.accent = 'blue';
  settings.background = 'default';
  settings.fontScale = 1;
  settings.lang = 'en';
  settings.font = 'Inter';
  settings.border = 'soft';
  persist();
  applySettings();
}
