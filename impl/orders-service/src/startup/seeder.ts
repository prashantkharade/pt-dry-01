import { logger } from '../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Orders has no static seed data — items, rate-cards and surcharges
//  belong to catalog-pricing-service. This hook stays in place so the
//  bootstrap shape matches every other service.
/////////////////////////////////////////////////////////////////////////

export class Seeder {
    public static seed = async (): Promise<void> => {
        logger.info('Seeder: no seed data for orders-service');
    };
}
