import path from 'path';
import fs from 'fs';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ILogger } from '../logger.interface';
import { SERVICE_NAME } from '../logger.env';

/////////////////////////////////////////////////////////////////////////
//  Base for the Winston-backed loggers. Owns the log folder and a shared
//  daily-rotating file transport used by the production variant.
/////////////////////////////////////////////////////////////////////////

export abstract class AbstractWinstonLogger implements ILogger {

    //#region Privates

    protected _folder: string = path.join(process.cwd(), 'logs');

    protected _logger: winston.Logger = null;

    protected _logLevels = {
        fatal : 0,
        error : 1,
        warn  : 2,
        info  : 3,
        debug : 4,
        trace : 5,
    };

    protected _dailyRotateFile: DailyRotateFile = new DailyRotateFile({
        filename      : path.join(this._folder, `${SERVICE_NAME}-%DATE%.log`),
        datePattern   : 'YYYY-MM-DD',
        zippedArchive : true,
        maxSize       : '20m',
        maxFiles      : '14d',
        dirname       : this._folder,
        format        : winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json(),
        ),
    });

    //#endregion

    constructor() {
        if (!fs.existsSync(this._folder)) {
            fs.mkdirSync(this._folder, { recursive: true });
        }
    }

    abstract info(str: string): void;

    abstract error(str: string): void;

    abstract warn(str: string): void;

    abstract debug(str: string): void;

}
