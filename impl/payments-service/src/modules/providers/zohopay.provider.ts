import { injectable } from 'tsyringe';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Zohopay provider stub. Wired through the same interface as Razorpay
//  so PaymentService can swap providers per tenant / per order.
/////////////////////////////////////////////////////////////////////////

export interface CreateProviderOrderInput {
    AmountInPaise : number;
    Currency      : string;
    Receipt       : string;
    Notes?        : Record<string, string>;
}

export interface ProviderOrder {
    Id: string; Status: string; Amount: number; Currency: string; Receipt: string;
}

@injectable()
export class ZohopayProvider {

    public createOrder = async (input: CreateProviderOrderInput): Promise<ProviderOrder> => {
        logger.info('Zohopay (stub): creating order');
        const id = `zhp_mock_${Date.now()}`;
        return { Id: id, Status: 'created', Amount: input.AmountInPaise, Currency: input.Currency, Receipt: input.Receipt };
    };
}
