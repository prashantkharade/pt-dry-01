import express from 'express';
import { logger } from './logger';

/////////////////////////////////////////////////////////////////////////
//  Structured HTTP request logger. Emits a concise, coloured one-line
//  summary per request at info level, and the full structured record
//  (headers, params, query, body, identity, timing) at debug level so a
//  request can be reconstructed when troubleshooting.
/////////////////////////////////////////////////////////////////////////

const expressLoggerFunc = (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction) => {

    const start = Date.now();
    const ips = [request.header('x-forwarded-for') || request.socket.remoteAddress];

    response.on('finish', () => {
        const elapsed = Date.now() - start;
        const correlationId = (request as any).correlationId ?? null;

        //Concise, human-scannable summary line.
        logger.info(
            `${request.method} ${request.originalUrl} → ${response.statusCode} ` +
            `(${elapsed}ms)${correlationId ? ` [cid=${correlationId}]` : ''}`,
        );

        //Full structured record — only rendered when debug output is enabled.
        const detail = {
            correlationId : correlationId,
            method        : request.method,
            url           : request.originalUrl,
            params        : request.params,
            query         : request.query,
            client        : (request as any).currentClient ?? null,
            user          : (request as any).currentUser ?? null,
            context       : (request as any).context ?? null,
            statusCode    : response.statusCode,
            statusMessage : response.statusMessage,
            duration      : `${elapsed}ms`,
            requestBody   : request.body,
            ips           : request.ips && request.ips.length > 0 ? request.ips : ips,
            contentType   : response.get('content-type') ?? null,
        };
        logger.debug(`HTTP request detail ${JSON.stringify(detail)}`);
    });

    next();
};

export class HttpLogger {

    static use = (app: express.Application) => {
        app.use(expressLoggerFunc);
    };

}
