<script lang="ts">
  import { page } from '$app/stores';
  let { children, data } = $props();
  const user = $derived(data.sessionUser);

  const nav = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/orders', label: 'Orders' },
    { href: '/orders/new', label: 'New Order' },
    { href: '/customers', label: 'Customers' },
  ];
</script>

<div class="shell">
  <aside class="side">
    <div class="brand">
      <strong>PT Kharade</strong><br/>
      <span class="muted">Drycleaners &amp; Laundry</span>
    </div>
    <nav>
      {#each nav as item (item.href)}
        <a
          class="nav-link"
          class:active={$page.url.pathname === item.href || $page.url.pathname.startsWith(item.href + '/')}
          href={item.href}>{item.label}</a>
      {/each}
    </nav>
    <div class="user">
      <div><strong>{user?.firstName} {user?.lastName ?? ''}</strong></div>
      <div class="muted small">{user?.roles?.join(' · ')}</div>
      <form method="post" action="/signout">
        <button class="btn secondary small" type="submit">Sign out</button>
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
  .nav-link:hover { background: rgba(37, 99, 235, 0.08); text-decoration: none; }
  .nav-link.active { background: var(--accent); color: var(--accent-fg); }
  .user { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border); }
  .user form { margin-top: 0.5rem; }
  .small { font-size: 0.85rem; }
  .main { padding: 2rem; max-width: 1200px; }
</style>
