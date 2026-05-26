<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Local intent — quantities by item id.
  let quantities = $state<Record<string, number>>({});
  let serviceTypeCode = $state(data.selectedService);
  let channel = $state<'HomePickup' | 'DropAtShop'>('DropAtShop');
  let deliveryType = $state<'HomeDelivery' | 'CustomerPickup'>('CustomerPickup');
  let isExpress = $state(false);
  let customerId = $state(data.customerId ?? '');
  let notes = $state('');

  const inr = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });

  const totalLineCount = $derived(Object.values(quantities).filter((q) => q > 0).length);

  function changeService(s: string) {
    goto(`/orders/new?service=${s}${customerId ? '&customerId=' + customerId : ''}`, { replaceState: true, keepFocus: true });
  }
</script>

<div class="flex between center">
  <h1>New Order</h1>
  <a class="btn secondary" href="/orders">← Back to list</a>
</div>

<form method="post" class="grid">
  <input type="hidden" name="serviceTypeCode" bind:value={serviceTypeCode} />
  <input type="hidden" name="customerId" bind:value={customerId} />

  <!-- LEFT: items -->
  <section class="card section">
    <h2>1 · Service &amp; items</h2>

    <div class="service-tabs">
      {#each data.services.Items as s (s.Code)}
        <button
          type="button"
          class="tab"
          class:active={serviceTypeCode === s.Code}
          onclick={() => { serviceTypeCode = s.Code; changeService(s.Code); }}>
          {s.Name}
        </button>
      {/each}
    </div>

    <table class="items">
      <thead>
        <tr><th>Item</th><th>UoM</th><th style="width:140px">Qty</th></tr>
      </thead>
      <tbody>
        {#each data.catalog.Items as it (it.id)}
          <tr>
            <td><strong>{it.Name}</strong> <span class="muted small">· {it.Code}</span>{#if it.IsVendorOnly} <span class="badge warn">vendor</span>{/if}</td>
            <td>{it.DefaultUom}</td>
            <td>
              <input type="number" min="0" step="1" name={"qty:" + it.id}
                value={quantities[it.id] ?? 0}
                oninput={(e) => { quantities[it.id] = Number((e.target as HTMLInputElement).value || 0); }} />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <!-- RIGHT: settings & quote -->
  <aside class="col">
    <div class="card section">
      <h2>2 · Customer</h2>
      <div class="field">
        <label for="customerId">Customer ID</label>
        <input id="customerId" name="customerId" bind:value={customerId} placeholder="UUID — paste from /customers" />
      </div>
      {#if data.customer}
        <div class="customer-card">
          <strong>{data.customer.Name}</strong>
          <div class="muted small">{data.customer.Phone} · {data.customer.CustomerCode}</div>
          <span class="badge {data.customer.CustomerType === 'Vendor' ? 'warn' : 'info'}">{data.customer.CustomerType}</span>
        </div>
      {:else}
        <a href="/customers" class="muted small">Search customers →</a>
      {/if}
    </div>

    <div class="card section">
      <h2>3 · Collection &amp; delivery</h2>
      <div class="field">
        <label>Collection</label>
        <div class="seg">
          {#each [['DropAtShop','Drop at shop'],['HomePickup','Home pickup']] as opt}
            <label class="opt" class:active={channel === opt[0]}>
              <input type="radio" name="channel" value={opt[0]} bind:group={channel} /> {opt[1]}
            </label>
          {/each}
        </div>
      </div>
      <div class="field">
        <label>Delivery</label>
        <div class="seg">
          {#each [['CustomerPickup','Customer pickup'],['HomeDelivery','Home delivery (+₹40)']] as opt}
            <label class="opt" class:active={deliveryType === opt[0]}>
              <input type="radio" name="deliveryType" value={opt[0]} bind:group={deliveryType} /> {opt[1]}
            </label>
          {/each}
        </div>
      </div>
      <label class="flex gap center" style="margin-top:0.5rem">
        <input type="checkbox" name="isExpress" bind:checked={isExpress} />
        Express / same-day (+25%)
      </label>
    </div>

    <div class="card section">
      <h2>4 · Quote &amp; confirm</h2>
      {#if form?.error}<p class="error">{form.error}</p>{/if}
      {#if form?.quote}
        <div class="quote">
          <table>
            <tbody>
              {#each form.quote.Lines as l (l.ItemId)}
                <tr><td>{l.ItemName} × {l.Quantity}</td><td class="right">{inr(l.LineTotalInr)}</td></tr>
              {/each}
              <tr><td>Subtotal</td><td class="right">{inr(form.quote.SubtotalInr)}</td></tr>
              <tr><td>Delivery</td><td class="right">{inr(form.quote.DeliveryChargeInr)}</td></tr>
              <tr><td>Express</td><td class="right">{inr(form.quote.ExpressChargeInr)}</td></tr>
              <tr><td>GST</td><td class="right">{inr(form.quote.GstInr)}</td></tr>
              <tr class="total"><td><strong>Total</strong></td><td class="right"><strong>{inr(form.quote.TotalInr)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      {:else}
        <p class="muted small">Select items, then click <em>Get quote</em> to preview pricing.</p>
      {/if}

      <div class="field">
        <label for="notes">Notes</label>
        <textarea id="notes" name="notes" bind:value={notes} rows="2" placeholder="Stain on collar, etc." />
      </div>

      <div class="flex gap" style="margin-top: 0.5rem">
        <button class="btn secondary" type="submit" formaction="?/quote" disabled={totalLineCount === 0}>Get quote</button>
        <button class="btn" type="submit" formaction="?/create" disabled={totalLineCount === 0 || !customerId}>Confirm order</button>
      </div>
    </div>
  </aside>
</form>

<style>
  .grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.25rem; margin-top: 1rem; }
  h2 { margin: 0 0 0.75rem; font-size: 1.05rem; }
  .service-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .tab {
    background: var(--surface); border: 1px solid var(--border); padding: 0.4rem 0.85rem;
    border-radius: 999px; cursor: pointer; color: var(--text);
  }
  .tab.active { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
  .items td, .items th { vertical-align: middle; }
  .seg { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .opt {
    display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.75rem;
    border: 1px solid var(--border); border-radius: 999px; cursor: pointer;
  }
  .opt.active { border-color: var(--accent); background: rgba(37,99,235,0.05); }
  .quote table { margin-bottom: 0.5rem; }
  .quote .right { text-align: right; }
  .quote .total td { border-top: 2px solid var(--text); }
  .customer-card { padding: 0.5rem; background: rgba(37,99,235,0.05); border-radius: var(--radius); }
  .small { font-size: 0.85rem; }
</style>
