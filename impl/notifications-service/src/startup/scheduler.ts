import { logger } from '../logger/logger';

export class Scheduler {
    private static _instance: Scheduler = null;
    public static instance(): Scheduler { return this._instance || (this._instance = new Scheduler()); }
    public schedule = async (): Promise<void> => {
        logger.info('Scheduler: no cron jobs registered for notifications-service');
    };
}
