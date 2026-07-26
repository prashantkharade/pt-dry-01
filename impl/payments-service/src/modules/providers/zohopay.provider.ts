import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { ZohoTokenCache } from './zoho.token.cache';
import { ErrorHandler } from '../../common/api.error';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Zoho Pay.
//
//  Flow: we create a payment SESSION server-side and hand its id to the
//  client, which drives Zoho's SDK. We never see card details. Money is
//  confirmed by the webhook (signature-verified in WebhookController); the
//  verify() call here is the client-side fallback for when the webhook is
//  slow or lost.
//
//  Correlation: `reference_number` carries OUR order code. That is how a
//  webhook, which knows nothing about our ids, finds its way back to an
//  order — see PaymentService.extractRefs.
/////////////////////////////////////////////////////////////////////////

const TOKEN_CACHE_KEY = 'zohopay';

export interface CreateProviderOrderInput {
    AmountInPaise : number;
    Currency      : string;
    Receipt       : string;
    Notes?        : Record<string, string>;
}

export interface ProviderOrder {
    Id       : string;
    Status   : string;
    Amount   : number;
    Currency : string;
    Receipt  : string;
}

export interface ProviderVerification {
    Status        : string;
    AmountInPaise : number;
    PaymentId     : string;
    Method?       : string;
}

@injectable()
export class ZohopayProvider {

    private get accountId() { return ConfigurationManager.getEnvOptional('ZOHOPAY_ACCOUNT_ID'); }

    private get apiUrl() {
        return ConfigurationManager.getEnvOptional('ZOHOPAY_MODE') === 'live'
            ? 'https://payments.zoho.in/api/v1'
            : 'https://paymentssandbox.zoho.in/api/v1';
    }

    /** True when we have enough config to talk to Zoho for real. */
    private get isConfigured(): boolean {
        return Boolean(
            this.accountId &&
            ConfigurationManager.getEnvOptional('ZOHOPAY_CLIENT_ID') &&
            ConfigurationManager.getEnvOptional('ZOHOPAY_CLIENT_SECRET') &&
            ConfigurationManager.getEnvOptional('ZOHOPAY_REFRESH_TOKEN'),
        );
    }

    /**
     * A valid access token, refreshed on demand.
     *
     * No fallback to a static ZOHO_ACCESS_TOKEN env var: a hardcoded token
     * expires within the hour and turns a clean auth failure into an
     * intermittent one that only shows up in production.
     */
    private getAccessToken = async (): Promise<string> => {
        const cached = ZohoTokenCache.get(TOKEN_CACHE_KEY);
        if (cached) return cached;

        const accountsUrl = ConfigurationManager.getEnvOptional('ZOHOPAY_ACCOUNTS_URL') ?? 'https://accounts.zoho.in';
        try {
            const res = await axios.post(`${accountsUrl}/oauth/v2/token`, null, {
                params : {
                    refresh_token : ConfigurationManager.getEnv('ZOHOPAY_REFRESH_TOKEN'),
                    client_id     : ConfigurationManager.getEnv('ZOHOPAY_CLIENT_ID'),
                    client_secret : ConfigurationManager.getEnv('ZOHOPAY_CLIENT_SECRET'),
                    grant_type    : 'refresh_token',
                },
                timeout: 10_000,
            });
            const token     = res.data?.access_token;
            const expiresIn = Number(res.data?.expires_in ?? 3600);
            if (!token) ErrorHandler.throwUnprocessableError('Zoho did not return an access token');

            ZohoTokenCache.set(TOKEN_CACHE_KEY, token, expiresIn);
            logger.info(`Zoho access token refreshed (valid ${expiresIn}s)`);
            return token;
        } catch (error: any) {
            //Never log the refresh token or client secret.
            logger.error(`Zoho token refresh failed: HTTP ${error?.response?.status} ${error?.response?.data?.error ?? error?.message}`);
            ErrorHandler.throwUnprocessableError('Unable to authenticate with Zoho Pay');
        }
    };

    /**
     * Create a payment session. Returns the id the client SDK needs.
     *
     * In mock mode (no config) this returns a deterministic fake so local dev
     * and tests exercise the full path without Zoho credentials.
     */
    public createOrder = async (input: CreateProviderOrderInput): Promise<ProviderOrder> => {
        if (!this.isConfigured) {
            logger.warn('Zohopay: not configured — returning a mock session (dev only)');
            return {
                Id: `zhp_mock_${input.Receipt}`, Status: 'created',
                Amount: input.AmountInPaise, Currency: input.Currency, Receipt: input.Receipt,
            };
        }

        const token = await this.getAccessToken();
        try {
            const res = await axios.post(
                `${this.apiUrl}/paymentsessions`,
                {
                    //Zoho wants major units. We hold paise internally, so convert
                    //at the boundary — and only here.
                    amount           : Number((input.AmountInPaise / 100).toFixed(2)),
                    currency         : input.Currency,
                    description      : `Payment for order ${input.Receipt}`,
                    //Our order code. The webhook echoes this back verbatim.
                    reference_number : input.Receipt,
                    meta_data        : Object.entries(input.Notes ?? {}).map(([key, value]) => ({ key, value })),
                },
                {
                    params  : { account_id: this.accountId },
                    headers : { Authorization: `Zoho-oauthtoken ${token}` },
                    timeout : 15_000,
                },
            );
            const session = res.data?.payments_session;
            if (!session?.payments_session_id) {
                ErrorHandler.throwUnprocessableError('Zoho did not return a payment session id');
            }
            return {
                Id: session.payments_session_id, Status: session.status ?? 'created',
                Amount: input.AmountInPaise, Currency: input.Currency, Receipt: input.Receipt,
            };
        } catch (error: any) {
            //A stale token survives the cache skew only if Zoho revoked it.
            //Drop it so the next attempt refreshes rather than failing again.
            if (error?.response?.status === 401) ZohoTokenCache.clear(TOKEN_CACHE_KEY);
            logger.error(`Zoho createOrder failed: HTTP ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
            ErrorHandler.throwUnprocessableError('Unable to create a Zoho payment session');
        }
    };

    /**
     * Ask Zoho directly what happened to a payment.
     *
     * Used as the client-side fallback when the webhook has not arrived. This
     * is authoritative — we ask the provider rather than trusting whatever the
     * client posted us.
     */
    public verify = async (paymentId: string): Promise<ProviderVerification> => {
        if (!this.isConfigured) {
            logger.warn('Zohopay: not configured — mock verify reports success (dev only)');
            return { Status: 'success', AmountInPaise: 0, PaymentId: paymentId, Method: 'mock' };
        }
        const token = await this.getAccessToken();
        try {
            const res = await axios.get(`${this.apiUrl}/payments/${paymentId}`, {
                params  : { account_id: this.accountId },
                headers : { Authorization: `Zoho-oauthtoken ${token}` },
                timeout : 15_000,
            });
            const p = res.data?.payment ?? res.data;
            return {
                Status        : String(p?.status ?? 'unknown'),
                AmountInPaise : Math.round(Number(p?.amount ?? 0) * 100),
                PaymentId     : String(p?.payment_id ?? paymentId),
                Method        : p?.payment_method,
            };
        } catch (error: any) {
            if (error?.response?.status === 401) ZohoTokenCache.clear(TOKEN_CACHE_KEY);
            logger.error(`Zoho verify failed for ${paymentId}: HTTP ${error?.response?.status}`);
            ErrorHandler.throwUnprocessableError('Unable to verify the Zoho payment');
        }
    };

    /** Zoho reports success under more than one label. */
    public static isSuccessStatus = (status: string): boolean =>
        ['success', 'succeeded', 'captured', 'authorized', 'paid'].includes(String(status).toLowerCase());

    public refund = async (paymentId: string, amountInPaise: number, reason: string): Promise<{ Id: string; Status: string }> => {
        if (!this.isConfigured) {
            logger.warn('Zohopay: not configured — mock refund (dev only)');
            return { Id: `zhp_rfnd_mock_${paymentId}`, Status: 'processed' };
        }
        const token = await this.getAccessToken();
        try {
            const res = await axios.post(
                `${this.apiUrl}/payments/${paymentId}/refunds`,
                { amount: Number((amountInPaise / 100).toFixed(2)), reason },
                { params: { account_id: this.accountId }, headers: { Authorization: `Zoho-oauthtoken ${token}` }, timeout: 15_000 },
            );
            const refund = res.data?.refund ?? res.data;
            return { Id: String(refund?.refund_id ?? refund?.id), Status: String(refund?.status ?? 'pending') };
        } catch (error: any) {
            if (error?.response?.status === 401) ZohoTokenCache.clear(TOKEN_CACHE_KEY);
            logger.error(`Zoho refund failed for ${paymentId}: HTTP ${error?.response?.status}`);
            ErrorHandler.throwUnprocessableError('Unable to refund the Zoho payment');
        }
    };
}
