import { logger } from '../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Cron scheduler. Today no jobs are registered for identity-service;
//  the class is wired up so adding (e.g.) "purge revoked sessions" is a
//  one-liner inside schedule().
/////////////////////////////////////////////////////////////////////////

export class Scheduler {

    private static _instance: Scheduler = null;

    public static instance(): Scheduler {
        return this._instance || (this._instance = new Scheduler());
    }

    public schedule = async (): Promise<void> => {
        logger.info('Scheduler: no cron jobs registered for identity-service');
    };
}
