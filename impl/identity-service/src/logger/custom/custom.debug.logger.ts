/* eslint-disable no-console */
import chalk from 'chalk';
import { AbstractCustomLogger } from './abstract.custom.logger';
import { SERVICE_NAME } from '../logger.env';

/////////////////////////////////////////////////////////////////////////
//  Development logger: colourful, human-readable, single line per event.
//  Layout:  [timestamp] [service]  LEVEL   message
/////////////////////////////////////////////////////////////////////////

export class CustomDebugLogger extends AbstractCustomLogger {

    constructor() {
        super();
    }

    private _tag = () => {
        const dateTime = new Date().toISOString();
        return chalk.hex('#AEADED')(`[${dateTime}] `) + chalk.hex('#6C7086')(`[${SERVICE_NAME}] `);
    };

    info = (str: string) => {
        if (this._useConsole) {
            console.log(this._tag() + chalk.bold.bgCyanBright.black(' INFO ') + ' ' + chalk.green(str));
        }
        this._write('INFO', str);
    };

    error = (str: string) => {
        if (this._useConsole) {
            console.log(this._tag() + chalk.bold.bgRedBright.white(' ERROR ') + ' ' + chalk.redBright(str));
        }
        this._write('ERROR', str);
    };

    warn = (str: string) => {
        if (this._useConsole) {
            console.log(this._tag() + chalk.bold.bgYellowBright.black(' WARN ') + ' ' + chalk.yellow(str));
        }
        this._write('WARN', str);
    };

    debug = (str: string) => {
        if (this._useConsole) {
            console.log(this._tag() + chalk.bold.bgBlueBright.white(' DEBUG ') + ' ' + chalk.gray(str));
        }
        this._write('DEBUG', str);
    };

    private _write = (level: string, str: string) => {
        const dateTime = new Date().toISOString();
        this._stream.write(`[${dateTime}] [${SERVICE_NAME}]  ${level}  ${str}\n`);
    };

}
