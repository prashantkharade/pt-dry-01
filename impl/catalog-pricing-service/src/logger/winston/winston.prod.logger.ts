import winston from 'winston';
import { AbstractWinstonLogger } from './abstract.winston.logger';

/////////////////////////////////////////////////////////////////////////
//  Production Winston logger: structured JSON written to the daily-rotated
//  file (plus a JSON console line so log shippers can pick it up).
/////////////////////////////////////////////////////////////////////////

export class WinstonProdLogger extends AbstractWinstonLogger {

    constructor() {
        super();

        this._logger = winston.createLogger({
            levels : this._logLevels,
            level  : 'info',
            format : winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.json(),
            ),
            transports : [
                new winston.transports.Console({ handleExceptions: true }),
                this._dailyRotateFile,
            ],
        });
    }

    info = (str: string) => { this._logger?.info(str); };

    error = (str: string) => { this._logger?.error(str); };

    warn = (str: string) => { this._logger?.warn(str); };

    debug = (str: string) => { this._logger?.debug(str); };

}
