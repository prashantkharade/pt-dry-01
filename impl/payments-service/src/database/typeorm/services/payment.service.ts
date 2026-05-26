import { injectable, inject } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { Payment } from '../models/payment.model';
import { WebhookEvent } from '../models/webhook.event.model';
import { BaseService } from './base.service';
import { RazorpayProvider } from '../../../modules/providers/razorpay.provider';
import { ZohopayProvider } from '../../../modules/providers/zohopay.provider';
import { ConfigurationManager } from '../../../config/configuration.manager';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  PaymentService — high-level orchestration:
//    1) initiate(): create a provider order, persist a local Payment row.
//    2) markCaptured(): bump Payment.Status when the provider confirms.
//    3) ingestWebhook(): store the raw event and best-effort link it to a
//       Payment row via the provider order id.
/////////////////////////////////////////////////////////////////////////

export interface InitiatePaymentInput {
    TenantId  : string;
    OrderId   : string;
    OrderCode : string;
    AmountInr : number;
    Provider? : 'Razorpay' | 'Zohopay' | 'Cash' | 'UPI';
    Metadata? : Record<string, unknown>;
}

@injectable()
export class PaymentService extends BaseService {

    constructor(
        @inject(RazorpayProvider) private _razorpay: RazorpayProvider,
        @inject(ZohopayProvider)  private _zohopay:  ZohopayProvider,
    ) {
        super();
    }

    private _paymentRepo = Source.getRepository(Payment);
    private _webhookRepo = Source.getRepository(WebhookEvent);

    public initiate = async (input: InitiatePaymentInput): Promise<Payment> => {
        const provider = input.Provider ?? ConfigurationManager.PrimaryPayment;
        const amountInPaise = Math.round(input.AmountInr * 100);

        let providerOrderId: string | null = null;
        if (provider === 'Razorpay') {
            const o = await this._razorpay.createOrder({
                AmountInPaise: amountInPaise, Currency: 'INR', Receipt: input.OrderCode,
                Notes        : { OrderId: input.OrderId, OrderCode: input.OrderCode },
            });
            providerOrderId = o.Id;
        } else if (provider === 'Zohopay') {
            const o = await this._zohopay.createOrder({
                AmountInPaise: amountInPaise, Currency: 'INR', Receipt: input.OrderCode,
            });
            providerOrderId = o.Id;
        }

        const saved = await this._paymentRepo.save(this._paymentRepo.create({
            TenantId        : input.TenantId,
            OrderId         : input.OrderId,
            OrderCode       : input.OrderCode,
            Provider        : provider,
            ProviderOrderId : providerOrderId,
            AmountInr       : String(input.AmountInr),
            Currency        : 'INR',
            Status          : 'Pending',
            Metadata        : input.Metadata,
        }));
        return saved;
    };

    public markCaptured = async (id: string, providerPaymentId: string): Promise<Payment> => {
        const payment = await this._paymentRepo.findOne({ where: { id } });
        if (!payment) ErrorHandler.throwNotFoundError('Payment not found');
        payment.Status            = 'Captured';
        payment.ProviderPaymentId = providerPaymentId;
        return this._paymentRepo.save(payment);
    };

    public markFailed = async (id: string, reason: string): Promise<Payment> => {
        const payment = await this._paymentRepo.findOne({ where: { id } });
        if (!payment) ErrorHandler.throwNotFoundError('Payment not found');
        payment.Status        = 'Failed';
        payment.FailureReason = reason;
        return this._paymentRepo.save(payment);
    };

    public listForOrder = async (orderId: string): Promise<Payment[]> => {
        return this._paymentRepo.find({ where: { OrderId: orderId }, order: { CreatedAt: 'DESC' } });
    };

    public ingestWebhook = async (provider: string, eventType: string, payload: Record<string, unknown>): Promise<WebhookEvent> => {
        const event = await this._webhookRepo.save(this._webhookRepo.create({
            Provider : provider,
            EventType: eventType,
            Payload  : payload,
        }));

        // Best-effort: attach to a Payment by ProviderOrderId / ProviderPaymentId.
        const orderId   = (payload as any)?.payload?.payment?.entity?.order_id;
        const paymentId = (payload as any)?.payload?.payment?.entity?.id;
        if (orderId) {
            const match = await this._paymentRepo.findOne({ where: { ProviderOrderId: orderId } });
            if (match) {
                event.PaymentId = match.id;
                await this._webhookRepo.save(event);
                if (eventType === 'payment.captured' && paymentId) {
                    await this.markCaptured(match.id, paymentId);
                }
                if (eventType === 'payment.failed') {
                    await this.markFailed(match.id, 'Provider webhook: payment.failed');
                }
            }
        }
        event.Processed = true;
        return this._webhookRepo.save(event);
    };
}
