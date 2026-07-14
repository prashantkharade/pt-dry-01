import { ILogger } from './logger.interface';
import { LOG_PROVIDER, IS_PRODUCTION, IS_TEST } from './logger.env';
import { CustomDebugLogger } from './custom/custom.debug.logger';
import { CustomProdLogger } from './custom/custom.prod.logger';
import { WinstonDebugLogger } from './winston/winston.debug.logger';
import { WinstonProdLogger } from './winston/winston.prod.logger';

/////////////////////////////////////////////////////////////////////////
//  Logger facade. Selects a provider (Custom | Winston) from configuration
//  and exposes a tiny static surface — info / warn / error / debug — so
//  application code never touches the underlying logging library.
//
//  Provider is chosen from `Logger.Provider` in config.json (env override:
//  LOGGER_PROVIDER). The debug/prod variant is chosen from NODE_ENV.
/////////////////////////////////////////////////////////////////////////

class Logger {

    static getLogger = (): ILogger => {
        let logger_: ILogger;

        switch (LOG_PROVIDER) {
            case 'Winston':
                logger_ = IS_PRODUCTION ? new WinstonProdLogger() : new WinstonDebugLogger();
                break;
            case 'Custom':
            default:
                logger_ = IS_PRODUCTION ? new CustomProdLogger() : new CustomDebugLogger();
                break;
        }
        return logger_;
    };

    private static _logger: ILogger = this.getLogger();

    static info = (str: string) => {
        if (IS_TEST) { return; }
        this._logger?.info(str);
    };

    static error = (str: string) => {
        if (IS_TEST) { return; }
        this._logger?.error(str);
    };

    static warn = (str: string) => {
        if (IS_TEST) { return; }
        this._logger?.warn(str);
    };

    static debug = (str: string) => {
        if (IS_TEST) { return; }
        this._logger?.debug(str);
    };

}

export { Logger as logger };
