import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Identity, Orders } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals, url }) => {
  const u = locals.sessionUser!;
  const service = url.searchParams.get('service') ?? 'DRY_CLEAN';
  const customerId = url.searchParams.get('customerId') ?? '';
  const [services, catalog, customer] = await Promise.all([
    Orders.services(u.accessToken),
    Orders.catalog(u.accessToken, service),
    customerId ? Identity.getCustomer(u.accessToken, customerId) : Promise.resolve(null),
  ]);
  return { services, catalog, selectedService: service, customer, customerId };
};

interface CreateForm {
  customerId: string;
  serviceTypeCode: string;
  channel: 'HomePickup' | 'DropAtShop';
  deliveryType: 'HomeDelivery' | 'CustomerPickup';
  isExpress: boolean;
  notes?: string;
  items: { itemId: string; quantity: number }[];
}

function parseForm(data: FormData): CreateForm {
  const items: CreateForm['items'] = [];
  for (const [k, v] of data.entries()) {
    if (k.startsWith('qty:')) {
      const id = k.slice('qty:'.length);
      const qty = Number(v);
      if (Number.isFinite(qty) && qty > 0) items.push({ itemId: id, quantity: qty });
    }
  }
  return {
    customerId: String(data.get('customerId') ?? ''),
    serviceTypeCode: String(data.get('serviceTypeCode') ?? 'DRY_CLEAN'),
    channel: (String(data.get('channel') ?? 'DropAtShop') as CreateForm['channel']),
    deliveryType: (String(data.get('deliveryType') ?? 'CustomerPickup') as CreateForm['deliveryType']),
    isExpress: data.get('isExpress') === 'on',
    notes: (data.get('notes') as string) || undefined,
    items,
  };
}

export const actions: Actions = {
  quote: async ({ request, locals }) => {
    const u = locals.sessionUser!;
    const f = parseForm(await request.formData());
    if (f.items.length === 0) return fail(400, { error: 'Add at least one item' });
    try {
      const quote = await Orders.quote(u.accessToken, {
        serviceTypeCode: f.serviceTypeCode,
        deliveryType: f.deliveryType,
        isExpress: f.isExpress,
        items: f.items,
      });
      return { quote, form: f };
    } catch (e) {
      const err = e as { message?: string };
      return fail(400, { error: err.message ?? 'Quote failed', form: f });
    }
  },
  create: async ({ request, locals }) => {
    const u = locals.sessionUser!;
    const f = parseForm(await request.formData());
    if (!f.customerId) return fail(400, { error: 'Select a customer first' });
    if (f.items.length === 0) return fail(400, { error: 'Add at least one item' });
    try {
      const order = await Orders.createOrder(u.accessToken, f);
      throw redirect(303, `/orders/${(order as { id: string }).id}`);
    } catch (e) {
      if ((e as { status?: number }).status === 303) throw e;
      const err = e as { message?: string };
      return fail(400, { error: err.message ?? 'Failed to create order', form: f });
    }
  },
};
