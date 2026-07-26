import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { COOKIE_NAME, SessionStore } from '$lib/session';

export const POST: RequestHandler = async ({ cookies }) => {
  const sid = cookies.get(COOKIE_NAME);
  if (sid) await SessionStore.del(sid);
  cookies.delete(COOKIE_NAME, { path: '/' });
  throw redirect(303, '/signin');
};
