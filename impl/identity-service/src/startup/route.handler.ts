import express from 'express';
import { register as registerAuthRoutes }     from '../api/auth/auth.routes';
import { register as registerUserRoutes }     from '../api/users/user.routes';
import { register as registerCustomerRoutes } from '../api/customers/customer.routes';
import { register as registerTenantRoutes }   from '../api/tenants/tenant.routes';
import { ConfigurationManager } from '../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Central router. The route.handler is the only place that knows about
//  every domain — each domain exposes a register(app) function.
/////////////////////////////////////////////////////////////////////////

export class Router {

    private _app: express.Application = null;

    constructor(app: express.Application) {
        this._app = app;
    }

    public init = async (): Promise<boolean> => {
        this._app.get('/api/v1/', (_req, res) => {
            res.json({
                Service     : ConfigurationManager.ServiceName,
                ApiVersion  : ConfigurationManager.ApiVersion,
                Message     : `${ConfigurationManager.ServiceName} [${process.env.NODE_ENV ?? 'development'}]`,
                Timestamp   : new Date().toISOString(),
            });
        });

        registerAuthRoutes(this._app);
        registerUserRoutes(this._app);
        registerCustomerRoutes(this._app);
        registerTenantRoutes(this._app);

        return true;
    };
}
