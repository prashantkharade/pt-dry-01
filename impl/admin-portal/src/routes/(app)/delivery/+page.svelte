<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  //  The backend client returns Record<string, unknown>; name the fields this
  //  page actually reads so the compiler checks them.
  type Row = Record<string, unknown>;

  const time = (d: unknown) =>
    new Date(String(d)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const partnerName = (id: unknown) =>
    (data.partners.find((p: Row) => p.id === id)?.Name as string) ?? String(id ?? '').slice(0, 8);

  const badgeClass = (s: string) =>
    s === 'Completed' ? 'success' : s === 'Failed' ? 'danger' : s === 'Arrived' ? 'warn' : 'info';

  //  Split by leg. A pickup and a return on the same day are different work —
  //  different vans, different order — and reading them in one list is noise.
  const pickups   = $derived(data.runs.filter((r: Row) => r.Direction === 'Pickup'));
  const deliveries = $derived(data.runs.filter((r: Row) => r.Direction === 'Delivery'));
  const done = $derived(data.runs.filter((r: Row) => r.Status === 'Completed').length);
</script>

<div class="flex between center">
  <h1>Delivery board</h1>
  <div class="flex gap center">
    <a class="btn secondary" href="/delivery/setup">Setup</a>
    <form method="get">
      <input type="date" name="date" value={data.date} onchange={(e) => e.currentTarget.form?.submit()} />
    </form>
  </div>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="stats">
  <div class="card stat"><span class="n">{pickups.length}</span><span class="muted">Pickups</span></div>
  <div class="card stat"><span class="n">{deliveries.length}</span><span class="muted">Deliveries</span></div>
  <div class="card stat"><span class="n">{done}</span><span class="muted">Completed</span></div>
  <!-- The number that matters: legs booked with nobody to do them. -->
  <div class="card stat" class:alert={data.unassigned.length > 0}>
    <span class="n">{data.unassigned.length}</span><span class="muted">Need a partner</span>
  </div>
</div>

{#if data.unassigned.length > 0}
  <div class="card">
    <h2>Needs a partner</h2>
    <p class="muted small">Booked legs with no run assigned. Auto-assign picks the least-loaded partner covering that zone.</p>
    <table>
      <thead><tr><th>Leg</th><th>Order</th><th>Date</th><th></th></tr></thead>
      <tbody>
        {#each data.unassigned as b (b.id)}
          <tr>
            <td><span class="badge {b.Direction === 'Pickup' ? 'info' : 'warn'}">{b.Direction}</span></td>
            <td>{String(b.OrderId ?? '').slice(0, 8)}</td>
            <td>{b.BookingDate}</td>
            <td>
              <form method="POST" action="?/assign" use:enhance class="flex gap">
                <input type="hidden" name="orderId" value={b.OrderId} />
                <input type="hidden" name="direction" value={b.Direction} />
                <input type="hidden" name="bookingId" value={b.id} />
                <select name="partnerId" required>
                  <option value="">Choose partner…</option>
                  {#each data.partners.filter((p: Row) => p.IsActive && p.IsAvailable) as p (p.id)}
                    <option value={p.id}>{p.PartnerCode} — {p.Name}</option>
                  {/each}
                </select>
                <button class="btn" type="submit">Assign</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#each [{ title: 'Pickups', runs: pickups }, { title: 'Deliveries', runs: deliveries }] as group (group.title)}
  <div class="card">
    <h2>{group.title}</h2>
    <table>
      <thead><tr><th>Time</th><th>Order</th><th>Partner</th><th>Status</th><th>Items</th></tr></thead>
      <tbody>
        {#each group.runs as r (r.id)}
          <tr>
            <td>{time(r.ScheduledAt)}</td>
            <td>{String(r.OrderId ?? '').slice(0, 8)}</td>
            <td>{partnerName(r.PartnerId)}</td>
            <td>
              <span class="badge {badgeClass(String(r.Status))}">{r.Status}</span>
              {#if r.FailedReason}<br/><span class="muted small">{r.FailedReason}</span>{/if}
            </td>
            <td>{r.ItemCountCollected ?? '—'}</td>
          </tr>
        {/each}
        {#if group.runs.length === 0}
          <tr><td colspan="5" class="muted" style="text-align:center; padding:1.5rem">Nothing scheduled.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
{/each}

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
  .stat { display: flex; flex-direction: column; align-items: center; padding: 1rem; }
  .stat .n { font-size: 1.75rem; font-weight: 600; }
  /* Draw the eye to unassigned work — it's the only number here that needs
     someone to act today. */
  .stat.alert { border-color: var(--danger, #dc2626); }
  .stat.alert .n { color: var(--danger, #dc2626); }
  .small { font-size: 0.85rem; }
  h2 { font-size: 1rem; margin: 0 0 0.5rem; }
</style>
