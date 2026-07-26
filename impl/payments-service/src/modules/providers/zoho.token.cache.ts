/////////////////////////////////////////////////////////////////////////
//  Zoho OAuth access-token cache.
//
//  Zoho issues short-lived access tokens (~1h) from a long-lived refresh
//  token, and rate-limits the refresh endpoint. Minting a fresh token per
//  API call would burn that budget and add a round-trip to every payment.
//
//  Process-local by design: a token is not shared state worth a Redis
//  round-trip, and each instance refreshing once an hour is negligible.
/////////////////////////////////////////////////////////////////////////

interface CacheEntry {
    AccessToken : string;
    ExpiresAtMs : number;
}

export class ZohoTokenCache {

    private static _entries = new Map<string, CacheEntry>();

    /**
     * Treat a token as expired slightly early. A token that is valid when we
     * check but expires in flight produces a confusing 401 from the payment
     * call itself rather than a clean refresh.
     */
    private static readonly SKEW_MS = 5 * 60 * 1000;

    public static get = (key: string): string | null => {
        const entry = ZohoTokenCache._entries.get(key);
        if (!entry) return null;
        if (Date.now() >= entry.ExpiresAtMs - ZohoTokenCache.SKEW_MS) {
            ZohoTokenCache._entries.delete(key);
            return null;
        }
        return entry.AccessToken;
    };

    public static set = (key: string, accessToken: string, expiresInSeconds: number): void => {
        ZohoTokenCache._entries.set(key, {
            AccessToken : accessToken,
            ExpiresAtMs : Date.now() + expiresInSeconds * 1000,
        });
    };

    public static clear = (key?: string): void => {
        if (key) ZohoTokenCache._entries.delete(key);
        else     ZohoTokenCache._entries.clear();
    };
}
