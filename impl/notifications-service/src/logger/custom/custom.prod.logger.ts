/* eslint-disable no-console */
import chalk from 'chalk';
import { AbstractCustomLogger } from './abstract.custom.logger';
import { SERVICE_NAME } from '../logger.env';

/////////////////////////////////////////////////////////////////////////
//  Production variant of the custom logger. Same coloured console layout
//  (handy when tailing container logs) but debug lines are suppressed and
//  every event is mirrored to the append file for retention.
/////////////////////////////////////////////////////////////////////////

export class CustomProdLogger extends AbstractCustomLogger {

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

    debug = (_str: string) => {
        // Debug output is intentionally silenced in production.
    };

    private _write = (level: string, str: string) => {
        const dateTime = new Date().toISOString();
        this._stream.write(`[${dateTime}] [${SERVICE_NAME}]  ${level}  ${str}\n`);
    };

}
