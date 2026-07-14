import path from 'path';
import fs from 'fs';
import { ILogger } from './logger.interface';

/////////////////////////////////////////////////////////////////////////
//  Shared base for every logger provider: owns the on-disk log folder,
//  the ordered log levels, and the common contract. Concrete providers
//  (Custom, Winston, …) extend this and decide how a line is rendered.
/////////////////////////////////////////////////////////////////////////

export abstract class AbstractLogger implements ILogger {

    //#region Privates

    protected _folder: string = path.join(process.cwd(), 'logs');

    protected _logFileName = 'debug.log';

    protected _logFile: string = path.join(this._folder, this._logFileName);

    protected _logger: any = null;

    protected _logLevels = {
        fatal : 0,
        error : 1,
        warn  : 2,
        info  : 3,
        debug : 4,
        trace : 5,
    };

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
