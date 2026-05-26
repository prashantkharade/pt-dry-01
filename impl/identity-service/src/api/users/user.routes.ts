import express from 'express';
import { UserController } from './user.controller';
import { UserAuth } from './user.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new UserController();

    router.get   ('/me'         , ...context(UserAuth.getMe)     , controller.getMe);
    router.patch ('/me'         , ...context(UserAuth.updateMe)  , controller.updateMe);
    router.get   ('/me/lookup'  , ...context(UserAuth.getLookup) , controller.getLookup);
    router.get   ('/search'     , ...context(UserAuth.search)    , controller.search);
    router.get   ('/:id'        , ...context(UserAuth.getById)   , controller.getById);

    app.use('/api/v1/users', router);
};
