import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { COOKIE_NAME, SessionStore } from '$lib/session';
import { Identity } from '$lib/server/backend';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.sessionUser) throw redirect(303, '/dashboard');
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const emailOrPhone = String(data.get('emailOrPhone') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (!emailOrPhone || !password) {
      return fail(400, { error: 'Email/phone and password are required', values: { emailOrPhone } });
    }
    try {
      const result = await Identity.login(emailOrPhone, password);
      const sessionId = randomUUID();
      const u = result.user as Record<string, unknown>;
      SessionStore.set(sessionId, {
        userId: String(u.id),
        firstName: String(u.firstName ?? ''),
        lastName: u.lastName as string | undefined,
        email: u.email as string | undefined,
        phone: u.phone as string | undefined,
        tenantId: String(u.tenantId),
        branchId: String(u.branchId),
        roles: (u.roles as string[]) ?? [],
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        preferredLanguage: (u.preferredLanguage as string) ?? 'en',
      });
      cookies.set(COOKIE_NAME, sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: Number(process.env.SESSION_TTL_SEC ?? 3600),
      });
    } catch (e) {
      const err = e as { message?: string };
      return fail(401, { error: err.message ?? 'Login failed', values: { emailOrPhone } });
    }
    throw redirect(303, '/dashboard');
  },
};
