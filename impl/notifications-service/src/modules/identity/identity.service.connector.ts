import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Thin client for identity-service.
//
//  Push targets a USER, but FCM sends to a DEVICE. identity-service owns
//  the device registry, so this is the hop that turns "notify Asha" into
//  "send to these three tokens".
//
//  The endpoints used here are restricted to this service by ClientCode
//  (AllowedClients: ['NOTIFICATIONS-SERVICE']) — see device.auth.ts.
/////////////////////////////////////////////////////////////////////////

export interface PushTarget {
    UserId   : string;
    FcmToken : string;
    Platform : 'Android' | 'iOS' | 'Web';
}

@injectable()
export class IdentityServiceConnector {

    private baseUrl(): string {
        return ConfigurationManager.getEnv('IDENTITY_SERVICE_URL', 'http://localhost:4001');
    }

    private headers(): Record<string, string> {
        return {
            'x-api-key': ConfigurationManager.getEnv('API_KEY_NOTIFICATIONS_SERVICE', 'notifications-service-dev-key'),
        };
    }

    /**
     * Device tokens for a set of users.
     *
     * Returns [] rather than throwing when identity is unreachable: a push is
     * a best-effort courtesy, and failing the whole notification job because
     * the device lookup blipped would retry an SMS that already went out.
     */
    public pushTargetsFor = async (userIds: string[]): Promise<PushTarget[]> => {
        if (userIds.length === 0) return [];
        try {
            const res = await axios.post(
                `${this.baseUrl()}/api/v1/devices/push-targets`,
                { UserIds: userIds },
                { headers: this.headers(), timeout: 5000 },
            );
            return res.data?.Data ?? [];
        } catch (error: any) {
            logger.warn(`identity.pushTargets failed: HTTP ${error?.response?.status ?? ''} ${error?.message}`);
            return [];
        }
    };

    /**
     * Tell identity a token is dead so it stops handing it back.
     *
     * Without this, tokens from uninstalled apps accumulate forever and every
     * send burns quota on devices that will never receive anything.
     */
    public purgeToken = async (fcmToken: string): Promise<void> => {
        try {
            await axios.post(
                `${this.baseUrl()}/api/v1/devices/purge-token`,
                { FcmToken: fcmToken },
                { headers: this.headers(), timeout: 5000 },
            );
        } catch (error: any) {
            //Non-fatal: the token will be retried and purged next time.
            logger.warn(`identity.purgeToken failed: ${error?.message}`);
        }
    };
}
