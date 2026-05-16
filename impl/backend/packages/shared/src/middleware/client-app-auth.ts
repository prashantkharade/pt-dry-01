import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../api-error';

const HEADER = 'x-api-key';

/**
 * Inter-service guard. Accepts only requests whose `x-api-key` matches one of
 * the keys provided. When `optional` is true, unknown/missing keys are ignored
 * (used on routes that browsers also call).
 */
export function clientAppAuth(allowedKeys: string[], optional = true) {
  const allow = new Set(allowedKeys.filter(Boolean));
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.headers[HEADER] as string | undefined;
    if (!key) {
      if (optional) return next();
      return next(ApiError.unauthorized('Missing x-api-key'));
    }
    if (!allow.has(key)) {
      return next(ApiError.unauthorized('Unknown client app key'));
    }
    req.clientApp = key;
    next();
  };
}
