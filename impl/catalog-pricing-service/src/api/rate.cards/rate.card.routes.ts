import express from 'express';
import { RateCardController } from './rate.card.controller';
import { RateCardAuth } from './rate.card.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new RateCardController();

    router.get ('/' , ...context(RateCardAuth.list)  , controller.list);
    router.post('/' , ...context(RateCardAuth.create), controller.create);

    app.use('/api/v1/rate-cards', router);
};
