import Redis from 'ioredis';
import { logger } from '../../logger/logger';
import { ConfigurationManager } from '../../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Cache client — Redis when REDIS_URL is set, in-memory fallback when
//  not. Exposes the small surface used by OTPs and sessions: get / set
//  with TTL / del / incr / expire.
//
//  The in-memory fallback is process-local and dies on restart — fine for
//  single-instance dev. In production, set REDIS_URL so all replicas see
//  the same OTPs and sessions.
/////////////////////////////////////////////////////////////////////////

export interface ICache {
    get   (key: string): Promise<string | null>;
    set   (key: string, value: string, ttlSeconds?: number): Promise<void>;
    del   (...keys: string[]): Promise<void>;
    incr  (key: string): Promise<number>;
    expire(key: string, ttlSeconds: number): Promise<void>;
}

/////////////////////////////////////////////////////////////////////////
//  In-memory implementation. A timer per-key would be wasteful; we lazily
//  expire on read instead.
/////////////////////////////////////////////////////////////////////////

class MemoryCache implements ICache {

    private store = new Map<string, { value: string; expiresAt: number | null }>();

    private isExpired = (entry: { expiresAt: number | null }): boolean => {
        return entry.expiresAt !== null && entry.expiresAt <= Date.now();
    };

    public async get(key: string): Promise<string | null> {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (this.isExpired(entry)) { this.store.delete(key); return null; }
        return entry.value;
    }

    public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
        this.store.set(key, { value, expiresAt });
    }

    public async del(...keys: string[]): Promise<void> {
        for (const k of keys) this.store.delete(k);
    }

    public async incr(key: string): Promise<number> {
        const current = Number(await this.get(key) ?? 0);
        const next    = current + 1;
        const entry   = this.store.get(key);
        const expiresAt = entry?.expiresAt ?? null;
        this.store.set(key, { value: String(next), expiresAt });
        return next;
    }

    public async expire(key: string, ttlSeconds: number): Promise<void> {
        const entry = this.store.get(key);
        if (!entry) return;
        entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
}

/////////////////////////////////////////////////////////////////////////
//  Redis adapter — thin wrapper to match the ICache surface.
/////////////////////////////////////////////////////////////////////////

class RedisCache implements ICache {

    constructor(private client: Redis) {}

    public async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }
    public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
        else            await this.client.set(key, value);
    }
    public async del(...keys: string[]): Promise<void> {
        if (keys.length > 0) await this.client.del(...keys);
    }
    public async incr(key: string): Promise<number> {
        return this.client.incr(key);
    }
    public async expire(key: string, ttlSeconds: number): Promise<void> {
        await this.client.expire(key, ttlSeconds);
    }
}

/////////////////////////////////////////////////////////////////////////

let _cache: ICache | null = null;

export function cache(): ICache {
    if (_cache) return _cache;

    const url = ConfigurationManager.getEnvOptional('REDIS_URL');
    if (!url) {
        logger.info('cache: REDIS_URL not set → using in-memory cache');
        _cache = new MemoryCache();
        return _cache;
    }

    try {
        const client = new Redis(url, {
            lazyConnect          : false,
            maxRetriesPerRequest : 2,
            enableOfflineQueue   : false,
        });
        client.on('error',  (e) => logger.warn(`redis.error: ${e.message}`));
        client.on('connect', () => logger.info('redis.connected'));
        _cache = new RedisCache(client);
    } catch (e: any) {
        logger.warn(`cache: failed to connect to ${url} (${e.message}) → using in-memory cache`);
        _cache = new MemoryCache();
    }
    return _cache;
}
