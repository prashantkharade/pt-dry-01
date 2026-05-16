import type { PageServerLoad } from './$types';
import { Orders } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals, url }) => {
  const u = locals.sessionUser!;
  const q = url.searchParams.get('q') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const page = url.searchParams.get('page') ?? '1';
  try {
    const result = await Orders.listOrders(u.accessToken, { q, status, page });
    return { result, q, status };
  } catch (e) {
    const err = e as { message?: string };
    return { result: { items: [], total: 0, page: 1, pageSize: 25 }, q, status, error: err.message };
  }
};
