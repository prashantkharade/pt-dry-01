import { ApiError, Logger } from '@ptk/shared';
import { redis } from './redis';

const TTL_SEC = 5 * 60;
const MAX_ATTEMPTS = 3;

const key = (phone: string) => `otp:login:${phone}`;
const attemptsKey = (phone: string) => `otp:login:${phone}:attempts`;

export const OtpService = {
  async send(phone: string): Promise<{ devOtp?: string }> {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await redis().set(key(phone), otp, 'EX', TTL_SEC);
    await redis().del(attemptsKey(phone));
    // In dev we return the OTP so the user can test without an SMS gateway.
    Logger.info('otp.sent', { phone, dev: true });
    return { devOtp: process.env.NODE_ENV === 'production' ? undefined : otp };
  },

  async verify(phone: string, code: string): Promise<boolean> {
    const attempts = Number((await redis().get(attemptsKey(phone))) ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      throw ApiError.unprocessable('Too many incorrect attempts; request a new OTP');
    }
    const stored = await redis().get(key(phone));
    if (!stored) throw ApiError.badRequest('OTP expired or not sent');
    if (stored !== code) {
      await redis().incr(attemptsKey(phone));
      await redis().expire(attemptsKey(phone), TTL_SEC);
      throw ApiError.badRequest('Incorrect OTP');
    }
    await redis().del(key(phone), attemptsKey(phone));
    return true;
  },
};
