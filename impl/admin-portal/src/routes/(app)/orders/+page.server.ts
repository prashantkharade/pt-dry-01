import type { PageServerLoad } from './$types';
import { Orders } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals, url }) => {
  const u = locals.sessionUser!;
  const Query = url.searchParams.get('q') ?? undefined;
  const Status = url.searchParams.get('status') ?? undefined;
  const PageIndex = Number(url.searchParams.get('page') ?? '0');
  try {
    const result = await Orders.list(u.accessToken, { Query, Status, PageIndex });
    return { result, q: Query, status: Status };
  } catch (e) {
    const err = e as { message?: string };
    return {
      result: { Items: [], Total: 0, PageIndex: 0, ItemsPerPage: 25 },
      q: Query, status: Status, error: err.message,
    };
  }
};
