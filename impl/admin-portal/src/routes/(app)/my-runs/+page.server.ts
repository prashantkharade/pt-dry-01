import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Delivery } from '$lib/server/backend';

/////////////////////////////////////////////////////////////////////////
//  "My Runs" — the delivery partner's worklist.
//
//  Partners work the admin portal rather than a separate app (see the
//  DeliveryPartner role). The backend scopes /delivery/my-runs to the
//  caller's own partner profile, so this page cannot show anyone else's
//  work even if the route were reached by another role.
/////////////////////////////////////////////////////////////////////////

const today = () => new Date().toISOString().slice(0, 10);

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.sessionUser!;
  const date = url.searchParams.get('date') ?? today();

  //Fail fast with a readable message rather than surfacing the API's 403.
  if (!session.roles.includes('DeliveryPartner')) {
    throw error(403, 'This page is for delivery partners. Ask an admin to link your login to a partner record.');
  }

  try {
    const runs = await Delivery.myRuns(session.accessToken, date);
    return { runs: runs ?? [], date };
  } catch (e) {
    const err = e as { message?: string };
    //A partner with no linked profile gets a 404 from the API — that is a
    //setup problem, and saying so beats an empty list that looks like "no work".
    return { runs: [], date, loadError: err.message ?? 'Could not load your runs' };
  }
};

export const actions: Actions = {
  //  Advance a run: Assigned -> Started -> Arrived -> Completed.
  //  The backend enforces the order, so the UI only has to offer the next step.
  transition: async ({ request, locals }) => {
    const session = locals.sessionUser!;
    const data = await request.formData();
    const id = String(data.get('id') ?? '');
    const status = String(data.get('status') ?? '');
    if (!id || !status) return fail(400, { error: 'Missing run or status' });

    const body: Record<string, unknown> = { Status: status };

    //Required by the API when failing — a failed run with no reason is
    //useless to whoever retries it.
    const reason = String(data.get('failedReason') ?? '').trim();
    if (status === 'Failed') {
      if (!reason) return fail(400, { error: 'Please say why the run failed' });
      body.FailedReason = reason;
    }
    //Captured at pickup: the customer's booked count and the real bag differ
    //more often than not.
    const itemCount = String(data.get('itemCount') ?? '').trim();
    if (status === 'Completed' && itemCount) body.ItemCountCollected = Number(itemCount);

    try {
      await Delivery.transitionRun(session.accessToken, id, body);
      return { success: true };
    } catch (e) {
      const err = e as { message?: string };
      return fail(400, { error: err.message ?? 'Could not update the run' });
    }
  },
};
