<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  type Row = Record<string, unknown>;

  // Which section is open. Zones first — nothing else can be created without
  // a zone (societies need one) or a slot (rosters need one).
  let tab = $state<'zones' | 'societies' | 'slots' | 'partners'>('zones');

  const today = new Date().toISOString().slice(0, 10);
  const zoneName = (id: unknown) =>
    (data.zones.find((z: Row) => z.id === id)?.Name as string) ?? '—';
</script>

<div class="flex between center">
  <h1>Delivery setup</h1>
  <a class="btn secondary" href="/delivery">← Board</a>
</div>

<p class="muted" style="margin-top:0">Zones, societies, slots and partners — the master data the delivery domain runs on.</p>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.success}<p class="success">Saved.</p>{/if}

<div class="tabs">
  <button class:on={tab === 'zones'} onclick={() => (tab = 'zones')}>Zones <span class="count">{data.zones.length}</span></button>
  <button class:on={tab === 'societies'} onclick={() => (tab = 'societies')}>Societies <span class="count">{data.societies.length}</span></button>
  <button class:on={tab === 'slots'} onclick={() => (tab = 'slots')}>Slots <span class="count">{data.slots.length}</span></button>
  <button class:on={tab === 'partners'} onclick={() => (tab = 'partners')}>Partners <span class="count">{data.partners.length}</span></button>
</div>

<!-- ZONES -->
{#if tab === 'zones'}
  <div class="grid">
    <div class="card">
      <h2>Add a zone</h2>
      <form method="POST" action="?/createZone" use:enhance class="stack">
        <label>Code<input name="Code" placeholder="MNG" required maxlength="32" style="text-transform:uppercase" /></label>
        <label>Name<input name="Name" placeholder="Mukundnagar" required /></label>
        <label>Name (मराठी)<input name="NameMr" placeholder="मुकुंदनगर" /></label>
        <label>Coverage<input name="Coverage" placeholder="411037, Mukundnagar area" /></label>
        <button class="btn" type="submit">Add zone</button>
      </form>
    </div>
    <div class="card">
      <h2>Zones</h2>
      {#if data.zones.length === 0}
        <p class="muted">No zones yet. Add one to start.</p>
      {:else}
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Coverage</th></tr></thead>
          <tbody>
            {#each data.zones as z (z.id)}
              <tr><td><strong>{z.Code}</strong></td><td>{z.Name}</td><td class="muted small">{z.Coverage ?? '—'}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}

<!-- SOCIETIES -->
{#if tab === 'societies'}
  <div class="grid">
    <div class="card">
      <h2>Add a society</h2>
      {#if data.zones.length === 0}
        <p class="muted">Add a zone first — a society belongs to one.</p>
      {:else}
        <form method="POST" action="?/createSociety" use:enhance class="stack">
          <label>Zone
            <select name="ZoneId" required>
              {#each data.zones as z (z.id)}<option value={z.id}>{z.Code} — {z.Name}</option>{/each}
            </select>
          </label>
          <label>Name<input name="Name" placeholder="Green Acres" required /></label>
          <label>Pincode<input name="Pincode" placeholder="411037" maxlength="6" /></label>
          <label>Distance from shop (km)<input name="DistanceKm" type="number" step="0.1" min="0" placeholder="3.5" /></label>
          <p class="muted small">Distance sets the delivery charge bracket.</p>
          <button class="btn" type="submit">Add society</button>
        </form>
      {/if}
    </div>
    <div class="card">
      <h2>Societies</h2>
      {#if data.societies.length === 0}
        <p class="muted">None yet.</p>
      {:else}
        <table>
          <thead><tr><th>Name</th><th>Zone</th><th>Distance</th></tr></thead>
          <tbody>
            {#each data.societies as s (s.id)}
              <tr><td>{s.Name}</td><td class="muted small">{zoneName(s.ZoneId)}</td><td>{s.DistanceKm ? `${s.DistanceKm} km` : '—'}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}

<!-- SLOTS -->
{#if tab === 'slots'}
  <div class="grid">
    <div class="card">
      <h2>Add a slot</h2>
      <form method="POST" action="?/createSlot" use:enhance class="stack">
        <label>Name<input name="Name" placeholder="Morning 9-12" required /></label>
        <label>Name (मराठी)<input name="NameMr" placeholder="सकाळ ९-१२" /></label>
        <label>Type
          <select name="SlotType">
            <option value="Both">Both</option><option value="Pickup">Pickup only</option><option value="Delivery">Delivery only</option>
          </select>
        </label>
        <div class="row">
          <label>Start<input name="StartTime" type="time" required /></label>
          <label>End<input name="EndTime" type="time" required /></label>
        </div>
        <div class="row">
          <label>Max orders<input name="MaxOrders" type="number" min="1" placeholder="50" required /></label>
          <label>Cutoff (min before)<input name="CutoffMinutes" type="number" min="0" placeholder="60" /></label>
        </div>
        <p class="muted small">Cutoff closes booking that many minutes before the slot starts.</p>
        <button class="btn" type="submit">Add slot</button>
      </form>
    </div>
    <div class="card">
      <h2>Slots</h2>
      {#if data.slots.length === 0}
        <p class="muted">None yet.</p>
      {:else}
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Window</th><th>Cap</th></tr></thead>
          <tbody>
            {#each data.slots as s (s.id)}
              <tr>
                <td>{s.Name}</td>
                <td><span class="badge info">{s.SlotType}</span></td>
                <td class="muted small">{String(s.StartTime).slice(0,5)}–{String(s.EndTime).slice(0,5)}</td>
                <td>{s.MaxOrders}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}

<!-- PARTNERS -->
{#if tab === 'partners'}
  <div class="grid">
    <div class="card">
      <h2>Add a partner</h2>
      <form method="POST" action="?/createPartner" use:enhance class="stack">
        <label>Code<input name="PartnerCode" placeholder="DEL-001" required /></label>
        <label>Name<input name="Name" placeholder="Ravi Kumar" required /></label>
        <label>Phone<input name="Phone" placeholder="+919812345678" required /></label>
        <label>Vehicle
          <select name="VehicleType">
            <option value="Bike">Bike</option><option value="Scooter">Scooter</option>
            <option value="Cycle">Cycle</option><option value="Van">Van</option><option value="Walking">Walking</option>
          </select>
        </label>
        <label>Max deliveries/day<input name="MaxDeliveriesPerDay" type="number" min="0" placeholder="20" /></label>
        <button class="btn" type="submit">Add partner</button>
      </form>
    </div>

    <div class="card">
      <h2>Partners</h2>
      {#if data.partners.length === 0}
        <p class="muted">None yet.</p>
      {:else}
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Phone</th></tr></thead>
          <tbody>
            {#each data.partners as p (p.id)}
              <tr><td><strong>{p.PartnerCode}</strong></td><td>{p.Name}</td><td class="muted small">{p.Phone}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <!-- A partner only becomes eligible for auto-assign once they cover a zone
         and are rostered on a slot. Both are one-form-each here. -->
    {#if data.partners.length > 0}
      <div class="card">
        <h2>Zone coverage</h2>
        {#if data.zones.length === 0}
          <p class="muted">Add a zone first.</p>
        {:else}
          <form method="POST" action="?/addCoverage" use:enhance class="stack">
            <label>Partner<select name="PartnerId" required>{#each data.partners as p (p.id)}<option value={p.id}>{p.PartnerCode} — {p.Name}</option>{/each}</select></label>
            <label>Zone<select name="ZoneId" required>{#each data.zones as z (z.id)}<option value={z.id}>{z.Code} — {z.Name}</option>{/each}</select></label>
            <button class="btn" type="submit">Give coverage</button>
          </form>
        {/if}
      </div>

      <div class="card">
        <h2>Roster on a slot</h2>
        {#if data.slots.length === 0}
          <p class="muted">Add a slot first.</p>
        {:else}
          <form method="POST" action="?/addRoster" use:enhance class="stack">
            <label>Partner<select name="PartnerId" required>{#each data.partners as p (p.id)}<option value={p.id}>{p.PartnerCode} — {p.Name}</option>{/each}</select></label>
            <label>Slot<select name="SlotId" required>{#each data.slots as s (s.id)}<option value={s.id}>{s.Name}</option>{/each}</select></label>
            <label>Date<input name="AssignmentDate" type="date" value={today} required /></label>
            <button class="btn" type="submit">Roster</button>
          </form>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--border); margin: 1rem 0; flex-wrap: wrap; }
  .tabs button {
    background: none; border: none; padding: 0.6rem 1rem; cursor: pointer;
    color: var(--muted-foreground, #6b7280); font-size: 0.9rem; border-bottom: 2px solid transparent;
  }
  .tabs button.on { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
  .count { font-size: 0.72rem; background: var(--secondary); padding: 0.05rem 0.4rem; border-radius: 999px; margin-left: 0.25rem; }

  .grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 900px) { .grid { grid-template-columns: 340px 1fr; } }

  .card { padding: 1.1rem; }
  h2 { font-size: 0.95rem; margin: 0 0 0.75rem; }
  .stack { display: flex; flex-direction: column; gap: 0.6rem; }
  .stack label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.82rem; color: var(--muted-foreground, #6b7280); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .small { font-size: 0.78rem; }
</style>
