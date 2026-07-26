<script lang="ts">
  /////////////////////////////////////////////////////////////////////////
  //  Orders per day.
  //
  //  Hand-rolled SVG rather than a chart library: this is one line with a
  //  crosshair. A charting dependency would be ~90KB to draw a polyline,
  //  and would fight the portal's CSS tokens for control of the theme.
  //
  //  ONE series, so no legend — the title names it (per the data-viz rule:
  //  a legend for one series is noise). One hue, because this encodes
  //  magnitude over time, not identity.
  /////////////////////////////////////////////////////////////////////////

  interface Point { Date: string; Count: number; RevenueInr: string; }
  let { points, height = 180 }: { points: Point[]; height?: number } = $props();

  const W = 720;
  const PAD = { top: 16, right: 16, bottom: 26, left: 34 };

  const max = $derived(Math.max(1, ...points.map((p) => p.Count)));
  const plotW = $derived(W - PAD.left - PAD.right);
  const plotH = $derived(height - PAD.top - PAD.bottom);

  //A single point has no width to spread over; centre it rather than divide
  //by zero.
  const x = (i: number) => points.length <= 1
    ? PAD.left + plotW / 2
    : PAD.left + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const line = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.Count)}`).join(' '));
  //Close the path down to the baseline for the fill.
  const area = $derived(points.length
    ? `${line} L ${x(points.length - 1)} ${PAD.top + plotH} L ${x(0)} ${PAD.top + plotH} Z`
    : '');

  //Gridlines: distinct integers only. A max of 2 would otherwise produce
  //ticks [0,1,1,2,2] — the same line drawn twice with a duplicate label.
  const ticks = $derived(
    [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)))],
  );

  let hover = $state<number | null>(null);

  const dayLabel = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  //Only the hovered point gets a value label.
  //
  //Labelling the endpoints by default sounds helpful but collides with the
  //y-axis ticks — the first point sits exactly on the axis, so its value
  //prints on top of the tick showing the same number. The crosshair tooltip
  //already answers "what is this point", so the static labels were noise
  //that happened to overlap.
  const showLabel = (i: number) => hover === i;
</script>

<div class="viz-root">
  {#if points.length === 0}
    <p class="empty">No orders in this period.</p>
  {:else}
    <svg viewBox="0 0 {W} {height}" role="img" aria-label="Orders per day">
      <!-- Recessive grid: present enough to read against, quiet enough to ignore. -->
      {#each ticks as t}
        <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
        <text class="axis" x={PAD.left - 8} y={y(t) + 4} text-anchor="end">{t}</text>
      {/each}

      <path class="area" d={area} />
      <path class="line" d={line} />

      {#each points as p, i}
        <!-- Hit target far bigger than the 4px dot: a 4px mark is unhittable. -->
        <rect
          class="hit"
          x={x(i) - plotW / Math.max(points.length, 1) / 2}
          y={PAD.top}
          width={plotW / Math.max(points.length, 1)}
          height={plotH}
          onmouseenter={() => (hover = i)}
          onmouseleave={() => (hover = null)}
          role="presentation"
        />
        {#if hover === i}
          <line class="crosshair" x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + plotH} />
        {/if}
        <circle class="dot" class:on={hover === i} cx={x(i)} cy={y(p.Count)} r={hover === i ? 5 : 3} />
        {#if showLabel(i)}
          <text class="value" x={x(i)} y={y(p.Count) - 10} text-anchor="middle">{p.Count}</text>
        {/if}
      {/each}

      <!-- Only the ends get an x label; 30 dates would collide into mush. -->
      <text class="axis" x={x(0)} y={height - 8} text-anchor="start">{dayLabel(points[0].Date)}</text>
      {#if points.length > 1}
        <text class="axis" x={x(points.length - 1)} y={height - 8} text-anchor="end">
          {dayLabel(points[points.length - 1].Date)}
        </text>
      {/if}
    </svg>

    {#if hover !== null}
      <div class="tip">
        <strong>{dayLabel(points[hover].Date)}</strong>
        <span>{points[hover].Count} order{points[hover].Count === 1 ? '' : 's'}</span>
        <span class="muted">₹{Number(points[hover].RevenueInr).toLocaleString('en-IN')}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Roles, not raw hex — so the light/dark swap happens in one place.
     Values come from the validated reference palette. */
  .viz-root {
    --series-1: #2a78d6;
    --grid: var(--border);
    position: relative;
  }
  /* The portal's toggle stamps data-theme on <html>; it must win over the OS. */
  :global(:root[data-theme='ptk-dark']) .viz-root { --series-1: #3987e5; }

  svg { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--grid); stroke-width: 1; opacity: 0.6; }
  .axis { fill: var(--muted-foreground, #6b7280); font-size: 10px; }
  .line { fill: none; stroke: var(--series-1); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .area { fill: var(--series-1); opacity: 0.10; }
  .dot { fill: var(--series-1); stroke: var(--card); stroke-width: 2; transition: r 0.1s; }
  .crosshair { stroke: var(--series-1); stroke-width: 1; opacity: 0.35; stroke-dasharray: 3 3; }
  .hit { fill: transparent; cursor: crosshair; }
  /* Text wears text tokens, never the series colour. */
  .value { fill: var(--foreground); font-size: 11px; font-weight: 600; }
  .tip {
    position: absolute; top: 0; right: 0;
    background: var(--popover, var(--card)); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 10px; font-size: 12px;
    display: flex; gap: 0.5rem; align-items: baseline; pointer-events: none;
  }
  .empty { color: var(--muted-foreground, #6b7280); text-align: center; padding: 3rem 0; margin: 0; }
</style>
