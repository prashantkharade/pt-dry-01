import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  contextSetter,
  errorHandler,
  Logger,
  ConfigurationManager,
} from '@ptk/shared';
import { dataSource } from './database/data-source';
import { router } from './api/router';
import { seed } from './startup/seeder';

const SERVICE = 'identity-service';

export class Application {
  private static _instance: Application;
  private app = express();

  static instance() {
    if (!this._instance) this._instance = new Application();
    return this._instance;
  }

  async start() {
    Logger.info('identity-service: starting');
    await dataSource.initialize();
    Logger.info('identity-service: database connected');
    await seed();
    Logger.info('identity-service: seed complete');

    this.app.use(helmet());
    this.app.use(cors({ origin: true, credentials: true }));
    this.app.use(express.json({ limit: '2mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(contextSetter(SERVICE));

    this.app.get('/health', (_req, res) => res.json({ ok: true, service: SERVICE }));
    this.app.use('/', router);
    this.app.use(errorHandler());

    const port = ConfigurationManager.getNumber('IDENTITY_PORT', 4001);
    this.app.listen(port, () => Logger.info(`identity-service listening on ${port}`));

    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }

  private async shutdown(signal: string) {
    Logger.info(`identity-service: ${signal} received, shutting down`);
    await dataSource.destroy().catch(() => undefined);
    process.exit(0);
  }
}
