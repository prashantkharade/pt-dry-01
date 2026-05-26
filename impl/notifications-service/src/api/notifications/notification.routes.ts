import express from 'express';
import { NotificationController } from './notification.controller';
import { NotificationAuth } from './notification.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new NotificationController();

    router.post('/send', ...context(NotificationAuth.send), controller.send);

    app.use('/api/v1/notifications', router);
};
