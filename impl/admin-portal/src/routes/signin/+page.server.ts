import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { COOKIE_NAME, SESSION_TTL_SEC, SessionStore } from '$lib/session';
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
      const u = result.User as Record<string, unknown>;
      await SessionStore.set(sessionId, {
        userId: String(u.id),
        firstName: String(u.FirstName ?? ''),
        lastName: u.LastName as string | undefined,
        email: u.Email as string | undefined,
        phone: u.Phone as string | undefined,
        tenantId: String(u.TenantId),
        branchId: String(u.BranchId),
        roles: (u.Roles as string[]) ?? [],
        accessToken: result.AccessToken,
        refreshToken: result.RefreshToken,
        preferredLanguage: (u.PreferredLanguage as string) ?? 'en',
      });
      cookies.set(COOKIE_NAME, sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        //Same TTL as the Redis record, so cookie and session expire together.
        maxAge: SESSION_TTL_SEC,
      });
    } catch (e) {
      const err = e as { message?: string };
      return fail(401, { error: err.message ?? 'Login failed', values: { emailOrPhone } });
    }
    throw redirect(303, '/dashboard');
  },
};
