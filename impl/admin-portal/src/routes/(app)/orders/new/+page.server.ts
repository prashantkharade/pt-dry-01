import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Identity, Catalog, Orders } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals, url }) => {
  const u = locals.sessionUser!;
  const service = url.searchParams.get('service') ?? 'DRY_CLEAN';
  const customerId = url.searchParams.get('customerId') ?? '';
  const [services, catalog, customer] = await Promise.all([
    Catalog.services(u.accessToken),
    Catalog.items(u.accessToken, service),
    customerId ? Identity.getCustomer(u.accessToken, customerId) : Promise.resolve(null),
  ]);
  return { services, catalog, selectedService: service, customer, customerId };
};

interface CreateForm {
  CustomerId      : string;
  ServiceTypeCode : string;
  Channel         : 'HomePickup' | 'DropAtShop';
  DeliveryType    : 'HomeDelivery' | 'CustomerPickup';
  IsExpress       : boolean;
  Notes?          : string;
  Items           : { ItemId: string; Quantity: number }[];
}

function parseForm(data: FormData): CreateForm {
  const items: CreateForm['Items'] = [];
  for (const [k, v] of data.entries()) {
    if (k.startsWith('qty:')) {
      const id = k.slice('qty:'.length);
      const qty = Number(v);
      if (Number.isFinite(qty) && qty > 0) items.push({ ItemId: id, Quantity: qty });
    }
  }
  return {
    CustomerId      : String(data.get('customerId') ?? ''),
    ServiceTypeCode : String(data.get('serviceTypeCode') ?? 'DRY_CLEAN'),
    Channel         : (String(data.get('channel') ?? 'DropAtShop') as CreateForm['Channel']),
    DeliveryType    : (String(data.get('deliveryType') ?? 'CustomerPickup') as CreateForm['DeliveryType']),
    IsExpress       : data.get('isExpress') === 'on',
    Notes           : (data.get('notes') as string) || undefined,
    Items           : items,
  };
}

export const actions: Actions = {
  quote: async ({ request, locals }) => {
    const u = locals.sessionUser!;
    const f = parseForm(await request.formData());
    if (f.Items.length === 0) return fail(400, { error: 'Add at least one item' });
    try {
      const quote = await Catalog.quote(u.accessToken, {
        ServiceTypeCode : f.ServiceTypeCode,
        DeliveryType    : f.DeliveryType,
        IsExpress       : f.IsExpress,
        IsVendor        : false,
        Items           : f.Items,
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
    if (!f.CustomerId) return fail(400, { error: 'Select a customer first' });
    if (f.Items.length === 0) return fail(400, { error: 'Add at least one item' });
    try {
      const order = await Orders.create(u.accessToken, f);
      throw redirect(303, `/orders/${(order as { id: string }).id}`);
    } catch (e) {
      if ((e as { status?: number }).status === 303) throw e;
      const err = e as { message?: string };
      return fail(400, { error: err.message ?? 'Failed to create order', form: f });
    }
  },
};
