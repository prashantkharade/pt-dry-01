import 'reflect-metadata';
import express from 'express';
import { Injector } from './startup/injector';
import { Loader } from './startup/loader';
import { Router } from './startup/route.handler';
import { Seeder } from './startup/seeder';
import { Scheduler } from './startup/scheduler';
import { CommonMiddlewares } from './middlewares/common.middlewares';
import { DatabaseConnector } from './database/database.connector';
import { errorHandlerMiddleware } from './middlewares/error.handling.middleware';
import { EventInitializer } from './events/event.initializer';
import { logger } from './logger/logger';
import { ConfigurationManager } from './config/configuration.manager';

export default class Application {

    public _app: express.Application = null;

    private _router: Router = null;

    private static _instance: Application = null;

    private constructor() {
        this._app = express();
        this._router = new Router(this._app);
    }

    public static instance(): Application {
        return this._instance || (this._instance = new this());
    }

    public app(): express.Application { return this._app; }

    public start = async (): Promise<void> => {
        try {
            ConfigurationManager.loadConfigurations();
            Injector.registerInjections();
            await DatabaseConnector.setup();
            await Loader.init();
            await CommonMiddlewares.setup(this._app);
            await this._router.init();
            await Seeder.seed();
            if (process.env.NODE_ENV !== 'test') await Scheduler.instance().schedule();
            await EventInitializer.initialize();
            this._app.use(errorHandlerMiddleware);
            await this.listen();
        } catch (error: any) {
            logger.error('An error occurred while starting catalog-pricing-service. ' + error.message);
        }
    };

    private listen = () => {
        return new Promise((resolve, reject) => {
            try {
                const port = process.env.PORT || ConfigurationManager.Port;
                const server = this._app.listen(port, () => {
                    const serviceName = `catalog-pricing-service-[${process.env.NODE_ENV ?? 'development'}]`;
                    logger.info('-----------------------------------------------------------');
                    logger.info(`🚀 ${serviceName} is up and listening on port ${port}`);
                    logger.info(`✅ Health check: http://localhost:${port}/health-check`);
                    logger.info('-----------------------------------------------------------');
                    this._app.emit('server_started');
                });
                module.exports.server = server;
                resolve(this._app);
            } catch (error) {
                reject(error);
            }
        });
    };
}
