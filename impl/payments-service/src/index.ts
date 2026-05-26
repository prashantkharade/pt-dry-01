import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import Application from './app';
import { logger } from './logger/logger';

(async () => {
    const app = Application.instance();
    await app.start();
})();

const TERMINATION_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'];

TERMINATION_SIGNALS.forEach((terminationEvent) => {
    process.on(terminationEvent, (data) => {
        logger.info(`Received ${terminationEvent} signal`);
        if (data) {
            try { logger.error(JSON.stringify(data, null, 2)); } catch { logger.error(String(data)); }
        }
        process.exit(0);
    });
});
