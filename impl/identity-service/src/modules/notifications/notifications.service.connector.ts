import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Client for notifications-service.
//
//  identity-service uses this for exactly one thing that MUST work in
//  production: sending the login OTP over SMS. Everything else the platform
//  notifies about is triggered from orders/payments.
//
//  Unlike those, the OTP send is NOT purely fire-and-forget. A customer who
//  never receives their code cannot log in, so `sendOtp` reports whether the
//  hand-off to notifications-service succeeded — the auth flow decides what
//  to do with that (see AuthService.otpSend).
/////////////////////////////////////////////////////////////////////////

@injectable()
export class NotificationsServiceConnector {

    private baseUrl(): string {
        return ConfigurationManager.getEnv('NOTIFICATIONS_SERVICE_URL', 'http://localhost:4005');
    }

    private headers(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'x-api-key': ConfigurationManager.getEnv('API_KEY_IDENTITY_SERVICE', 'identity-service-dev-key'),
        };
    }

    /**
     * Send a login OTP by SMS.
     *
     * Returns true when notifications-service accepted the request for
     * delivery — not that the SMS has landed (it is queued and retried
     * downstream). Returns false on any failure so the caller can decide
     * whether to surface "we couldn't send your code, try again".
     */
    public sendOtp = async (tenantId: string, phone: string, otp: string, minutes: number, language: 'en' | 'mr' = 'en'): Promise<boolean> => {
        try {
            await axios.post(`${this.baseUrl()}/api/v1/notifications/send-template`, {
                TemplateCode : 'OTP_LOGIN',
                Channel      : 'SMS',
                Recipient    : phone,
                Language     : language,
                TenantId     : tenantId,
                Variables    : { Otp: otp, Minutes: minutes },
            }, { headers: this.headers(), timeout: 5000 });
            return true;
        } catch (error: any) {
            //Never log the OTP. Log that a send failed and why, not the code.
            logger.error(`OTP send failed for ${phone}: ${error?.response?.status ?? ''} ${error?.response?.data?.Message ?? error?.message}`);
            return false;
        }
    };
}
