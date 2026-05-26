import type { PageServerLoad } from './$types';
import { Orders } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals }) => {
  const u = locals.sessionUser!;
  try {
    const recent = await Orders.list(u.accessToken, { ItemsPerPage: 5 });
    return { recentOrders: recent };
  } catch (e) {
    const err = e as { message?: string };
    return {
      recentOrders: { Items: [], Total: 0, PageIndex: 0, ItemsPerPage: 5 },
      error: err.message,
    };
  }
};
