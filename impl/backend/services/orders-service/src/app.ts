import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { contextSetter, errorHandler, Logger, ConfigurationManager } from '@ptk/shared';
import { dataSource } from './database/data-source';
import { router } from './api/router';
import { seed } from './startup/seeder';

const SERVICE = 'orders-service';

export class Application {
  private static _instance: Application;
  private app = express();

  static instance() {
    if (!this._instance) this._instance = new Application();
    return this._instance;
  }

  async start() {
    Logger.info('orders-service: starting');
    await dataSource.initialize();
    Logger.info('orders-service: database connected');
    await seed();
    Logger.info('orders-service: seed complete');

    this.app.use(helmet());
    this.app.use(cors({ origin: true, credentials: true }));
    this.app.use(express.json({ limit: '2mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(contextSetter(SERVICE));

    this.app.get('/health', (_req, res) => res.json({ ok: true, service: SERVICE }));
    this.app.use('/', router);
    this.app.use(errorHandler());

    const port = ConfigurationManager.getNumber('ORDERS_PORT', 4002);
    this.app.listen(port, () => Logger.info(`orders-service listening on ${port}`));

    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }

  private async shutdown(signal: string) {
    Logger.info(`orders-service: ${signal} received`);
    await dataSource.destroy().catch(() => undefined);
    process.exit(0);
  }
}
