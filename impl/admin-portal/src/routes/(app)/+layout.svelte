<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { loadSettings } from '$lib/settings.svelte';
  import { t } from '$lib/i18n';
  let { children, data } = $props();
  const user = $derived(data.sessionUser);

  onMount(() => loadSettings());

  const nav = [
    { href: '/dashboard', key: 'nav.dashboard' },
    { href: '/orders', key: 'nav.orders' },
    { href: '/orders/new', key: 'nav.newOrder' },
    { href: '/customers', key: 'nav.customers' },
    { href: '/settings', key: 'nav.settings' },
  ];
</script>

<div class="shell">
  <aside class="side">
    <div class="brand">
      <strong>PT Kharade</strong><br/>
      <span class="muted">{t('brand.subtitle')}</span>
    </div>
    <nav>
      {#each nav as item (item.href)}
        <a
          class="nav-link"
          class:active={$page.url.pathname === item.href || $page.url.pathname.startsWith(item.href + '/')}
          href={item.href}>{t(item.key)}</a>
      {/each}
    </nav>
    <div class="user">
      <div><strong>{user?.firstName} {user?.lastName ?? ''}</strong></div>
      <div class="muted small">{user?.roles?.join(' · ')}</div>
      <form method="post" action="/signout">
        <button class="btn secondary small" type="submit">{t('action.signOut')}</button>
      </form>
    </div>
  </aside>
  <main class="main">{@render children?.()}</main>
</div>

<style>
  .shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
  .side {
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 1.5rem 1rem;
    display: flex; flex-direction: column;
  }
  .brand { margin-bottom: 1.5rem; }
  nav { display: flex; flex-direction: column; gap: 0.25rem; }
  .nav-link {
    padding: 0.6rem 0.85rem; border-radius: var(--radius); color: var(--text);
  }
  .nav-link:hover { background: hsl(var(--primary-hsl) / 0.08); text-decoration: none; }
  .nav-link.active { background: var(--primary); color: var(--primary-foreground); }
  .user { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border); }
  .user form { margin-top: 0.5rem; }
  .small { font-size: 0.85rem; }
  .main { padding: 2rem; max-width: 1200px; }
</style>
