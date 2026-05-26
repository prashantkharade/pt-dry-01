import express from 'express';
import { userAuthenticator } from './user.auth/user.authenticator';
import { AuthOptions } from '../domain.types/enums/auth.enums';

/////////////////////////////////////////////////////////////////////////
//  context(opts) — used at route definition sites: it composes the
//  authenticator and stashes the AuthOptions on req.context so downstream
//  middleware (audit, response handler) can introspect it.
/////////////////////////////////////////////////////////////////////////

export const context = (options: AuthOptions): express.RequestHandler[] => {
    return [userAuthenticator(options)];
};
