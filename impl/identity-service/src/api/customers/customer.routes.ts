import express from 'express';
import { CustomerController } from './customer.controller';
import { CustomerAuth } from './customer.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new CustomerController();

    router.get   ('/'             , ...context(CustomerAuth.search)     , controller.search);
    router.post  ('/'             , ...context(CustomerAuth.create)     , controller.create);
    //  '/me' MUST be registered before '/:id' or Express captures "me" as an id.
    router.get   ('/me'           , ...context(CustomerAuth.getMine)    , controller.getMine);
    router.get   ('/:id'          , ...context(CustomerAuth.getById)    , controller.getById);
    router.put   ('/:id'          , ...context(CustomerAuth.update)     , controller.update);
    router.get   ('/:id/internal' , ...context(CustomerAuth.getInternal), controller.getInternal);

    app.use('/api/v1/customers', router);
};
