import { logger } from '../logger/logger';

export class Loader {
    public static init = async (): Promise<boolean> => {
        logger.info('Loader: warm-up complete');
        return true;
    };
}
