import express from 'express';
import { register as registerNotificationRoutes } from '../api/notifications/notification.routes';
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
        registerNotificationRoutes(this._app);
        return true;
    };
}
