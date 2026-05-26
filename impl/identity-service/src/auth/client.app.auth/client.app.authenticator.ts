import express from 'express';
import { ApiError } from '../../common/api.error';
import { HttpStatusCodes } from '../../common/http.status.codes';
import { Source } from '../../database/typeorm/typeorm.database.connector';
import { ClientApp } from '../../database/typeorm/models/client.app.model';

/////////////////////////////////////////////////////////////////////////
//  Inter-service authenticator: validates the `x-api-key` header against
//  the seeded client_apps table. Returns a no-op middleware when
//  `optional` is true so browser-facing routes are not blocked.
/////////////////////////////////////////////////////////////////////////

const HEADER = 'x-api-key';

export function clientAppAuthenticator(optional = false) {
    return async (req: express.Request, _res: express.Response, next: express.NextFunction): Promise<void> => {
        const apiKey = req.headers[HEADER] as string | undefined;
        if (!apiKey) {
            if (optional) return next();
            return next(new ApiError('Missing x-api-key', HttpStatusCodes.UNAUTHORIZED));
        }
        try {
            const client = await Source.getRepository(ClientApp).findOne({ where: { ApiKey: apiKey, IsActive: true } });
            if (!client) return next(new ApiError('Unknown client app key', HttpStatusCodes.UNAUTHORIZED));
            req.clientApp = client.ClientCode;
            return next();
        } catch (e: any) {
            return next(new ApiError('Client app auth error', HttpStatusCodes.UNAUTHORIZED, { reason: e?.message }));
        }
    };
}
