<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { loadSettings } from '$lib/settings.svelte';
  import { t } from '$lib/i18n';
  let { children, data } = $props();
  const user = $derived(data.sessionUser);

  onMount(() => {
    loadSettings();
    // Register for background push if Firebase is configured. No-op otherwise,
    // and it never prompts unless the operator has set it up. Dynamic import
    // so the firebase SDK isn't in the initial bundle for a feature most
    // deployments won't enable.
    import('$lib/push').then((m) => m.registerWebPush()).catch(() => {});
  });

  const has = (role: string) => user?.roles?.includes(role) ?? false;
  const isOps = $derived(has('SystemAdmin') || has('Receptionist'));

  //  The portal is shared by three very different jobs. Show each role only
  //  what it can actually use — a delivery partner has no business seeing an
  //  order-intake form, and every ops page would 403 for them anyway.
  //  This is presentation only: the server enforces the real boundaries.
  const nav = $derived([
    ...(isOps ? [
      { href: '/dashboard', key: 'nav.dashboard' },
      { href: '/orders', key: 'nav.orders' },
      { href: '/orders/new', key: 'nav.newOrder' },
      { href: '/customers', key: 'nav.customers' },
      { href: '/delivery', key: 'nav.delivery' },
    ] : []),
    ...(has('DeliveryPartner') ? [{ href: '/my-runs', key: 'nav.myRuns' }] : []),
    { href: '/settings', key: 'nav.settings' },
  ]);
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
