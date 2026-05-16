<script lang="ts">
  import type { PageData, ActionData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();
  const o = $derived(data.detail.order);
  const inr = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
  const date = (d: unknown) => new Date(String(d)).toLocaleString('en-IN');

  // Map current status → next allowed (mirrors backend STATUS_NEXT).
  const NEXT: Record<string, string[]> = {
    Booked: ['PickedUp', 'Received', 'Cancelled', 'OnHold'],
    PickedUp: ['Received', 'InProcess', 'Cancelled', 'OnHold'],
    Received: ['InProcess', 'Cancelled', 'OnHold'],
    InProcess: ['Ready', 'OnHold'],
    Ready: ['OutForDelivery', 'Delivered', 'OnHold'],
    OutForDelivery: ['Delivered'],
    Delivered: ['Closed'],
    Closed: [],
    Cancelled: [],
    OnHold: ['InProcess', 'Cancelled'],
  };
  const allowed = $derived(NEXT[String(o.Status)] ?? []);
</script>

<div class="flex between center">
  <h1>Order {o.OrderCode}</h1>
  <a class="btn secondary" href="/orders">← Back</a>
</div>

<div class="grid">
  <div class="card section">
    <h2>Items</h2>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
      <tbody>
        {#each data.detail.lines as l (l.id)}
          <tr><td>{l.ItemName} <span class="muted small">{l.ItemCode}</span></td><td>{l.Quantity}</td><td>{inr(l.UnitRateInr)}</td><td>{inr(l.LineTotalInr)}</td></tr>
        {/each}
        <tr><td colspan="3" class="right">Subtotal</td><td>{inr(o.SubtotalInr)}</td></tr>
        <tr><td colspan="3" class="right">Delivery</td><td>{inr(o.DeliveryChargeInr)}</td></tr>
        <tr><td colspan="3" class="right">Express</td><td>{inr(o.ExpressChargeInr)}</td></tr>
        <tr><td colspan="3" class="right">GST</td><td>{inr(o.GstInr)}</td></tr>
        <tr><td colspan="3" class="right"><strong>Total</strong></td><td><strong>{inr(o.TotalInr)}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <aside class="col">
    <div class="card section">
      <h2>Customer</h2>
      <p><strong>{o.CustomerName}</strong></p>
      <p class="muted">{o.CustomerPhone}</p>
      <p>Billed to: <span class="badge info">{o.BilledTo}</span></p>
    </div>

    <div class="card section">
      <h2>Status</h2>
      <p><span class="badge info">{o.Status}</span></p>
      {#if form?.error}<p class="error">{form.error}</p>{/if}
      {#if form?.success}<p class="success">Status updated.</p>{/if}
      {#if allowed.length > 0}
        <form method="post" action="?/status" class="col">
          <select name="status">
            {#each allowed as s}<option value={s}>{s}</option>{/each}
          </select>
          <input name="note" placeholder="Optional note" />
          <button class="btn" type="submit">Update status</button>
        </form>
      {:else}
        <p class="muted small">No further status transitions available.</p>
      {/if}
    </div>

    <div class="card section">
      <h2>Service &amp; channel</h2>
      <p>{o.ServiceTypeCode} · {o.Channel} → {o.DeliveryType}{o.IsExpress ? ' · Express' : ''}</p>
      <p class="muted small">Created {date(o.CreatedAt)}</p>
    </div>
  </aside>
</div>

<div class="card section" style="margin-top:1.5rem">
  <h2>History</h2>
  <ul class="timeline">
    {#each data.detail.history as h (h.id)}
      <li><span class="badge info">{h.ToStatus}</span> <span class="muted small">{date(h.CreatedAt)}</span>{#if h.Note} — {h.Note}{/if}</li>
    {/each}
  </ul>
</div>

<style>
  .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-top: 1rem; }
  h2 { margin: 0 0 0.75rem; font-size: 1.05rem; }
  .right { text-align: right; }
  .small { font-size: 0.85rem; }
  .timeline { list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 0.5rem; }
</style>
