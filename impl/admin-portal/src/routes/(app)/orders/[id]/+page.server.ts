import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Orders } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals, params }) => {
  const u = locals.sessionUser!;
  const detail = await Orders.getOrder(u.accessToken, params.id);
  return { detail };
};

export const actions: Actions = {
  status: async ({ request, locals, params }) => {
    const u = locals.sessionUser!;
    const data = await request.formData();
    const status = String(data.get('status') ?? '');
    const note = (data.get('note') as string) || undefined;
    if (!status) return fail(400, { error: 'Status is required' });
    try {
      await Orders.updateStatus(u.accessToken, params.id, status, note);
      return { success: true };
    } catch (e) {
      const err = e as { message?: string };
      return fail(400, { error: err.message ?? 'Update failed' });
    }
  },
};
