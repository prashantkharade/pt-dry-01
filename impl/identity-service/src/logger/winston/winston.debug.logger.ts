import winston from 'winston';
import { AbstractWinstonLogger } from './abstract.winston.logger';
import { SERVICE_NAME, LOG_LEVEL } from '../logger.env';

/////////////////////////////////////////////////////////////////////////
//  Development Winston logger: colourised console output tagged with the
//  environment and service name.
//    23-07-10 14:22:07 [development-identity-service] info : ...
/////////////////////////////////////////////////////////////////////////

export class WinstonDebugLogger extends AbstractWinstonLogger {

    constructor() {
        super();

        const format = winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.label({ label: `[${process.env.NODE_ENV ?? 'development'}-${SERVICE_NAME}]` }),
            winston.format.timestamp({ format: 'YY-MM-DD HH:mm:ss' }),
            winston.format.printf((x) => `${x.timestamp} ${x.label} ${x.level} : ${x.message}`),
        );

        winston.addColors({
            info  : 'blue',
            warn  : 'yellow',
            error : 'bold red',
            debug : 'green',
        });

        this._logger = winston.createLogger({
            levels     : this._logLevels,
            level      : LOG_LEVEL === 'information' ? 'info' : (LOG_LEVEL || 'debug'),
            transports : [
                new winston.transports.Console({ handleExceptions: true, format }),
            ],
        });
    }

    info = (str: string) => { this._logger?.info(str); };

    error = (str: string) => { this._logger?.error(str); };

    warn = (str: string) => { this._logger?.warn(str); };

    debug = (str: string) => { this._logger?.debug(str); };

}
