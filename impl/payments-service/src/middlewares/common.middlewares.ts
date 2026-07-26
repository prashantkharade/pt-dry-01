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

        //Webhook HMACs are computed over the exact bytes the provider sent.
        //express.json() parses and discards that buffer, and re-serializing
        //req.body will not reproduce it (key order, whitespace and unicode
        //escaping all differ), so the signature would never match. Capture it
        //here — `verify` is the only hook that sees the raw bytes.
        //
        //Kept narrow on purpose: retaining a 50mb buffer on every request just
        //to serve two webhook routes is pure memory waste.
        app.use(express.json({
            limit  : '50mb',
            verify : (req: express.Request, _res, buf: Buffer) => {
                if (req.path.startsWith('/api/v1/webhooks/')) {
                    req.rawBody = buf;
                }
            },
        }));
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
                    Service   : 'payments-service',
                    Timestamp : new Date().toISOString(),
                    Uptime    : process.uptime(),
                },
            });
        });
    };
}
