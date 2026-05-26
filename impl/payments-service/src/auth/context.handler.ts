import express from 'express';
import { userAuthenticator } from './user.auth/user.authenticator';
import { AuthOptions } from '../domain.types/enums/auth.enums';

export const context = (options: AuthOptions): express.RequestHandler[] => {
    return [userAuthenticator(options)];
};
