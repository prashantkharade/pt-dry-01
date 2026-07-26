import express from 'express';
import { ReceiptController } from './receipt.controller';
import { OrderAuth } from '../orders/order.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new ReceiptController();

    //  Public FIRST: '/public/:orderId.pdf' would otherwise be captured by
    //  '/:orderId.pdf' and demand a session that a WhatsApp link cannot have.
    //
    //  No auth chain at all here — not even client-app auth. The recipient
    //  opens this from a chat app that sends no headers; the signed token in
    //  the query string is the entire authority, and it is HMAC'd and expiring.
    router.get('/public/:orderId', controller.publicDownload);

    router.get('/:orderId', ...context(OrderAuth.receipt), controller.download);

    app.use('/api/v1/receipts', router);
};
