import { logger } from '../logger/logger';

export class EventInitializer {
    public static initialize = async (): Promise<void> => {
        logger.info('EventInitializer: no event subscriptions registered');
    };
}
