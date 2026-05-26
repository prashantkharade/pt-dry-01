import { logger } from '../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Domain event initializer. Placeholder for future RabbitMQ / SNS /
//  Kafka wiring — register handlers here.
/////////////////////////////////////////////////////////////////////////

export class EventInitializer {

    public static initialize = async (): Promise<void> => {
        logger.info('EventInitializer: no event subscriptions registered');
    };
}
