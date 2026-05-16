import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.sessionUser) throw redirect(303, '/signin');
  return { sessionUser: locals.sessionUser };
};
