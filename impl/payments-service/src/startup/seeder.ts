import { logger } from '../logger/logger';

export class Seeder {
    public static seed = async (): Promise<void> => {
        logger.info('Seeder: no seed data for payments-service');
    };
}
