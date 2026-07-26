<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type Row = Record<string, unknown>;

  //  Which run is showing its "why did it fail?" box. Only one at a time.
  let failingId = $state<string | null>(null);

  const time = (d: unknown) =>
    new Date(String(d)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  //  Mirrors ASSIGNMENT_STATUS_TRANSITIONS on the server. The server is the
  //  authority — this only decides which button to offer, so a stale UI gets a
  //  422 rather than a wrong write.
  const nextStep = (status: string): { label: string; to: string } | null => {
    switch (status) {
      case 'Assigned': return { label: 'Start run',   to: 'Started' };
      case 'Started' : return { label: "I've arrived", to: 'Arrived' };
      case 'Arrived' : return { label: 'Complete',     to: 'Completed' };
      //Failed is retryable — the server allows Failed -> Assigned.
      case 'Failed'  : return { label: 'Retry',        to: 'Assigned' };
      default: return null;
    }
  };

  const badgeClass = (s: string) =>
    s === 'Completed' ? 'success' : s === 'Failed' ? 'danger' : s === 'Arrived' ? 'warn' : 'info';

  const done = $derived(data.runs.filter((r: Row) => r.Status === 'Completed').length);
</script>

<div class="flex between center">
  <h1>My Runs</h1>
  <form method="get">
    <input type="date" name="date" value={data.date} onchange={(e) => e.currentTarget.form?.submit()} />
  </form>
</div>

{#if data.loadError}
  <p class="error">{data.loadError}</p>
{/if}
{#if form?.error}
  <p class="error">{form.error}</p>
{/if}

{#if data.runs.length > 0}
  <p class="muted small">{done} of {data.runs.length} done</p>
{/if}

<div class="runs">
  {#each data.runs as run (run.id)}
    <div class="card run">
      <div class="flex between center">
        <div>
          <!-- The leg is the first thing a partner needs: am I collecting or returning? -->
          <span class="badge {run.Direction === 'Pickup' ? 'info' : 'warn'}">{run.Direction}</span>
          <span class="badge {badgeClass(String(run.Status))}">{run.Status}</span>
        </div>
        <span class="muted small">{time(run.ScheduledAt)}</span>
      </div>

      <p class="order">Order <strong>{String(run.OrderId).slice(0, 8)}</strong></p>
      {#if run.ItemCountCollected}
        <p class="muted small">{run.ItemCountCollected} item(s) collected</p>
      {/if}
      {#if run.FailedReason}
        <p class="error small">Last attempt: {run.FailedReason}</p>
      {/if}

      {#if nextStep(String(run.Status))}
        <div class="actions">
          <form method="POST" action="?/transition" use:enhance>
            <input type="hidden" name="id" value={run.id} />
            <input type="hidden" name="status" value={nextStep(String(run.Status))!.to} />
            <!-- Ask for the real count at handover: what the customer booked
                 and what is actually in the bag rarely match. -->
            {#if nextStep(String(run.Status))!.to === 'Completed'}
              <input class="count" type="number" name="itemCount" min="0" max="999" placeholder="Items" />
            {/if}
            <button class="btn" type="submit">{nextStep(String(run.Status))!.label}</button>
          </form>

          {#if run.Status !== 'Completed' && run.Status !== 'Failed'}
            <button class="btn secondary" type="button" onclick={() => (failingId = failingId === run.id ? null : String(run.id))}>
              Couldn't complete
            </button>
          {/if}
        </div>

        {#if failingId === run.id}
          <form method="POST" action="?/transition" use:enhance={() => async ({ update }) => { failingId = null; await update(); }} class="fail">
            <input type="hidden" name="id" value={run.id} />
            <input type="hidden" name="status" value="Failed" />
            <!-- Required by the API. A failed run with no reason is useless to
                 whoever picks it up next. -->
            <input name="failedReason" placeholder="What happened? (e.g. nobody home)" required />
            <button class="btn danger" type="submit">Mark failed</button>
          </form>
        {/if}
      {/if}
    </div>
  {/each}

  {#if data.runs.length === 0 && !data.loadError}
    <div class="card">
      <p class="muted" style="text-align:center; padding:2rem">No runs scheduled for this day.</p>
    </div>
  {/if}
</div>

<style>
  /* Partners work this on a phone, one-handed, often outdoors — big targets,
     one column, no horizontal scrolling. */
  .runs { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
  .run { padding: 1rem; }
  .order { margin: 0.5rem 0; }
  .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .actions form { display: flex; gap: 0.5rem; align-items: center; }
  .actions .btn { min-height: 44px; padding-inline: 1.25rem; }
  .count { width: 5.5rem; min-height: 44px; }
  .fail { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .fail input { flex: 1; min-height: 44px; }
  .small { font-size: 0.85rem; }
</style>
