<script lang="ts">
  import type { PageData, ActionData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="flex between center">
  <h1>Customers</h1>
</div>

<div class="grid">
  <div class="card section">
    <form method="get" class="flex gap" style="margin-bottom:1rem">
      <input name="q" placeholder="Search by name, phone or code…" value={data.q ?? ''} />
      <button class="btn secondary" type="submit">Search</button>
    </form>

    <table>
      <thead><tr><th>Name</th><th>Phone</th><th>Type</th><th>Code</th><th></th></tr></thead>
      <tbody>
        {#each data.result.Items as c (c.id)}
          <tr>
            <td><strong>{c.Name}</strong></td>
            <td>{c.Phone ?? ''}</td>
            <td><span class="badge {c.CustomerType === 'Vendor' ? 'warn' : 'info'}">{c.CustomerType}</span></td>
            <td>{c.CustomerCode}</td>
            <td><a href={"/orders/new?customerId=" + c.id}>+ New order</a></td>
          </tr>
        {/each}
        {#if data.result.Items.length === 0}
          <tr><td colspan="5" class="muted" style="text-align:center; padding:2rem">No customers found.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>

  <aside class="card section">
    <h2>Add customer</h2>
    {#if form?.error}<p class="error">{form.error}</p>{/if}
    {#if form?.created}<p class="success">Created {form.created.Name} · {form.created.CustomerCode}</p>{/if}

    <form method="post" action="?/create" class="col">
      <div class="field"><label for="Name">Name *</label><input id="Name" name="Name" required /></div>
      <div class="field"><label for="Phone">Phone *</label><input id="Phone" name="Phone" placeholder="+91XXXXXXXXXX" required /></div>
      <div class="field"><label for="Email">Email</label><input id="Email" name="Email" type="email" /></div>
      <div class="field">
        <label for="CustomerType">Type</label>
        <select id="CustomerType" name="CustomerType">
          <option value="Retail">Retail</option>
          <option value="Vendor">Vendor (B2B)</option>
        </select>
      </div>
      <div class="field"><label for="BusinessName">Business name (vendor)</label><input id="BusinessName" name="BusinessName" /></div>
      <div class="field"><label for="Gstin">GSTIN (vendor)</label><input id="Gstin" name="Gstin" /></div>
      <button class="btn" type="submit">Create</button>
    </form>
  </aside>
</div>

<style>
  .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-top: 1rem; }
  h2 { margin: 0 0 0.75rem; font-size: 1.05rem; }
</style>
