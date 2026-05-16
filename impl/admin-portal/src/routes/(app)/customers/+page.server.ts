import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Identity } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals, url }) => {
  const u = locals.sessionUser!;
  const q = url.searchParams.get('q') ?? undefined;
  try {
    const result = await Identity.searchCustomers(u.accessToken, q);
    return { result, q };
  } catch (e) {
    const err = e as { message?: string };
    return { result: { items: [] }, q, error: err.message };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const u = locals.sessionUser!;
    const data = await request.formData();
    const body: Record<string, unknown> = {
      Name: data.get('Name'),
      Phone: data.get('Phone'),
      Email: (data.get('Email') as string) || undefined,
      CustomerType: data.get('CustomerType') || 'Retail',
      BusinessName: (data.get('BusinessName') as string) || undefined,
      Gstin: (data.get('Gstin') as string) || undefined,
    };
    try {
      const created = await Identity.createCustomer(u.accessToken, body);
      return { created };
    } catch (e) {
      const err = e as { message?: string };
      return fail(400, { error: err.message ?? 'Failed to create customer', values: body });
    }
  },
};
