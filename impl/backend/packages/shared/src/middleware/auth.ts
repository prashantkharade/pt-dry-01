import type { Request, Response, NextFunction } from 'express';
import { Jwt } from '../jwt';
import { ApiError } from '../api-error';
import { LoggerContext } from '../logger';

export interface AuthOptions {
  /** Permissions/roles allowed — if empty, only authentication is required. */
  roles?: string[];
  /** When false, attach user if token present but do not require it. */
  required?: boolean;
}

export function userAuthenticator(opts: AuthOptions = {}) {
  const required = opts.required !== false;
  const allowedRoles = opts.roles ?? [];

  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      if (!required) return next();
      return next(ApiError.unauthorized('Missing bearer token'));
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = Jwt.verify(token);
      if (payload.type !== 'access') throw new Error('not an access token');
      req.currentUser = {
        userId: payload.userId,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
        sessionId: payload.sessionId,
        roles: payload.roles ?? [],
      };
      // Propagate to logger context
      const ctx = LoggerContext.get();
      Object.assign(ctx, { userId: payload.userId, tenantId: payload.tenantId });

      if (allowedRoles.length > 0) {
        const ok = payload.roles?.some((r) => allowedRoles.includes(r));
        if (!ok) return next(ApiError.forbidden('Insufficient role'));
      }
      return next();
    } catch (e) {
      return next(ApiError.unauthorized('Invalid token'));
    }
  };
}
