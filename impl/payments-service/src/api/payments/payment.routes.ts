import express from 'express';
import { PaymentController } from './payment.controller';
import { PaymentAuth } from './payment.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new PaymentController();

    router.post('/initiate'        , ...context(PaymentAuth.initiate)      , controller.initiate);
    router.post('/cash'            , ...context(PaymentAuth.markCash)      , controller.markCash);
    router.get ('/order/:orderId'  , ...context(PaymentAuth.listForOrder)  , controller.listForOrder);

    app.use('/api/v1/payments', router);
};
