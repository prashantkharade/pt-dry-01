import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Delivery } from '$lib/server/backend';

/////////////////////////////////////////////////////////////////////////
//  The delivery board — ops view of one day's runs.
//
//  Answers the two questions the shop actually asks each morning:
//    "what is going out today, and who has it?"  -> runs
//    "what still has nobody?"                    -> unassigned
/////////////////////////////////////////////////////////////////////////

const today = () => new Date().toISOString().slice(0, 10);

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.sessionUser!;
  const date = url.searchParams.get('date') ?? today();

  if (!session.roles.some((r) => r === 'SystemAdmin' || r === 'Receptionist')) {
    throw error(403, 'The delivery board is for shop staff.');
  }

  //One slow call must not blank the whole board, so each section degrades on
  //its own.
  const [runs, unassigned, partners] = await Promise.all([
    Delivery.board(session.accessToken, date).catch(() => []),
    Delivery.unassigned(session.accessToken, date).catch(() => []),
    Delivery.partners(session.accessToken).catch(() => []),
  ]);

  return { date, runs: runs ?? [], unassigned: unassigned ?? [], partners: partners ?? [] };
};

export const actions: Actions = {
  //  Hand a leg to a specific partner. Supersedes any live run for that leg
  //  rather than stacking a second one — the API handles that.
  assign: async ({ request, locals }) => {
    const session = locals.sessionUser!;
    const d = await request.formData();
    const body = {
      OrderId  : String(d.get('orderId') ?? ''),
      Direction: String(d.get('direction') ?? ''),
      PartnerId: String(d.get('partnerId') ?? ''),
      BookingId: String(d.get('bookingId') ?? ''),
    };
    if (!body.OrderId || !body.PartnerId || !body.BookingId) {
      return fail(400, { error: 'Pick a partner first' });
    }
    try {
      await Delivery.assign(session.accessToken, body);
      return { success: true };
    } catch (e) {
      return fail(400, { error: (e as { message?: string }).message ?? 'Could not assign' });
    }
  },

  //  Let the system pick. Returns 200 with a reason when nobody is eligible —
  //  "no partner covers this zone today" is an ops fact, not an error.
  autoAssign: async ({ request, locals }) => {
    const session = locals.sessionUser!;
    const d = await request.formData();
    try {
      const res = await Delivery.autoAssign(session.accessToken, {
        OrderId  : String(d.get('orderId') ?? ''),
        Direction: String(d.get('direction') ?? ''),
        SocietyId: String(d.get('societyId') ?? ''),
        BookingId: String(d.get('bookingId') ?? ''),
      });
      const r = res as { Assigned?: boolean; Reason?: string };
      return r.Assigned ? { success: true } : fail(400, { error: r.Reason ?? 'No partner available' });
    } catch (e) {
      return fail(400, { error: (e as { message?: string }).message ?? 'Auto-assign failed' });
    }
  },
};
