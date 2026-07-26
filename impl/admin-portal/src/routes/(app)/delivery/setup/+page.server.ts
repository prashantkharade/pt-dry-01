import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Delivery } from '$lib/server/backend';

/////////////////////////////////////////////////////////////////////////
//  Delivery setup — the master data the whole delivery domain rests on.
//
//  Before this page, zones/societies/slots/partners could only be created
//  by hitting the API with curl. Nothing works without them: no slot means
//  no booking, no partner means no run. This is admin-only (SystemAdmin);
//  the backend enforces that too.
/////////////////////////////////////////////////////////////////////////

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.sessionUser!;
  if (!session.roles.includes('SystemAdmin')) {
    throw error(403, 'Delivery setup is for administrators.');
  }

  //Each section loads independently so one failure doesn't blank the page.
  const [zones, societies, slots, partners] = await Promise.all([
    Delivery.zones(session.accessToken).catch(() => []),
    Delivery.societies(session.accessToken).catch(() => []),
    Delivery.slots(session.accessToken).catch(() => []),
    Delivery.partners(session.accessToken).catch(() => []),
  ]);

  return { zones: zones ?? [], societies: societies ?? [], slots: slots ?? [], partners: partners ?? [] };
};

//  A thin wrapper so every action reports the backend's own message on failure
//  rather than a generic one — a duplicate code or a bad time range is exactly
//  what the admin needs to see.
const run = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { success: true };
  } catch (e) {
    return fail(400, { error: (e as { message?: string }).message ?? 'Could not save' });
  }
};

const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

export const actions: Actions = {
  createZone: async ({ request, locals }) => {
    const d = await request.formData();
    return run(() => Delivery.createZone(locals.sessionUser!.accessToken, {
      Code: str(d, 'Code').toUpperCase(),
      Name: str(d, 'Name'),
      NameMr: str(d, 'NameMr') || undefined,
      Coverage: str(d, 'Coverage') || undefined,
    }));
  },

  createSociety: async ({ request, locals }) => {
    const d = await request.formData();
    return run(() => Delivery.createSociety(locals.sessionUser!.accessToken, {
      ZoneId: str(d, 'ZoneId'),
      Name: str(d, 'Name'),
      Pincode: str(d, 'Pincode') || undefined,
      //Distance from the shop — drives the delivery-charge bracket, so it
      //matters even though it's optional here.
      DistanceKm: str(d, 'DistanceKm') ? Number(str(d, 'DistanceKm')) : undefined,
    }));
  },

  createSlot: async ({ request, locals }) => {
    const d = await request.formData();
    return run(() => Delivery.createSlot(locals.sessionUser!.accessToken, {
      Name: str(d, 'Name'),
      NameMr: str(d, 'NameMr') || undefined,
      SlotType: str(d, 'SlotType') || 'Both',
      StartTime: str(d, 'StartTime'),
      EndTime: str(d, 'EndTime'),
      MaxOrders: Number(str(d, 'MaxOrders') || '0'),
      CutoffMinutes: str(d, 'CutoffMinutes') ? Number(str(d, 'CutoffMinutes')) : 60,
    }));
  },

  createPartner: async ({ request, locals }) => {
    const d = await request.formData();
    return run(() => Delivery.createPartner(locals.sessionUser!.accessToken, {
      PartnerCode: str(d, 'PartnerCode'),
      Name: str(d, 'Name'),
      Phone: str(d, 'Phone'),
      VehicleType: str(d, 'VehicleType') || undefined,
      MaxDeliveriesPerDay: str(d, 'MaxDeliveriesPerDay') ? Number(str(d, 'MaxDeliveriesPerDay')) : 20,
    }));
  },

  //  Coverage + roster are what make a partner eligible for auto-assign — a
  //  partner with neither is created but will never be picked.
  addCoverage: async ({ request, locals }) => {
    const d = await request.formData();
    return run(() => Delivery.zoneCoverage(locals.sessionUser!.accessToken, {
      PartnerId: str(d, 'PartnerId'),
      ZoneId: str(d, 'ZoneId'),
      StartDate: str(d, 'StartDate') || new Date().toISOString().slice(0, 10),
    }));
  },

  addRoster: async ({ request, locals }) => {
    const d = await request.formData();
    return run(() => Delivery.roster(locals.sessionUser!.accessToken, {
      PartnerId: str(d, 'PartnerId'),
      SlotId: str(d, 'SlotId'),
      AssignmentDate: str(d, 'AssignmentDate'),
    }));
  },
};
