import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Client for notifications-service.
//
//  Callers name an EVENT ('ORDER_READY') and pass variables; the copy,
//  the language and the channel formatting all live in notifications-
//  service. That keeps message wording out of the order domain, and means
//  a Marathi translation lands without touching this service.
//
//  Nothing here throws. A notification is a courtesy: failing to tell a
//  customer their order is ready must never roll back the order itself.
//  notifications-service is already durable — it writes a log row and
//  queues with retry — so the only failure this swallows is "could not
//  hand it over", which is logged and moves on.
/////////////////////////////////////////////////////////////////////////

export type NotificationChannel = 'SMS' | 'Email' | 'WhatsApp' | 'Push' | 'InApp';

export interface NotifyInput {
    TenantId  : string;
    Code      : string;
    Channel   : NotificationChannel;
    Recipient : string;
    Language? : 'en' | 'mr';
    Variables?: Record<string, string | number>;
    UserId?   : string;
}

@injectable()
export class NotificationsServiceConnector {

    private baseUrl(): string {
        return ConfigurationManager.getEnv('NOTIFICATIONS_SERVICE_URL', 'http://localhost:4005');
    }

    private headers(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            //payments-service is in notifications' AllowedClients for
            ///send-template. No user token: a captured-payment event has no
            //user in scope, so TenantId travels in the body.
            'x-api-key': ConfigurationManager.getEnv('API_KEY_PAYMENTS_SERVICE', 'payments-service-dev-key'),
        };
    }

    public send = async (input: NotifyInput): Promise<void> => {
        try {
            await axios.post(`${this.baseUrl()}/api/v1/notifications/send-template`, {
                TemplateCode : input.Code,
                Channel      : input.Channel,
                Recipient    : input.Recipient,
                Language     : input.Language ?? 'en',
                TenantId     : input.TenantId,
                Variables    : input.Variables ?? {},
                UserId       : input.UserId,
            }, { headers: this.headers(), timeout: 5000 });
        } catch (error: any) {
            logger.warn(`notify ${input.Code}/${input.Channel} to ${input.Recipient} failed: ${error?.response?.status ?? ''} ${error?.response?.data?.Message ?? error?.message}`);
        }
    };

    /**
     * Send the same event over several channels.
     *
     * Channels are independent — a dead SMS gateway must not stop the push —
     * so they go out concurrently and each swallows its own failure.
     */
    public fanOut = async (input: Omit<NotifyInput, 'Channel'>, channels: NotificationChannel[]): Promise<void> => {
        await Promise.all(channels.map((Channel) => this.send({ ...input, Channel })));
    };
}
