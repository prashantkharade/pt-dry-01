import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../api-error';
import { ResponseHandler } from '../response';
import { Logger } from '../logger';

export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      Logger.warn('api.error', { code: err.httpCode, message: err.message, details: err.details });
      return ResponseHandler.failure(res, err.message, err.httpCode, err.details);
    }
    const e = err as Error & { code?: string };
    Logger.error('unhandled.error', { name: e?.name, message: e?.message, stack: e?.stack });
    return ResponseHandler.failure(res, 'Internal server error', 500);
  };
}
