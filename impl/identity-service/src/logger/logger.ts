import * as winston from 'winston';
import 'winston-daily-rotate-file';

/////////////////////////////////////////////////////////////////////////
//  Logger — a thin facade over Winston with a console transport in dev
//  and rotating files in production. Keep the surface tiny (info / warn /
//  error / debug) so callers don't depend on the underlying library.
/////////////////////////////////////////////////////////////////////////

const consoleFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
});

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            consoleFormat,
        ),
    }),
];

if (process.env.NODE_ENV === 'production') {
    transports.push(
        new (winston.transports as any).DailyRotateFile({
            filename     : './logs/identity-service-%DATE%.log',
            datePattern  : 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize      : '20m',
            maxFiles     : '14d',
            format       : winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.json(),
            ),
        }),
    );
}

const _logger = winston.createLogger({
    level: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
    transports,
});

export const logger = {
    info : (message: string) => { if (process.env.NODE_ENV !== 'test') _logger.info(message); },
    warn : (message: string) => { if (process.env.NODE_ENV !== 'test') _logger.warn(message); },
    error: (message: string) => { if (process.env.NODE_ENV !== 'test') _logger.error(message); },
    debug: (message: string) => { if (process.env.NODE_ENV !== 'test') _logger.debug(message); },
};
