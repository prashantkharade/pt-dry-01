import express from 'express';
import { DeviceController } from './device.controller';
import { DeviceAuth } from './device.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new DeviceController();

    //  Internal routes first — '/push-targets' and '/purge-token' must be
    //  registered before any '/:id' pattern or Express would capture them as ids.
    router.post  ('/push-targets', ...context(DeviceAuth.pushTargets), controller.pushTargets);
    router.post  ('/purge-token' , ...context(DeviceAuth.purgeToken) , controller.purgeToken);

    router.post  ('/'            , ...context(DeviceAuth.register)   , controller.register);
    router.get   ('/'            , ...context(DeviceAuth.listMine)   , controller.listMine);
    router.delete('/:id'         , ...context(DeviceAuth.revoke)     , controller.revoke);

    app.use('/api/v1/devices', router);
};
