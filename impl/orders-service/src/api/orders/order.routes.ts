import express from 'express';
import { OrderController } from './order.controller';
import { OrderAuth } from './order.auth';
import { context } from '../../auth/context.handler';
import { EventsController } from '../events/events.controller';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new OrderController();
    const events     = new EventsController();

    router.post  ('/'             , ...context(OrderAuth.create)        , controller.create);
    router.get   ('/'             , ...context(OrderAuth.search)        , controller.search);
    router.get   ('/mine'         , ...context(OrderAuth.listMine)      , controller.listMine);
    //  Literal paths before '/:id', or Express captures them as an order id.
    router.get   ('/summary'      , ...context(OrderAuth.summary)       , controller.summary);
    //  Live stream (SSE). Staff see the tenant; customers see only their own.
    router.get   ('/stream'       , ...context(OrderAuth.stream)        , events.stream);
    router.get   ('/:id'          , ...context(OrderAuth.getById)       , controller.getById);
    router.get   ('/:id/tracking' , ...context(OrderAuth.tracking)      , controller.tracking);
    router.patch ('/:id/status'   , ...context(OrderAuth.updateStatus)  , controller.updateStatus);

    app.use('/api/v1/orders', router);
};
