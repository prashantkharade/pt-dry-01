import { injectable } from 'tsyringe';
import { redis } from '../../../common/cache/redis.cache';
import { ConfigurationManager } from '../../../config/configuration.manager';
import { logger } from '../../../logger/logger';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  OTP service — TTL-backed Redis key per phone with a separate attempts
//  counter. In dev we return the OTP so the customer app can test
//  end-to-end without an SMS gateway.
/////////////////////////////////////////////////////////////////////////

const MAX_ATTEMPTS = 3;

const key         = (phone: string) => `otp:login:${phone}`;
const attemptsKey = (phone: string) => `otp:login:${phone}:attempts`;

@injectable()
export class OtpService {

    public send = async (phone: string): Promise<{ DevOtp?: string }> => {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const ttl = ConfigurationManager.Auth.OtpValidityInMinutes * 60;
        await redis().set(key(phone), otp, ttl);
        await redis().del(attemptsKey(phone));
        logger.info(`otp.sent phone=${phone} (dev)`);
        return {
            DevOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
        };
    };

    public verify = async (phone: string, code: string): Promise<boolean> => {
        const attempts = Number((await redis().get(attemptsKey(phone))) ?? 0);
        if (attempts >= MAX_ATTEMPTS) {
            ErrorHandler.throwUnprocessableError('Too many incorrect attempts; request a new OTP');
        }
        const stored = await redis().get(key(phone));
        if (!stored) ErrorHandler.throwInputValidationError(['OTP expired or not sent']);
        if (stored !== code) {
            const ttl = ConfigurationManager.Auth.OtpValidityInMinutes * 60;
            await redis().incr(attemptsKey(phone));
            await redis().expire(attemptsKey(phone), ttl);
            ErrorHandler.throwInputValidationError(['Incorrect OTP']);
        }
        await redis().del(key(phone), attemptsKey(phone));
        return true;
    };
}
