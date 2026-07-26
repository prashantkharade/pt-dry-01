import type { PageServerLoad } from './$types';
import { Orders } from '$lib/server/backend';

const PRESETS = ['Today', 'Yesterday', 'Week', 'Month', 'Quarter', 'Year', 'All'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
  const u = locals.sessionUser!;
  const Query = url.searchParams.get('q') ?? undefined;
  const Status = url.searchParams.get('status') ?? undefined;
  const PageIndex = Number(url.searchParams.get('page') ?? '0');

  //Whitelist the preset — it goes straight into the API query. Default 'All'
  //so the list shows everything until someone narrows it.
  const rawPreset = url.searchParams.get('preset') ?? 'All';
  const Preset = (PRESETS as readonly string[]).includes(rawPreset) ? rawPreset : 'All';

  try {
    const result = await Orders.list(u.accessToken, { Query, Status, Preset, PageIndex, ItemsPerPage: 25 });
    return { result, q: Query, status: Status, preset: Preset, presets: PRESETS };
  } catch (e) {
    const err = e as { message?: string };
    return {
      result: { Items: [], Total: 0, PageIndex: 0, ItemsPerPage: 25 },
      q: Query, status: Status, preset: Preset, presets: PRESETS, error: err.message,
    };
  }
};
