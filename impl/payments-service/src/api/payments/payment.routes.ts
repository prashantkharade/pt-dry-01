import express from 'express';
import { PaymentController } from './payment.controller';
import { PaymentAuth } from './payment.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new PaymentController();

    //  --- Wallet. Registered before '/:id/...' so 'wallet' is never captured
    //  as a payment id.
    router.get ('/wallet/:customerId'            , ...context(PaymentAuth.walletRead) , controller.walletBalance);
    router.get ('/wallet/:customerId/history'    , ...context(PaymentAuth.walletRead) , controller.walletHistory);
    router.get ('/wallet/:customerId/reconcile'  , ...context(PaymentAuth.walletAdmin), controller.walletReconcile);
    router.post('/wallet/:customerId/top-up'     , ...context(PaymentAuth.walletWrite), controller.walletTopUp);
    router.put ('/wallet/:customerId/credit-limit', ...context(PaymentAuth.walletAdmin), controller.setCreditLimit);

    //  --- Payments
    router.post('/initiate'      , ...context(PaymentAuth.initiate)    , controller.initiate);
    router.post('/cash'          , ...context(PaymentAuth.markCash)    , controller.markCash);
    router.get ('/order/:orderId', ...context(PaymentAuth.listForOrder), controller.listForOrder);
    router.post('/:id/verify'    , ...context(PaymentAuth.verify)      , controller.verify);
    router.post('/:id/refund'    , ...context(PaymentAuth.refund)      , controller.refund);
    router.get ('/:id/refunds'   , ...context(PaymentAuth.readRefunds) , controller.listRefunds);

    app.use('/api/v1/payments', router);
};
