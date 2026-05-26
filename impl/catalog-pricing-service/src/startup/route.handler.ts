import express from 'express';
import { register as registerCatalogRoutes }  from '../api/catalog/catalog.routes';
import { register as registerRateCardRoutes } from '../api/rate.cards/rate.card.routes';
import { register as registerPricingRoutes }  from '../api/pricing/pricing.routes';
import { ConfigurationManager } from '../config/configuration.manager';

export class Router {

    private _app: express.Application = null;

    constructor(app: express.Application) { this._app = app; }

    public init = async (): Promise<boolean> => {
        this._app.get('/api/v1/', (_req, res) => {
            res.json({
                Service    : ConfigurationManager.ServiceName,
                ApiVersion : ConfigurationManager.ApiVersion,
                Message    : `${ConfigurationManager.ServiceName} [${process.env.NODE_ENV ?? 'development'}]`,
                Timestamp  : new Date().toISOString(),
            });
        });
        registerCatalogRoutes(this._app);
        registerRateCardRoutes(this._app);
        registerPricingRoutes(this._app);
        return true;
    };
}
