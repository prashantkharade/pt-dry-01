import crypto from 'node:crypto';
import { injectable } from 'tsyringe';
import { ConfigurationManager } from '../../config/configuration.manager';
import { ErrorHandler } from '../../common/api.error';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Razorpay provider — wraps the official SDK so the rest of the service
//  doesn't depend on the Razorpay import surface.
//
//  Real client needs RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET; the mock path
//  keeps local dev and tests working without credentials.
/////////////////////////////////////////////////////////////////////////

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
export class RazorpayProvider {

    private clientPromise: Promise<any> | null = null;

    private async getClient(): Promise<any> {
        if (this.clientPromise) return this.clientPromise;
        const keyId     = ConfigurationManager.getEnvOptional('RAZORPAY_KEY_ID');
        const keySecret = ConfigurationManager.getEnvOptional('RAZORPAY_KEY_SECRET');
        if (!keyId || !keySecret) {
            logger.warn('Razorpay: keys missing — running in mock mode');
            return null;
        }
        const mod  = await import('razorpay');
        const Ctor = (mod as any).default ?? mod;
        this.clientPromise = Promise.resolve(new Ctor({ key_id: keyId, key_secret: keySecret }));
        return this.clientPromise;
    }

    public createOrder = async (input: CreateProviderOrderInput): Promise<ProviderOrder> => {
        const client = await this.getClient();
        if (!client) {
            //Deterministic on the receipt, so a retry in dev is idempotent
            //rather than minting a brand-new id every call.
            const id = `rzp_mock_${input.Receipt}`;
            return { Id: id, Status: 'created', Amount: input.AmountInPaise, Currency: input.Currency, Receipt: input.Receipt };
        }
        const order = await client.orders.create({
            //Razorpay works in paise, which is also how we hold money
            //internally — no conversion, no rounding, no float.
            amount  : input.AmountInPaise,
            currency: input.Currency,
            //Razorpay caps receipt at 40 chars and rejects anything longer.
            receipt : input.Receipt.slice(0, 40),
            notes   : input.Notes,
        });
        return { Id: order.id, Status: order.status, Amount: Number(order.amount), Currency: order.currency, Receipt: order.receipt };
    };

    /**
     * Verify the handshake Razorpay Checkout hands back to the browser.
     *
     * This is a DIFFERENT signature from the webhook one: the message is
     * `order_id|payment_id` and the key is the API SECRET, not the webhook
     * secret. Without this check, a client could POST any payment id it liked
     * and have us mark the order paid.
     *
     * Fails closed — no secret means no verification means reject.
     */
    public verifyCheckoutSignature = (orderId: string, paymentId: string, signature: string): boolean => {
        const secret = ConfigurationManager.getEnvOptional('RAZORPAY_KEY_SECRET');
        if (!secret) {
            logger.error('Razorpay: cannot verify checkout signature — RAZORPAY_KEY_SECRET is not set');
            return false;
        }
        if (!orderId || !paymentId || !signature) return false;

        const expected = crypto.createHmac('sha256', secret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        //Constant-time. A plain !== leaks the signature byte by byte to anyone
        //who can measure our response latency.
        if (expected.length !== signature.length) return false;
        try {
            return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
        } catch {
            return false;
        }
    };

    /** Ask Razorpay what actually happened, rather than trusting the client. */
    public verify = async (paymentId: string): Promise<ProviderVerification> => {
        const client = await this.getClient();
        if (!client) {
            logger.warn('Razorpay: not configured — mock verify reports captured (dev only)');
            return { Status: 'captured', AmountInPaise: 0, PaymentId: paymentId, Method: 'mock' };
        }
        try {
            const p = await client.payments.fetch(paymentId);
            return {
                Status        : String(p.status),
                AmountInPaise : Number(p.amount),
                PaymentId     : String(p.id),
                Method        : p.method,
            };
        } catch (error: any) {
            logger.error(`Razorpay verify failed for ${paymentId}: ${error?.message}`);
            ErrorHandler.throwUnprocessableError('Unable to verify the Razorpay payment');
        }
    };

    public refund = async (paymentId: string, amountInPaise: number, reason: string): Promise<{ Id: string; Status: string }> => {
        const client = await this.getClient();
        if (!client) {
            logger.warn('Razorpay: not configured — mock refund (dev only)');
            return { Id: `rzp_rfnd_mock_${paymentId}`, Status: 'processed' };
        }
        try {
            const refund = await client.payments.refund(paymentId, {
                amount : amountInPaise,
                notes  : { reason },
                //Razorpay dedupes on this key, so a retried refund request
                //cannot pay the customer back twice.
                speed  : 'normal',
            });
            return { Id: String(refund.id), Status: String(refund.status) };
        } catch (error: any) {
            logger.error(`Razorpay refund failed for ${paymentId}: ${error?.message}`);
            ErrorHandler.throwUnprocessableError(`Unable to refund the Razorpay payment: ${error?.error?.description ?? error?.message}`);
        }
    };

    public static isSuccessStatus = (status: string): boolean =>
        ['captured', 'authorized'].includes(String(status).toLowerCase());
}
