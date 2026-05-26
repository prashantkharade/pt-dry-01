import express from 'express';
import { WebhookController } from './webhook.controller';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new WebhookController();

    // Webhooks must not require a JWT — payment providers POST directly.
    router.post('/razorpay', controller.razorpay);
    router.post('/zohopay' , controller.zohopay);

    app.use('/api/v1/webhooks', router);
};
