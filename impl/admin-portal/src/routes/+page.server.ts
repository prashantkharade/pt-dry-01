import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.sessionUser) throw redirect(303, '/dashboard');
  throw redirect(303, '/signin');
};
