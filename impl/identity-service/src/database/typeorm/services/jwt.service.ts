import { injectable } from 'tsyringe';
import jwt from 'jsonwebtoken';
import { ConfigurationManager } from '../../../config/configuration.manager';
import { JwtPayload } from '../../../domain.types/auth/auth.types';

/////////////////////////////////////////////////////////////////////////
//  JWT issuance and verification. Two token types: 'access' (short-lived,
//  carries roles) and 'refresh' (long-lived, no roles).
/////////////////////////////////////////////////////////////////////////

@injectable()
export class JwtService {

    private secret(): string {
        return ConfigurationManager.getEnv('JWT_SECRET');
    }

    public signAccess = (payload: Omit<JwtPayload, 'Type'>): string => {
        const opts: jwt.SignOptions = { expiresIn: ConfigurationManager.Auth.AccessTokenExpiresInSeconds };
        return jwt.sign({ ...payload, Type: 'access' }, this.secret(), opts);
    };

    public signRefresh = (payload: Omit<JwtPayload, 'Type'>): string => {
        const opts: jwt.SignOptions = { expiresIn: ConfigurationManager.Auth.RefreshTokenExpiresInSeconds };
        return jwt.sign({ ...payload, Type: 'refresh' }, this.secret(), opts);
    };

    public verify = (token: string): JwtPayload => {
        return jwt.verify(token, this.secret()) as JwtPayload;
    };
}
