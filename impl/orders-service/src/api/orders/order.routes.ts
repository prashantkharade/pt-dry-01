import express from 'express';
import { OrderController } from './order.controller';
import { OrderAuth } from './order.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new OrderController();

    router.post  ('/'             , ...context(OrderAuth.create)        , controller.create);
    router.get   ('/'             , ...context(OrderAuth.search)        , controller.search);
    router.get   ('/mine'         , ...context(OrderAuth.listMine)      , controller.listMine);
    router.get   ('/:id'          , ...context(OrderAuth.getById)       , controller.getById);
    router.patch ('/:id/status'   , ...context(OrderAuth.updateStatus)  , controller.updateStatus);

    app.use('/api/v1/orders', router);
};
