import express from 'express';
import { AuthController } from './auth.controller';
import { AuthAuth } from './auth.auth';
import { context } from '../../auth/context.handler';

/////////////////////////////////////////////////////////////////////////
//  /api/v1/auth/* routes
/////////////////////////////////////////////////////////////////////////

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new AuthController();

    router.post('/otp/send'  , ...context(AuthAuth.otpSend)      , controller.otpSend);
    router.post('/otp/verify', ...context(AuthAuth.otpVerify)    , controller.otpVerify);
    router.post('/login'     , ...context(AuthAuth.passwordLogin), controller.passwordLogin);
    router.post('/logout'    , ...context(AuthAuth.logout)       , controller.logout);

    app.use('/api/v1/auth', router);
};
