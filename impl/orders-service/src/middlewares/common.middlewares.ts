import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { randomUUID } from 'node:crypto';
import { HttpLogger } from '../logger/http.logger';

const CORRELATION_HEADER = 'x-correlation-id';

export class CommonMiddlewares {

    public static setup = async (app: express.Application): Promise<void> => {
        app.use(express.urlencoded({ limit: '50mb', extended: true }));
        app.use(express.json({ limit: '50mb' }));
        app.use((helmet as any)());
        app.use((cors as any)({ origin: true, credentials: true }));
        app.use((compression as any)());

        //Assign a correlation-id to every request so all its log lines can be joined.
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const incoming = (req.headers[CORRELATION_HEADER] as string) ?? randomUUID();
            req.correlationId = incoming;
            res.setHeader(CORRELATION_HEADER, incoming);
            next();
        });

        //Structured, coloured request logging.
        HttpLogger.use(app);

        app.get('/health-check', (_req, res) => {
            res.status(200).json({
                Status   : 'success',
                HttpCode : 200,
                Message  : 'OK',
                Data     : {
                    Service   : 'orders-service',
                    Timestamp : new Date().toISOString(),
                    Uptime    : process.uptime(),
                },
            });
        });
    };
}
