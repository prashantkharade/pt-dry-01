export interface SessionUser {
  userId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tenantId: string;
  branchId: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  preferredLanguage: string;
}

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'ptk_session';

// In-memory session store, keyed by an opaque sessionId stored in the cookie.
// Production: replace with Redis (see kleo-ui session.manager.ts).
const store = new Map<string, SessionUser>();

export const SessionStore = {
  set(sessionId: string, user: SessionUser) { store.set(sessionId, user); },
  get(sessionId: string): SessionUser | null { return store.get(sessionId) ?? null; },
  del(sessionId: string) { store.delete(sessionId); },
};
