<script lang="ts">
  import type { PageData } from './$types';
  import { t } from '$lib/i18n';
  let { data }: { data: PageData } = $props();
  const recent = $derived(data.recentOrders);
  const inr = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
</script>

<h1>{t('dashboard.title')}</h1>
{#if data.error}<p class="error">{data.error}</p>{/if}

<div class="kpis">
  <div class="card kpi"><span class="muted small">{t('dashboard.totalOrders')}</span><strong>{recent.Total}</strong></div>
  <div class="card kpi"><span class="muted small">{t('dashboard.showing')}</span><strong>{recent.Items.length} {t('dashboard.recentSuffix')}</strong></div>
  <div class="card kpi"><a class="btn" href="/orders/new">{t('dashboard.newOrder')}</a></div>
</div>

<div class="card section" style="margin-top:1.5rem">
  <h2>{t('dashboard.recentOrders')}</h2>
  {#if recent.Items.length === 0}
    <p class="muted">{t('dashboard.noOrders')}</p>
  {:else}
    <table>
      <thead>
        <tr><th>{t('table.code')}</th><th>{t('table.customer')}</th><th>{t('table.service')}</th><th>{t('table.total')}</th><th>{t('table.status')}</th><th></th></tr>
      </thead>
      <tbody>
        {#each recent.Items as o (o.id)}
          <tr>
            <td><strong>{o.OrderCode}</strong></td>
            <td>{o.CustomerName}<br/><span class="muted small">{o.CustomerPhone}</span></td>
            <td>{o.ServiceTypeCode}</td>
            <td>{inr(o.TotalInr)}</td>
            <td><span class="badge info">{o.Status}</span></td>
            <td><a href="/orders/{o.id}">{t('action.open')}</a></td>
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
