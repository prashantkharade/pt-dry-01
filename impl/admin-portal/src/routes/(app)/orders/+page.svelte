<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const inr = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
  const date = (d: unknown) => new Date(String(d)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<div class="flex between center">
  <h1>Orders</h1>
  <a class="btn" href="/orders/new">+ New Order</a>
</div>

<form method="get" class="flex gap" style="margin-bottom:1rem">
  <input name="q" placeholder="Search by code, name or phone…" value={data.q ?? ''} />
  <select name="status">
    <option value="">All statuses</option>
    {#each ['Booked','PickedUp','Received','InProcess','Ready','OutForDelivery','Delivered','Closed','Cancelled','OnHold'] as s}
      <option value={s} selected={data.status === s}>{s}</option>
    {/each}
  </select>
  <button class="btn secondary" type="submit">Search</button>
</form>

{#if data.error}<p class="error">{data.error}</p>{/if}

<div class="card">
  <table>
    <thead>
      <tr><th>Code</th><th>Customer</th><th>Service</th><th>Channel</th><th>Total</th><th>Status</th><th>Created</th><th></th></tr>
    </thead>
    <tbody>
      {#each data.result.items as o (o.id)}
        <tr>
          <td><strong>{o.OrderCode}</strong></td>
          <td>{o.CustomerName}<br/><span class="muted small">{o.CustomerPhone}</span></td>
          <td>{o.ServiceTypeCode}</td>
          <td>{o.Channel} / {o.DeliveryType}</td>
          <td>{inr(o.TotalInr)}</td>
          <td><span class="badge info">{o.Status}</span></td>
          <td>{date(o.CreatedAt)}</td>
          <td><a href="/orders/{o.id}">Open →</a></td>
        </tr>
      {/each}
      {#if data.result.items.length === 0}
        <tr><td colspan="8" class="muted" style="text-align:center; padding: 2rem">No orders found.</td></tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  .small { font-size: 0.85rem; }
</style>
