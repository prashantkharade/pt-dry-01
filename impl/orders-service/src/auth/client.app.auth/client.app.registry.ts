import crypto from 'node:crypto';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Client-app / sister-service API key registry.
//
//  Every caller of this service — the admin portal, the customer app, and
//  the other backend services — carries an `x-api-key`. This registry is
//  the list of keys we accept and the name we log the caller as.
//
//  Keys are discovered from the environment rather than hardcoded: any
//  `API_KEY_<CLIENT_CODE>` var registers a client. That keeps the list in
//  one place (deployment config) instead of drifting across five copies of
//  a source file, and adding a sixth service needs no code change here.
//
//  Revocation is by key rotation + redeploy. That is the normal contract
//  for service-to-service secrets; identity-service's `client_apps` table
//  remains the human-facing record of which clients exist.
/////////////////////////////////////////////////////////////////////////

const ENV_PREFIX = 'API_KEY_';

export interface RegisteredClient {
    ClientCode : string;
    ApiKey     : string;
}

export class ClientAppRegistry {

    private static _clients: RegisteredClient[] | null = null;

    /**
     * `API_KEY_ADMIN_PORTAL` -> `ADMIN-PORTAL`, matching the ClientCode the
     * identity-service seeder writes into `client_apps`.
     */
    private static toClientCode = (envName: string): string =>
        envName.slice(ENV_PREFIX.length).replace(/_/g, '-');

    public static load = (): RegisteredClient[] => {
        if (ClientAppRegistry._clients) return ClientAppRegistry._clients;

        const clients: RegisteredClient[] = [];
        for (const [name, value] of Object.entries(process.env)) {
            if (!name.startsWith(ENV_PREFIX)) continue;
            if (!value || value.trim() === '') continue;
            clients.push({ ClientCode: ClientAppRegistry.toClientCode(name), ApiKey: value.trim() });
        }

        if (clients.length === 0) {
            //In production an empty registry means every authenticated route
            //is unreachable — loud is correct. We do NOT fall back to
            //"allow all": a missing env var must never widen access.
            const message = 'No API_KEY_* client keys configured — every x-api-key will be rejected';
            if (process.env.NODE_ENV === 'production') logger.error(message);
            else logger.warn(message);
        } else {
            logger.info(`ClientAppRegistry: ${clients.length} client key(s) loaded [${clients.map((c) => c.ClientCode).join(', ')}]`);
        }

        ClientAppRegistry._clients = clients;
        return clients;
    };

    /**
     * Resolve a presented key to its client, in constant time.
     *
     * Every candidate is compared even after a match is found, so response
     * latency does not reveal how many keys were checked or which matched.
     */
    public static resolve = (presented: string): string | null => {
        const clients = ClientAppRegistry.load();
        let matched: string | null = null;
        for (const client of clients) {
            if (ClientAppRegistry.constantTimeEquals(client.ApiKey, presented)) {
                matched = client.ClientCode;
            }
        }
        return matched;
    };

    private static constantTimeEquals = (a: string, b: string): boolean => {
        //timingSafeEqual requires equal lengths. Hashing both sides first
        //gives fixed-width inputs, so key length itself doesn't leak.
        const ha = crypto.createHash('sha256').update(a).digest();
        const hb = crypto.createHash('sha256').update(b).digest();
        return crypto.timingSafeEqual(ha, hb);
    };

    //Test seam: env is read once and memoised, so tests that mutate env
    //need a way to force a re-read.
    public static reset = (): void => { ClientAppRegistry._clients = null; };
}
