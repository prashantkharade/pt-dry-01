import type { PageServerLoad } from './$types';
import { Orders } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals }) => {
  const u = locals.sessionUser!;
  try {
    const recent = await Orders.listOrders(u.accessToken, { pageSize: 5 });
    return { recentOrders: recent };
  } catch (e) {
    const err = e as { message?: string };
    return { recentOrders: { items: [], total: 0, page: 1, pageSize: 5 }, error: err.message };
  }
};
