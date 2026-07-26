import express from 'express';
import { clientAppAuthenticator } from './client.app.auth/client.app.authenticator';
import { userAuthenticator } from './user.auth/user.authenticator';
import { AuthOptions } from '../domain.types/enums/auth.enums';

/////////////////////////////////////////////////////////////////////////
//  The auth chain, in fixed order:
//
//    clientAppAuth (x-api-key)  ->  which app is calling
//    userAuthenticator (JWT)    ->  which user, and may they do this
//
//  Order matters: an unknown app is rejected before we do token or DB work.
//
//  Client-app auth applies even to AllowAnonymous routes — "no user" is not
//  "no client". Login is anonymous but still only reachable by our own apps.
/////////////////////////////////////////////////////////////////////////

export const context = (options: AuthOptions): express.RequestHandler[] => {
    return [
        clientAppAuthenticator(options),
        userAuthenticator(options),
    ];
};
