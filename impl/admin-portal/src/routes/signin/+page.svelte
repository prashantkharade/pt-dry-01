<script lang="ts">
  import type { ActionData } from './$types';
  let { form }: { form: ActionData } = $props();
</script>

<div class="wrap">
  <div class="card login">
    <h1>PT Kharade Admin</h1>
    <p class="muted">Sign in to manage orders and customers.</p>

    <form method="post" class="col">
      <div class="field">
        <label for="emailOrPhone">Email or phone</label>
        <input
          id="emailOrPhone"
          name="emailOrPhone"
          type="text"
          required
          autocomplete="username"
          value={form?.values?.emailOrPhone ?? 'admin@ptkharade.in'} />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
          value="" />
      </div>
      {#if form?.error}
        <p class="error">{form.error}</p>
      {/if}
      <button type="submit" class="btn">Sign in</button>
      <p class="muted small">
        Default seeded admin: <code>admin@ptkharade.in</code> / <code>Admin@12345</code>
      </p>
    </form>
  </div>
</div>

<style>
  .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .login { width: 100%; max-width: 420px; padding: 2rem; }
  h1 { margin: 0 0 0.5rem; }
  .small { font-size: 0.85rem; margin-top: 0.5rem; }
  code { background: var(--muted); color: var(--foreground); padding: 0 0.25rem; border-radius: 4px; }
</style>
