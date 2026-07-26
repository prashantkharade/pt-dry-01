<script lang="ts">
  import type { PageData } from './$types';
  import TrendChart from '$lib/components/TrendChart.svelte';
  import LiveOrders from '$lib/components/LiveOrders.svelte';

  let { data }: { data: PageData } = $props();
  type Row = Record<string, unknown>;

  const inr = (n: unknown) =>
    '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const PRESET_LABELS: Record<string, string> = {
    Today: 'Today', Yesterday: 'Yesterday', Week: '7 days',
    Month: '30 days', Quarter: '90 days', Year: 'Year', All: 'All time',
  };

  const s = $derived(data.summary);

  //  The numbers staff actually act on, pulled out of the status breakdown.
  //  "Total orders" is a vanity metric; "3 pickups waiting" is a job.
  const awaitingPickup = $derived(s?.ByStatus?.Booked ?? 0);
  const inProcess      = $derived((s?.ByStatus?.Received ?? 0) + (s?.ByStatus?.InProcess ?? 0));
  const ready          = $derived(s?.ByStatus?.Ready ?? 0);

  //  Status counts as horizontal bars. ONE hue, not eight: this encodes
  //  magnitude (how many), not identity — categorical colour here would
  //  imply the statuses are unrelated series.
  const statusRows = $derived(
    Object.entries(s?.ByStatus ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([Status, Count]) => ({ Status, Count })),
  );
  const statusMax = $derived(Math.max(1, ...statusRows.map((r) => r.Count)));

  const badge = (status: string) =>
    status === 'Delivered' || status === 'Closed' ? 'success'
    : status === 'Cancelled' ? 'danger'
    : status === 'Ready' ? 'warn' : 'info';

  const date = (d: unknown) =>
    new Date(String(d)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<div class="flex between center head">
  <h1>Dashboard</h1>
  <a class="btn" href="/orders/new">+ New Order</a>
</div>

<!-- One filter row above the charts; every number on the page follows it. -->
<div class="presets" role="group" aria-label="Time period">
  {#each data.presets as p}
    <a class="preset" class:on={data.preset === p} href="?preset={p}">{PRESET_LABELS[p] ?? p}</a>
  {/each}
</div>

{#if !s}
  <p class="error">Could not load the summary. The orders service may be down.</p>
{:else}
  <div class="grid">
    <div>
      <div class="kpis">
        <!-- Hero number: the one figure the owner opens this page for. -->
        <div class="card kpi hero">
          <span class="label">Revenue</span>
          <span class="n">{inr(s.RevenueInr)}</span>
          <span class="sub muted">{s.Total} order{s.Total === 1 ? '' : 's'}</span>
        </div>
        <div class="card kpi" class:alert={awaitingPickup > 0}>
          <span class="label">Awaiting pickup</span>
          <span class="n">{awaitingPickup}</span>
        </div>
        <div class="card kpi">
          <span class="label">In process</span>
          <span class="n">{inProcess}</span>
        </div>
        <div class="card kpi" class:ready={ready > 0}>
          <span class="label">Ready</span>
          <span class="n">{ready}</span>
          <span class="sub muted">to hand over</span>
        </div>
      </div>

      <div class="card section">
        <h2>Orders per day</h2>
        <TrendChart points={s.Trend} />
      </div>

      {#if statusRows.length > 0}
        <div class="card section">
          <h2>Where orders are</h2>
          <div class="bars">
            {#each statusRows as r (r.Status)}
              <div class="bar-row">
                <span class="bar-label">{r.Status}</span>
                <div class="track">
                  <div class="bar" style="width: {(r.Count / statusMax) * 100}%"></div>
                </div>
                <!-- Direct label: no legend needed, no hover required to read it. -->
                <span class="bar-n">{r.Count}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="card section">
        <div class="flex between center">
          <h2>Recent orders</h2>
          <a href="/orders?preset={data.preset}">View all →</a>
        </div>
        <table>
          <thead>
            <tr><th>Code</th><th>Customer</th><th>Service</th><th>Total</th><th>Status</th><th>Placed</th><th></th></tr>
          </thead>
          <tbody>
            {#each (data.recent?.Items ?? []) as o (o.id)}
              <tr>
                <td><strong>{o.OrderCode}</strong></td>
                <td>{o.CustomerName}<br/><span class="muted small">{o.CustomerPhone}</span></td>
                <td>{o.ServiceTypeCode}{o.IsExpress ? ' ⚡' : ''}</td>
                <td>{inr(o.TotalInr)}</td>
                <td><span class="badge {badge(String(o.Status))}">{o.Status}</span></td>
                <td class="muted small">{date(o.CreatedAt)}</td>
                <td><a href="/orders/{o.id}">Open →</a></td>
              </tr>
            {/each}
            {#if ((data.recent?.Items ?? []) as Row[]).length === 0}
              <tr><td colspan="7" class="muted" style="text-align:center; padding:2rem">No orders in this period.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right rail: sticky, so it stays visible as the table scrolls. -->
    <div>
      <LiveOrders />
    </div>
  </div>
{/if}

<style>
  .head { margin-bottom: 0.75rem; }

  .presets { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .preset {
    padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.85rem;
    border: 1px solid var(--border); color: var(--muted-foreground, #6b7280);
    text-decoration: none;
  }
  .preset:hover { background: var(--secondary); text-decoration: none; }
  .preset.on { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }

  /* Charts get the width; the live feed rides alongside and collapses under
     on narrow screens rather than squeezing the chart. */
  .grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 1100px) { .grid { grid-template-columns: 1fr 280px; } }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
  .kpi { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.15rem; }
  .kpi .label { font-size: 0.78rem; color: var(--muted-foreground, #6b7280); text-transform: uppercase; letter-spacing: 0.04em; }
  .kpi .n { font-size: 1.75rem; font-weight: 650; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .kpi .sub { font-size: 0.78rem; }
  .kpi.hero { grid-column: span 2; }
  .kpi.hero .n { font-size: 2.25rem; }
  /* Status colours always ship beside a label — never colour alone. */
  .kpi.alert .n { color: #d03b3b; }
  .kpi.ready .n { color: #0ca30c; }

  .section { padding: 1.1rem; margin-bottom: 1rem; }
  h2 { font-size: 0.95rem; margin: 0 0 0.75rem; }

  .bars { display: flex; flex-direction: column; gap: 0.5rem; }
  .bar-row { display: grid; grid-template-columns: 110px 1fr 40px; gap: 0.6rem; align-items: center; }
  .bar-label { font-size: 0.82rem; color: var(--muted-foreground, #6b7280); }
  .track { background: var(--secondary, #f3f4f6); border-radius: 4px; height: 18px; overflow: hidden; }
  /* One hue: magnitude, not identity. 4px rounded data-end at the baseline. */
  .bar { height: 100%; background: #2a78d6; border-radius: 0 4px 4px 0; min-width: 2px; }
  :global(:root[data-theme='ptk-dark']) .bar { background: #3987e5; }
  .bar-n { font-size: 0.82rem; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }

  .small { font-size: 0.78rem; }
</style>
