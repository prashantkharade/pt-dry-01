/////////////////////////////////////////////////////////////////////////
//  Back-compat shim — the canonical cache lives in `cache.client.ts`.
//  Existing call sites use `redis()` from this file; we keep the name
//  but return the ICache abstraction (Redis-or-memory) so the service
//  starts even when no Redis is available.
/////////////////////////////////////////////////////////////////////////

import { cache, ICache } from './cache.client';

export function redis(): ICache {
    return cache();
}
