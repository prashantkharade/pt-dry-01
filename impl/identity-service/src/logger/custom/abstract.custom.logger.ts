import fs from 'fs';
import { AbstractLogger } from '../abstract.logger';

/////////////////////////////////////////////////////////////////////////
//  Base for the hand-rolled (chalk) loggers. Renders coloured lines to
//  the console and keeps a plain-text append stream to logs/debug.log so
//  a file copy is always available even in development.
/////////////////////////////////////////////////////////////////////////

export abstract class AbstractCustomLogger extends AbstractLogger {

    protected _useConsole = true;

    protected _stream = fs.createWriteStream(this._logFile, {
        flags    : 'a',
        encoding : 'utf8',
        mode     : 0o666,
    });

    constructor() {
        super();
    }

}
