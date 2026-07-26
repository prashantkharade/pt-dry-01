import Redis from 'ioredis';

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

/**
 * Session lifetime. Shared with the cookie's maxAge so the cookie and the
 * server-side record expire together — a cookie that outlives its session
 * just produces confusing "logged in but not really" states.
 */
export const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC ?? 3600);

const KEY_PREFIX = 'ptk:admin:session:';

/////////////////////////////////////////////////////////////////////////
//  Session store.
//
//  Sessions live in Redis, not in process memory. In-memory sessions have
//  two failure modes that both look like "the portal randomly logs people
//  out": every deploy/restart drops all sessions, and with more than one
//  instance behind a load balancer a request only authenticates when it
//  happens to land on the instance that served the login.
//
//  Dev without Redis falls back to memory, loudly. Production does not —
//  see the constructor. That fallback is a durability trade-off, not an
//  auth bypass: an unknown session id is still rejected either way.
/////////////////////////////////////////////////////////////////////////

interface Store {
  set(sessionId: string, user: SessionUser): Promise<void>;
  get(sessionId: string): Promise<SessionUser | null>;
  del(sessionId: string): Promise<void>;
}

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async set(sessionId: string, user: SessionUser): Promise<void> {
    await this.redis.set(KEY_PREFIX + sessionId, JSON.stringify(user), 'EX', SESSION_TTL_SEC);
  }

  async get(sessionId: string): Promise<SessionUser | null> {
    const raw = await this.redis.get(KEY_PREFIX + sessionId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      //A record we can't parse is a record we can't trust. Drop it and make
      //the user log in again rather than serving a half-built session.
      await this.del(sessionId);
      return null;
    }
  }

  async del(sessionId: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + sessionId);
  }
}

class MemoryStore implements Store {
  private map = new Map<string, { user: SessionUser; expiresAt: number }>();

  async set(sessionId: string, user: SessionUser): Promise<void> {
    this.map.set(sessionId, { user, expiresAt: Date.now() + SESSION_TTL_SEC * 1000 });
  }

  async get(sessionId: string): Promise<SessionUser | null> {
    const entry = this.map.get(sessionId);
    if (!entry) return null;
    //Mirror Redis TTL semantics so dev behaves like production.
    if (Date.now() > entry.expiresAt) {
      this.map.delete(sessionId);
      return null;
    }
    return entry.user;
  }

  async del(sessionId: string): Promise<void> {
    this.map.delete(sessionId);
  }
}

const buildStore = (): Store => {
  const url = process.env.REDIS_URL;

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      //Refuse to serve rather than run a multi-instance deploy on per-process
      //sessions. Failing loudly on the first request is far cheaper to
      //diagnose than users being logged out on every other request.
      throw new Error('REDIS_URL is required in production — refusing to start with in-memory sessions');
    }
    console.warn('[session] REDIS_URL not set — using in-memory sessions. Sessions will not survive a restart.');
    return new MemoryStore();
  }

  const redis = new Redis(url, {
    //A session lookup runs on every request. If Redis is down we want a fast,
    //visible failure, not a request that hangs until the browser gives up.
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
    lazyConnect: false,
  });
  redis.on('error', (e: Error) => console.error(`[session] Redis error: ${e.message}`));
  return new RedisStore(redis);
};

/**
 * Built on first use, not at import.
 *
 * `vite build` runs SvelteKit's analyse step with NODE_ENV=production and
 * imports this module — so constructing eagerly made the production guard fire
 * during the BUILD, where there is no Redis and none is needed. The guard
 * belongs on the first request, which is when a session store is genuinely
 * required. It also means we don't open a Redis connection just to typecheck.
 */
let _store: Store | null = null;
const store = (): Store => (_store ??= buildStore());

export const SessionStore: Store = {
  set: (id, user) => store().set(id, user),
  get: (id) => store().get(id),
  del: (id) => store().del(id),
};
