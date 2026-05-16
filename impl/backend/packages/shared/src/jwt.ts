import jwt, { type SignOptions } from 'jsonwebtoken';
import { ConfigurationManager } from './config';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  branchId?: string;
  sessionId: string;
  roles: string[];
  type: 'access' | 'refresh';
}

const secret = () => ConfigurationManager.get('JWT_SECRET');
const accessTtl = () => ConfigurationManager.getNumber('JWT_ACCESS_TTL_SEC', 3600);
const refreshTtl = () => ConfigurationManager.getNumber('JWT_REFRESH_TTL_SEC', 2592000);

export const Jwt = {
  signAccess(payload: Omit<JwtPayload, 'type'>): string {
    const opts: SignOptions = { expiresIn: accessTtl() };
    return jwt.sign({ ...payload, type: 'access' }, secret(), opts);
  },

  signRefresh(payload: Omit<JwtPayload, 'type'>): string {
    const opts: SignOptions = { expiresIn: refreshTtl() };
    return jwt.sign({ ...payload, type: 'refresh' }, secret(), opts);
  },

  verify(token: string): JwtPayload {
    return jwt.verify(token, secret()) as JwtPayload;
  },
};
