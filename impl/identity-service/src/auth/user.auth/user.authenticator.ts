import express from 'express';
import { container } from 'tsyringe';
import { JwtService } from '../../database/typeorm/services/jwt.service';
import { ApiError } from '../../common/api.error';
import { HttpStatusCodes } from '../../common/http.status.codes';
import { AuthOptions } from '../../domain.types/enums/auth.enums';
import { CurrentUser } from '../../domain.types/miscellaneous/current.user';

/////////////////////////////////////////////////////////////////////////
//  Express middleware factory that verifies the bearer token and gates
//  the route on the AuthOptions passed by the routes file.
/////////////////////////////////////////////////////////////////////////

export function userAuthenticator(options?: Partial<AuthOptions>) {
    return (req: express.Request, _res: express.Response, next: express.NextFunction): void => {
        if (options?.AllowAnonymous) return next();

        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return next(new ApiError('Missing bearer token', HttpStatusCodes.UNAUTHORIZED));
        }
        const token = header.slice('Bearer '.length).trim();
        try {
            const jwtService = container.resolve(JwtService);
            const payload    = jwtService.verify(token);
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
            return next(new ApiError('Invalid token', HttpStatusCodes.UNAUTHORIZED, { reason: e?.message }));
        }
    };
}
