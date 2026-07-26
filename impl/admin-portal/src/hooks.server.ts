import type { Handle } from '@sveltejs/kit';
import { COOKIE_NAME, SessionStore } from '$lib/session';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(COOKIE_NAME);
  event.locals.sessionUser = sessionId ? await SessionStore.get(sessionId) : null;
  return resolve(event);
};
