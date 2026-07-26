import express from 'express';
import { ApiError } from '../../common/api.error';
import { HttpStatusCodes } from '../../common/http.status.codes';
import { ClientAppRegistry } from './client.app.registry';
import { AuthOptions } from '../../domain.types/enums/auth.enums';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Inter-service / client-app authenticator.
//
//  Runs BEFORE the JWT check, so an unknown caller is turned away before we
//  spend anything on token verification or DB work. Establishes *which app*
//  is calling; the JWT that follows establishes *which user*.
//
//  This deliberately grants no authority of its own. A valid key does not
//  make a caller privileged — it only lets the request proceed to user
//  authentication. (The reference implementations we drew on had an
//  `IsPrivileged` flag that skipped both authn and authz; one leaked key
//  there meant unconditional access to every tenant. Not reproduced.)
//
//  `AllowedClients` narrows a route to named client apps. That is the only
//  safe way to expose a service-to-service endpoint that runs without a user
//  token: otherwise any holder of any valid key — including the customer app
//  on someone's phone — could call it.
/////////////////////////////////////////////////////////////////////////

const HEADER = 'x-api-key';

export function clientAppAuthenticator(options?: Partial<AuthOptions>) {
    return (req: express.Request, _res: express.Response, next: express.NextFunction): void => {
        const apiKey = req.headers[HEADER] as string | undefined;

        if (!apiKey || apiKey.trim() === '') {
            return next(new ApiError('Missing x-api-key', HttpStatusCodes.UNAUTHORIZED));
        }

        const clientCode = ClientAppRegistry.resolve(apiKey);
        if (!clientCode) {
            //Log the caller, never the key they presented.
            logger.warn(`Rejected unknown x-api-key from ${req.ip} for ${req.method} ${req.path}`);
            return next(new ApiError('Unknown client app key', HttpStatusCodes.UNAUTHORIZED));
        }

        const allowed = options?.AllowedClients;
        if (allowed && allowed.length > 0 && !allowed.includes(clientCode)) {
            logger.warn(`Client ${clientCode} is not permitted on ${req.method} ${req.path}`);
            return next(new ApiError('This client app may not call this endpoint', HttpStatusCodes.FORBIDDEN));
        }

        req.clientApp = clientCode;
        return next();
    };
}
