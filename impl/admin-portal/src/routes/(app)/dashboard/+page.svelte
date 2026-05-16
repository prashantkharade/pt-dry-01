<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const recent = $derived(data.recentOrders);
  const inr = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
</script>

<h1>Dashboard</h1>
{#if data.error}<p class="error">{data.error}</p>{/if}

<div class="kpis">
  <div class="card kpi"><span class="muted small">Total orders</span><strong>{recent.total}</strong></div>
  <div class="card kpi"><span class="muted small">Showing</span><strong>{recent.items.length} recent</strong></div>
  <div class="card kpi"><a class="btn" href="/orders/new">+ New Order</a></div>
</div>

<div class="card section" style="margin-top:1.5rem">
  <h2>Recent orders</h2>
  {#if recent.items.length === 0}
    <p class="muted">No orders yet.</p>
  {:else}
    <table>
      <thead>
        <tr><th>Code</th><th>Customer</th><th>Service</th><th>Total</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        {#each recent.items as o (o.id)}
          <tr>
            <td><strong>{o.OrderCode}</strong></td>
            <td>{o.CustomerName}<br/><span class="muted small">{o.CustomerPhone}</span></td>
            <td>{o.ServiceTypeCode}</td>
            <td>{inr(o.TotalInr)}</td>
            <td><span class="badge info">{o.Status}</span></td>
            <td><a href="/orders/{o.id}">Open →</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  h1 { margin-top: 0; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem; }
  .kpi { padding: 1rem; display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start; }
  .small { font-size: 0.85rem; }
</style>
