import crypto from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { redis } from '../../../common/cache/redis.cache';
import { ConfigurationManager } from '../../../config/configuration.manager';
import { logger } from '../../../logger/logger';
import { ErrorHandler } from '../../../common/api.error';
import { NotificationsServiceConnector } from '../../../modules/notifications/notifications.service.connector';

/////////////////////////////////////////////////////////////////////////
//  OTP login.
//
//  The code lives in a TTL-backed Redis key with a separate attempts
//  counter, and is DELIVERED by SMS through notifications-service.
//
//  Two things that were wrong before and are fixed here:
//    - The code was generated with Math.random(). That is not a CSPRNG; its
//      output is predictable enough that an attacker who sees a few codes can
//      narrow the next. A login OTP is a security token — it uses crypto.
//    - Nothing ever SENT the code. In production DevOtp was undefined, so the
//      OTP was created, logged, and unreachable — login was impossible.
/////////////////////////////////////////////////////////////////////////

const MAX_ATTEMPTS = 3;

const key         = (phone: string) => `otp:login:${phone}`;
const attemptsKey = (phone: string) => `otp:login:${phone}:attempts`;

@injectable()
export class OtpService {

    constructor(
        @inject(NotificationsServiceConnector) private _notify: NotificationsServiceConnector,
    ) {}

    /**
     * Six digits from a CSPRNG, uniformly distributed.
     *
     * `randomInt` is rejection-sampled, so there is no modulo bias — every
     * code from 000000 to 999999 is equally likely. Leading zeros are kept.
     */
    private generate = (): string => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

    public send = async (phone: string, tenantId?: string, language: 'en' | 'mr' = 'en'): Promise<{ DevOtp?: string }> => {
        const otp = this.generate();
        const minutes = ConfigurationManager.Auth.OtpValidityInMinutes;
        await redis().set(key(phone), otp, minutes * 60);
        await redis().del(attemptsKey(phone));

        //Deliver it. In production this is the only way the code reaches the
        //user, so a failure to hand it to notifications-service must surface —
        //otherwise the customer waits for an SMS that will never come.
        const delivered = tenantId
            ? await this._notify.sendOtp(tenantId, phone, otp, minutes, language)
            : false;

        if (process.env.NODE_ENV === 'production' && !delivered) {
            //Don't pretend it worked. The auth controller turns this into a
            //"couldn't send your code" the user can act on.
            ErrorHandler.throwUnprocessableError('Could not send the verification code. Please try again.');
        }

        //Never log the code itself.
        logger.info(`otp.sent phone=${phone} delivered=${delivered}`);
        return {
            //Dev-only convenience so the app can be exercised without a gateway.
            //Undefined in production — the code only exists on the user's phone.
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
