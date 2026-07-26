import type { PageServerLoad } from './$types';
import { Orders } from '$lib/server/backend';

/////////////////////////////////////////////////////////////////////////
//  Dashboard.
//
//  Summary and list are fetched with the SAME filters, so the headline
//  numbers can never disagree with the table beneath them — which is the
//  fastest way to make a dashboard untrustworthy.
/////////////////////////////////////////////////////////////////////////

const PRESETS = ['Today', 'Yesterday', 'Week', 'Month', 'Quarter', 'Year', 'All'] as const;
type Preset = (typeof PRESETS)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.sessionUser!;
  //Whitelist rather than pass through: the value goes into an API query, and
  //defaulting is friendlier than a 400 on a hand-edited URL.
  const raw = url.searchParams.get('preset') ?? 'Week';
  const preset: Preset = (PRESETS as readonly string[]).includes(raw) ? (raw as Preset) : 'Week';

  //One slow call must not blank the page — each section degrades on its own.
  const [summary, recent] = await Promise.all([
    Orders.summary(session.accessToken, { Preset: preset }).catch(() => null),
    Orders.list(session.accessToken, { Preset: preset, ItemsPerPage: 8 }).catch(() => null),
  ]);

  return { preset, presets: PRESETS, summary, recent };
};
