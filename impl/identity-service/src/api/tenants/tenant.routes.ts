import express from 'express';
import { TenantController } from './tenant.controller';
import { TenantAuth } from './tenant.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new TenantController();

    router.get('/current' , ...context(TenantAuth.getCurrent)   , controller.getCurrent);
    router.get('/branches', ...context(TenantAuth.listBranches) , controller.listBranches);

    app.use('/api/v1/tenants', router);
};
