import { injectable } from 'tsyringe';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Razorpay provider — wraps the official SDK so the rest of the service
//  doesn't depend on the Razorpay import surface. Creating a real client
//  requires RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET; the mock path is used
//  for dev / tests where those aren't set.
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
            const id = `rzp_mock_${Date.now()}`;
            return { Id: id, Status: 'created', Amount: input.AmountInPaise, Currency: input.Currency, Receipt: input.Receipt };
        }
        const order = await client.orders.create({
            amount  : input.AmountInPaise,
            currency: input.Currency,
            receipt : input.Receipt,
            notes   : input.Notes,
        });
        return { Id: order.id, Status: order.status, Amount: Number(order.amount), Currency: order.currency, Receipt: order.receipt };
    };
}
