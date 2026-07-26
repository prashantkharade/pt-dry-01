import express from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../../common/api.error';
import { HttpStatusCodes } from '../../common/http.status.codes';
import { AuthOptions } from '../../domain.types/enums/auth.enums';
import { CurrentUser } from '../../domain.types/miscellaneous/current.user';
import { ConfigurationManager } from '../../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Bearer-token verifier — every sister service shares the same JWT
//  secret. identity-service is the only issuer.
//
//  AllowAnonymous means "a user token is not REQUIRED", not "ignore any
//  token that is present". A route can legitimately be reached both by a
//  service firing a domain event (no user) and by a signed-in human, and
//  it needs to know which. So on an anonymous route we still parse a token
//  when one is offered — we just don't demand one.
/////////////////////////////////////////////////////////////////////////

interface RawPayload {
    UserId    : string;
    TenantId  : string;
    BranchId? : string;
    SessionId : string;
    Roles     : string[];
    Type      : 'access' | 'refresh';
}

export function userAuthenticator(options?: Partial<AuthOptions>) {
    return (req: express.Request, _res: express.Response, next: express.NextFunction): void => {
        const header    = req.headers.authorization;
        const hasToken  = Boolean(header?.startsWith('Bearer '));
        const anonymous = Boolean(options?.AllowAnonymous);

        if (!hasToken) {
            //No token: fine on an anonymous route, fatal otherwise.
            if (anonymous) return next();
            return next(new ApiError('Missing bearer token', HttpStatusCodes.UNAUTHORIZED));
        }

        const token = header.slice('Bearer '.length).trim();
        try {
            const payload = jwt.verify(token, ConfigurationManager.getEnv('JWT_SECRET')) as RawPayload;
            if (payload.Type !== 'access') throw new Error('Not an access token');

            const currentUser: CurrentUser = {
                UserId   : payload.UserId,
                TenantId : payload.TenantId,
                BranchId : payload.BranchId,
                SessionId: payload.SessionId,
                Roles    : payload.Roles ?? [],
            };
            req.currentUser = currentUser;
            req.context     = options?.Context;

            const allowed = options?.AllowedRoles ?? [];
            if (allowed.length > 0) {
                const ok = currentUser.Roles.some((r) => allowed.includes(r));
                if (!ok) return next(new ApiError('Insufficient role', HttpStatusCodes.FORBIDDEN));
            }
            return next();
        } catch (e: any) {
            //A token that was OFFERED and is bad is always an error, even on an
            //anonymous route. Silently ignoring it would let an expired session
            //fall through and act as an anonymous caller — surprising, and it
            //hides the real problem from the client.
            return next(new ApiError('Invalid token', HttpStatusCodes.UNAUTHORIZED, { reason: e?.message }));
        }
    };
}
