import { injectable, inject } from 'tsyringe';
//firebase-admin v13+ is modular: the old `admin.messaging()` namespace API
//that the reference implementation uses no longer exists.
import { App, initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';
import { IdentityServiceConnector } from '../identity/identity.service.connector';

/////////////////////////////////////////////////////////////////////////
//  Push notifications via Firebase Cloud Messaging.
//
//  Sends to a USER, not a device: identity-service holds the device
//  registry, so we resolve the user's tokens and fan out to all of them —
//  a customer with a phone and a tablet expects both to buzz.
//
//  Dead tokens are purged, not retried. FCM answers UNREGISTERED for an
//  uninstalled app; without acting on that, tokens accumulate forever and
//  every send burns quota on devices that will never receive anything.
//  (The reference implementation ignored the per-token responses entirely.)
/////////////////////////////////////////////////////////////////////////

export interface PushResult {
    MessageId? : string;
    Skipped?   : boolean;
    Sent?      : number;
    Failed?    : number;
}

//FCM codes meaning "this token is permanently dead", as opposed to a
//transient failure worth retrying.
const DEAD_TOKEN_CODES = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
];

@injectable()
export class PushChannel {

    constructor(
        @inject(IdentityServiceConnector) private _identity: IdentityServiceConnector,
    ) {}

    private app: App | null = null;
    private initTried = false;

    public get isConfigured(): boolean {
        return Boolean(
            ConfigurationManager.getEnvOptional('FCM_SERVICE_ACCOUNT_JSON') ||
            ConfigurationManager.getEnvOptional('FCM_SERVICE_ACCOUNT_PATH'),
        );
    }

    /**
     * Build the Firebase app once.
     *
     * Credentials come from FCM_SERVICE_ACCOUNT_JSON (the JSON itself) in
     * preference to a file path: containers get secrets as env vars, and a
     * path forces baking a key file into the image or mounting a volume.
     */
    private getApp(): App | null {
        if (this.app) return this.app;
        if (this.initTried) return null;
        this.initTried = true;

        const inlineJson = ConfigurationManager.getEnvOptional('FCM_SERVICE_ACCOUNT_JSON');
        const path       = ConfigurationManager.getEnvOptional('FCM_SERVICE_ACCOUNT_PATH');
        if (!inlineJson && !path) {
            logger.warn('FCM is not configured — push notifications will be Skipped, not sent');
            return null;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const serviceAccount = inlineJson ? JSON.parse(inlineJson) : require(path);

            //Named app: initializeApp() with no name throws when called twice,
            //which bites on hot reload in dev.
            this.app = getApps().find((a) => a.name === 'ptk')
                ?? initializeApp({ credential: cert(serviceAccount) }, 'ptk');
            logger.info('FCM initialised');
            return this.app;
        } catch (error: any) {
            //Never log the service account — it contains a private key.
            logger.error(`FCM initialisation failed: ${error?.message}`);
            return null;
        }
    }

    /**
     * Send to every live device a user has.
     *
     * `recipient` is a UserId. It keeps the generic channel signature so
     * NotificationService can dispatch uniformly across channels.
     */
    public send = async (
        recipient : string,
        title     : string,
        body      : string,
        data?     : Record<string, string>,
    ): Promise<PushResult> => {
        const app = this.getApp();
        if (!app) {
            logger.warn(`PushChannel not configured — would push to user=${recipient} title="${title}"`);
            return { Skipped: true };
        }

        const targets = await this._identity.pushTargetsFor([recipient]);
        if (targets.length === 0) {
            //Not a failure: plenty of users never grant push permission.
            //Skipped keeps it out of the failed count without pretending we sent.
            logger.info(`No push targets for user=${recipient} — nothing to send`);
            return { Skipped: true, Sent: 0 };
        }

        const tokens  = targets.map((t) => t.FcmToken);
        const message = this.buildMessage(title, body, data);

        try {
            //sendEachForMulticast, not sendMulticast: the latter was removed in
            //firebase-admin v11 and the reference still calls it.
            const res = await getMessaging(app).sendEachForMulticast({ tokens, ...message });

            //Walk the per-token responses and purge the permanently dead ones.
            const dead: string[] = [];
            res.responses.forEach((r, i) => {
                if (r.success) return;
                const code = (r.error as any)?.code;
                if (DEAD_TOKEN_CODES.includes(code)) dead.push(tokens[i]);
                else logger.warn(`Push to token ${i} failed (transient): ${code}`);
            });
            for (const token of dead) await this._identity.purgeToken(token);

            logger.info(`Push user=${recipient} sent=${res.successCount}/${tokens.length} purged=${dead.length}`);

            //If every token failed transiently, throw so the queue retries.
            //Dead tokens are not a failure — there is nothing to retry to.
            if (res.successCount === 0 && dead.length < tokens.length) {
                throw new Error(`All ${tokens.length} push sends failed`);
            }
            return {
                Sent: res.successCount, Failed: res.failureCount,
                MessageId: `fcm_${res.successCount}_of_${tokens.length}`,
            };
        } catch (error: any) {
            logger.error(`Push send failed for user=${recipient}: ${error?.message}`);
            throw error;
        }
    };

    /**
     * The message shape.
     *
     * `data` duplicates the title/body alongside `notification` deliberately:
     * Android delivers `notification` to the system tray when the app is
     * backgrounded and `data` to the app when foregrounded. Flutter needs both
     * to render consistently and to handle the tap.
     */
    private buildMessage = (title: string, body: string, data?: Record<string, string>) => ({
        notification : { title, body },
        data : {
            title,
            body,
            //Flutter's onMessageOpenedApp needs this to route the tap.
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            ...(data ?? {}),
        },
        android : {
            //An order-status push is worthless a day later.
            ttl      : 3600 * 1000,
            priority : 'high' as const,
            notification: { title, body, color: '#0f4c5c', channelId: 'ptk_orders' },
        },
        apns : {
            headers : { 'apns-priority': '10' },
            payload : { aps: { alert: { title, body }, sound: 'default' } },
        },
        webpush : {
            notification: { title, body, icon: '/icon-192.png' },
        },
    });

    /** Broadcast to a topic — e.g. every partner on shift. */
    public sendToTopic = async (topic: string, title: string, body: string, data?: Record<string, string>): Promise<PushResult> => {
        const app = this.getApp();
        if (!app) return { Skipped: true };
        const id = await getMessaging(app).send({ topic, ...this.buildMessage(title, body, data) });
        return { MessageId: id };
    };
}
