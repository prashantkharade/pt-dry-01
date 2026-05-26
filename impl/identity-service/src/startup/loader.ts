import { logger } from '../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Loader — invoked after DI + DB are up. Acts as the place for any
//  initial cache warming or feature-flag fetch we need before traffic.
/////////////////////////////////////////////////////////////////////////

export class Loader {

    public static init = async (): Promise<boolean> => {
        logger.info('Loader: warm-up complete');
        return true;
    };
}
