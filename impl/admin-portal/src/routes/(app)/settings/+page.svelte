<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    settings,
    ACCENTS,
    BACKGROUNDS,
    FONTS,
    BORDER_STYLES,
    LANGS,
    MIN_SCALE,
    MAX_SCALE,
    setMode,
    setAccent,
    setBackground,
    setFont,
    setBorder,
    setFontScale,
    setLang,
    resetSettings,
    type ThemeMode,
    type Lang,
  } from '$lib/settings.svelte';

  const modes: { value: ThemeMode; key: string }[] = [
    { value: 'system', key: 'settings.system' },
    { value: 'light', key: 'settings.light' },
    { value: 'dark', key: 'settings.dark' },
  ];
  const accentKeys: Record<string, string> = {
    blue: 'accent.blue', teal: 'accent.teal', green: 'accent.green',
    purple: 'accent.purple', orange: 'accent.orange', pink: 'accent.pink',
  };
  const borders: { value: string; key: string }[] = [
    { value: 'soft', key: 'settings.borderSoft' },
    { value: 'sharp', key: 'settings.borderSharp' },
    { value: 'pill', key: 'settings.borderPill' },
  ];
</script>

<h1>{t('settings.title')}</h1>

<section class="card section">
  <h2>{t('settings.appearance')}</h2>

  <!-- Theme mode -->
  <div class="field">
    <label>{t('settings.theme')}</label>
    <div class="seg">
      {#each modes as m (m.value)}
        <button
          type="button"
          class="btn secondary"
          class:active={settings.mode === m.value}
          onclick={() => setMode(m.value)}>{t(m.key)}</button>
      {/each}
    </div>
  </div>

  <!-- Accent colour -->
  <div class="field">
    <label>{t('settings.accent')}</label>
    <div class="swatches">
      {#each Object.entries(ACCENTS) as [id, color] (id)}
        <button
          type="button"
          class="swatch"
          class:active={settings.accent === id}
          style="background:{color}"
          title={t(accentKeys[id])}
          aria-label={t(accentKeys[id])}
          onclick={() => setAccent(id)}></button>
      {/each}
    </div>
  </div>

  <!-- Background (light-mode tint) -->
  <div class="field">
    <label>{t('settings.background')}</label>
    <div class="swatches">
      {#each Object.entries(BACKGROUNDS) as [id, color] (id)}
        <button
          type="button"
          class="swatch bordered"
          class:active={settings.background === id}
          style="background:{color}"
          aria-label={id}
          onclick={() => setBackground(id)}></button>
      {/each}
    </div>
  </div>

  <!-- Font family -->
  <div class="field">
    <label>{t('settings.font')}</label>
    <div class="seg">
      {#each Object.keys(FONTS) as f (f)}
        <button
          type="button"
          class="btn secondary"
          class:active={settings.font === f}
          style="font-family:{FONTS[f]}"
          onclick={() => setFont(f)}>{f}</button>
      {/each}
    </div>
  </div>

  <!-- Corner (border) style -->
  <div class="field">
    <label>{t('settings.cornerStyle')}</label>
    <div class="seg">
      {#each borders as b (b.value)}
        <button
          type="button"
          class="btn secondary"
          class:active={settings.border === b.value}
          style="border-radius:{BORDER_STYLES[b.value]}"
          onclick={() => setBorder(b.value)}>{t(b.key)}</button>
      {/each}
    </div>
  </div>

  <!-- Text size -->
  <div class="field">
    <label>{t('settings.textSize')} — {Math.round(settings.fontScale * 100)}%</label>
    <input
      type="range"
      min={MIN_SCALE}
      max={MAX_SCALE}
      step="0.05"
      value={settings.fontScale}
      oninput={(e) => setFontScale(parseFloat((e.target as HTMLInputElement).value))} />
    <p class="preview card">{t('settings.preview')}</p>
  </div>
</section>

<section class="card section" style="margin-top:1.5rem">
  <h2>{t('settings.language')}</h2>
  <div class="field">
    <div class="seg">
      {#each LANGS as l (l)}
        <button
          type="button"
          class="btn secondary"
          class:active={settings.lang === l}
          onclick={() => setLang(l as Lang)}>
          {l === 'en' ? t('lang.english') : t('lang.marathi')}
        </button>
      {/each}
    </div>
  </div>
</section>

<div style="margin-top:1.5rem" class="flex center gap">
  <button type="button" class="btn secondary" onclick={() => resetSettings()}>
    {t('settings.reset')}
  </button>
  <span class="muted small">{t('settings.savedNote')}</span>
</div>

<style>
  h1 { margin-top: 0; }
  .seg { display: inline-flex; gap: 0.5rem; flex-wrap: wrap; }
  .seg .btn.active { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
  .swatches { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .swatch {
    width: 40px; height: 40px; border-radius: 999px; cursor: pointer;
    border: 2px solid var(--border); padding: 0;
  }
  .swatch.active { border-color: var(--text); box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); }
  input[type='range'] { width: 100%; max-width: 320px; }
  .preview { padding: 0.75rem; margin-top: 0.75rem; max-width: 480px; }
  .small { font-size: 0.85rem; }
</style>
