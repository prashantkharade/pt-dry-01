import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { LoggerContext, Logger } from '../logger';

const HEADER = 'x-correlation-id';

export function contextSetter(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = (req.headers[HEADER] as string | undefined) ?? randomUUID();
    req.correlationId = incoming;
    res.setHeader(HEADER, incoming);

    LoggerContext.run({ correlationId: incoming, service: serviceName }, () => {
      const started = Date.now();
      Logger.info('request.start', { method: req.method, path: req.path });
      res.on('finish', () => {
        Logger.info('request.end', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
        });
      });
      next();
    });
  };
}
