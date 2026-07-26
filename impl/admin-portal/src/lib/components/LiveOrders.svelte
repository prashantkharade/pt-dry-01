<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  /////////////////////////////////////////////////////////////////////////
  //  Live order feed.
  //
  //  The point: a pickup booked from the app is work that appears with
  //  nobody watching for it. Staff should not have to refresh to find out.
  //
  //  EventSource, not polling: the browser reconnects on its own, and the
  //  connection is plain HTTP so it inherits the session cookie. The
  //  server pins each stream to the caller's tenant.
  /////////////////////////////////////////////////////////////////////////

  interface LiveEvent {
    Type: string; OrderId: string; OrderCode: string;
    Title: string; Detail?: string; Status?: string; At: string;
  }

  let events = $state<LiveEvent[]>([]);
  let connected = $state(false);
  let source: EventSource | null = null;

  //Kept small: this is an "is anything happening" glance, not a log. The
  //orders table below is the real record.
  const MAX = 8;

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const push = (e: LiveEvent) => {
    events = [e, ...events].slice(0, MAX);
    //A new pickup is the one thing worth interrupting someone for.
    if (e.Type === 'order.created') chime();
  };

  /**
   * A short tone via WebAudio.
   *
   * No audio asset to ship, and no autoplay problem: this only ever fires
   * after the user has interacted with the page (they navigated to it), and
   * it fails silently in browsers that refuse.
   */
  const chime = () => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.36);
      osc.onended = () => ctx.close();
    } catch { /* muted tab, or the browser said no. Not worth surfacing. */ }
  };

  onMount(() => {
    //Proxied through the portal so the browser never holds a backend URL or
    //an API key — same two-tier rule as every other call.
    source = new EventSource('/api/stream/orders');
    source.addEventListener('ready', () => (connected = true));
    source.addEventListener('order.created', (e) => push(JSON.parse((e as MessageEvent).data)));
    source.addEventListener('order.status', (e) => push(JSON.parse((e as MessageEvent).data)));
    source.onerror = () => {
      //EventSource retries on its own; just reflect the state.
      connected = false;
    };
  });

  onDestroy(() => source?.close());
</script>

<div class="card live">
  <div class="head">
    <h2>Live</h2>
    <span class="dot" class:on={connected} title={connected ? 'Connected' : 'Reconnecting…'}></span>
  </div>

  {#if events.length === 0}
    <p class="idle">
      {connected ? 'Watching for new orders…' : 'Connecting…'}
    </p>
  {:else}
    <ul>
      {#each events as e (e.OrderId + e.At)}
        <li class:new={e.Type === 'order.created'}>
          <div class="row">
            <a href="/orders/{e.OrderId}">{e.Title}</a>
            <span class="muted small">{time(e.At)}</span>
          </div>
          {#if e.Detail}<span class="muted small">{e.Detail}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* Sticky so it stays visible while the orders table scrolls past.
     min-height gives it the presence of a panel rather than a stub — an
     empty feed is the NORMAL state on a quiet morning, and a 2cm-tall card
     next to a full-height column reads as a rendering fault. */
  .live {
    padding: 1rem;
    position: sticky;
    top: 1rem;
    display: flex;
    flex-direction: column;
    min-height: 320px;
    max-height: calc(100vh - 4rem);
  }
  /* The feed grows into the space; the empty state centres in it. */
  .live ul { overflow-y: auto; flex: 1; }
  .live .idle { flex: 1; display: grid; place-items: center; }
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
  h2 { font-size: 0.95rem; margin: 0; }

  /* Connection state, not decoration: a dead stream must be visible or staff
     trust a feed that stopped updating an hour ago. */
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted-foreground, #9ca3af); }
  .dot.on { background: #0ca30c; box-shadow: 0 0 0 3px rgb(12 163 12 / 0.15); }

  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  li { padding: 0.5rem 0.6rem; border-radius: 6px; background: var(--secondary, #f3f4f6); }
  li.new {
    border-left: 3px solid var(--primary);
    /* Fades out — an event that arrived 10 minutes ago is not still "new". */
    animation: land 0.4s ease-out;
  }
  .row { display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline; }
  .small { font-size: 0.78rem; }
  .idle { color: var(--muted-foreground, #6b7280); font-size: 0.85rem; padding: 1.5rem 0; text-align: center; margin: 0; }

  @keyframes land {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: none; }
  }
  /* Respect the OS setting — a flashing panel is a real problem for some people. */
  @media (prefers-reduced-motion: reduce) {
    li.new { animation: none; }
  }
</style>
