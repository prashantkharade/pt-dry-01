import express from 'express';
import { CatalogController } from './catalog.controller';
import { CatalogAuth } from './catalog.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new CatalogController();

    router.get('/service-types' , ...context(CatalogAuth.listServiceTypes), controller.listServiceTypes);
    router.get('/categories'    , ...context(CatalogAuth.listCategories)  , controller.listCategories);
    router.get('/items'         , ...context(CatalogAuth.listItems)       , controller.listItems);
    router.get('/items/:id'     , ...context(CatalogAuth.getItem)         , controller.getItem);

    app.use('/api/v1/catalog', router);
};
