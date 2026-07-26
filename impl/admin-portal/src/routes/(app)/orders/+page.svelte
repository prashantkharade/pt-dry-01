<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  const inr = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const date = (d: unknown) => new Date(String(d)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const PRESET_LABELS: Record<string, string> = {
    Today: 'Today', Yesterday: 'Yesterday', Week: '7 days',
    Month: '30 days', Quarter: '90 days', Year: 'Year', All: 'All time',
  };

  const badge = (status: string) =>
    status === 'Delivered' || status === 'Closed' ? 'success'
    : status === 'Cancelled' ? 'danger'
    : status === 'Ready' ? 'warn' : 'info';

  // Pagination maths from the API's own page metadata.
  const page = $derived(data.result.PageIndex ?? 0);
  const perPage = $derived(data.result.ItemsPerPage ?? 25);
  const total = $derived(data.result.Total ?? 0);
  const lastPage = $derived(Math.max(0, Math.ceil(total / perPage) - 1));
  const from = $derived(total === 0 ? 0 : page * perPage + 1);
  const to = $derived(Math.min(total, (page + 1) * perPage));

  // Build a URL preserving the current filters but changing one param.
  const withParam = (key: string, value: string) => {
    const p = new URLSearchParams();
    if (data.q) p.set('q', String(data.q));
    if (data.status) p.set('status', String(data.status));
    if (data.preset && data.preset !== 'All') p.set('preset', String(data.preset));
    p.set(key, value);
    return `?${p.toString()}`;
  };
</script>

<div class="flex between center">
  <h1>Orders</h1>
  <a class="btn" href="/orders/new">+ New Order</a>
</div>

<!-- Date presets: the filter staff reach for first. Changing it resets to
     page 0 (the preset link doesn't carry ?page). -->
<div class="presets" role="group" aria-label="Time period">
  {#each data.presets as p}
    <a class="preset" class:on={data.preset === p} href={withParam('preset', p).replace(/&?page=\d+/, '')}>
      {PRESET_LABELS[p] ?? p}
    </a>
  {/each}
</div>

<form method="get" class="flex gap" style="margin-bottom:1rem">
  <input name="q" placeholder="Search by code, name or phone…" value={data.q ?? ''} />
  <select name="status">
    <option value="">All statuses</option>
    {#each ['Booked','PickedUp','Received','InProcess','Ready','OutForDelivery','Delivered','Closed','Cancelled','OnHold'] as s}
      <option value={s} selected={data.status === s}>{s}</option>
    {/each}
  </select>
  <!-- Keep the active preset when searching. -->
  {#if data.preset && data.preset !== 'All'}<input type="hidden" name="preset" value={data.preset} />{/if}
  <button class="btn secondary" type="submit">Search</button>
</form>

{#if data.error}<p class="error">{data.error}</p>{/if}

<div class="card">
  <table>
    <thead>
      <tr><th>Code</th><th>Customer</th><th>Service</th><th>Channel</th><th>Total</th><th>Status</th><th>Created</th><th></th></tr>
    </thead>
    <tbody>
      {#each data.result.Items as o (o.id)}
        <tr>
          <td><strong>{o.OrderCode}</strong></td>
          <td>{o.CustomerName}<br/><span class="muted small">{o.CustomerPhone}</span></td>
          <td>{o.ServiceTypeCode}{o.IsExpress ? ' ⚡' : ''}</td>
          <td>{o.Channel} / {o.DeliveryType}</td>
          <td>{inr(o.TotalInr)}</td>
          <td><span class="badge {badge(String(o.Status))}">{o.Status}</span></td>
          <td class="muted small">{date(o.CreatedAt)}</td>
          <td><a href="/orders/{o.id}">Open →</a></td>
        </tr>
      {/each}
      {#if data.result.Items.length === 0}
        <tr><td colspan="8" class="muted" style="text-align:center; padding: 2rem">No orders found.</td></tr>
      {/if}
    </tbody>
  </table>
</div>

<!-- Pagination — was plumbed through the API but never rendered until now. -->
{#if total > 0}
  <div class="pager">
    <span class="muted small">Showing {from}–{to} of {total}</span>
    <div class="flex gap">
      <a class="btn secondary" class:disabled={page <= 0} href={withParam('page', String(page - 1))}>← Prev</a>
      <span class="muted small" style="align-self:center">Page {page + 1} of {lastPage + 1}</span>
      <a class="btn secondary" class:disabled={page >= lastPage} href={withParam('page', String(page + 1))}>Next →</a>
    </div>
  </div>
{/if}

<style>
  .presets { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .preset {
    padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.85rem;
    border: 1px solid var(--border); color: var(--muted-foreground, #6b7280);
    text-decoration: none;
  }
  .preset:hover { background: var(--secondary); text-decoration: none; }
  .preset.on { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }

  .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; }
  /* A disabled pager link must not navigate — pointer-events off, dimmed. */
  .btn.disabled { opacity: 0.4; pointer-events: none; }

  .small { font-size: 0.85rem; }
</style>
