import { logger } from '../logger/logger';
import { OrderEvents } from '../events/order.events';

export class Loader {
    public static init = async (): Promise<boolean> => {
        //Live order events: Redis pub/sub so an SSE client held by one
        //instance still sees a status change that happened on another.
        OrderEvents.connect();
        logger.info('Loader: warm-up complete');
        return true;
    };
}
