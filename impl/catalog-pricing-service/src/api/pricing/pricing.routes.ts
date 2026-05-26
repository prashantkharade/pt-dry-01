import express from 'express';
import { PricingController } from './pricing.controller';
import { PricingAuth } from './pricing.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new PricingController();

    router.post('/quote'      , ...context(PricingAuth.quote)         , controller.quote);
    router.get ('/surcharges' , ...context(PricingAuth.listSurcharges), controller.listSurcharges);

    app.use('/api/v1/pricing', router);
};
