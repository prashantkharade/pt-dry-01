import { injectable, inject } from 'tsyringe';
import { EntityManager } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { Payment } from '../models/payment.model';
import { WebhookEvent } from '../models/webhook.event.model';
import { Refund } from '../models/refund.model';
import { BaseService } from './base.service';
import { WalletService } from './wallet.service';
import { RazorpayProvider } from '../../../modules/providers/razorpay.provider';
import { ZohopayProvider } from '../../../modules/providers/zohopay.provider';
import { ConfigurationManager } from '../../../config/configuration.manager';
import { ErrorHandler } from '../../../common/api.error';
import { logger } from '../../../logger/logger';
import { Money } from '../../../common/utilities/money';
import { NotificationsServiceConnector } from '../../../modules/notifications/notifications.service.connector';
import { PaymentStateMachine } from '../../../domain.types/payments/payment.state.machine';
import {
    PaymentProvider, PaymentStatus, RefundStatus, WalletTxnReason,
} from '../../../domain.types/enums/payment.enums';

/////////////////////////////////////////////////////////////////////////
//  PaymentService.
//
//    initiate()      — split the bill across wallet + gateway, create the
//                      gateway order, persist a Payment row per attempt
//    verifyAndCapture() — client-side confirmation, signature-verified
//    ingestWebhook() — provider-side confirmation, idempotent + ordered
//    refund()        — partial or full, to gateway or to wallet
//
//  Both confirmation paths (verify and webhook) deliberately race; they are
//  reconciled by the state machine, so whichever arrives second is a no-op
//  rather than a corruption.
/////////////////////////////////////////////////////////////////////////

export interface InitiatePaymentInput {
    TenantId    : string;
    OrderId     : string;
    OrderCode   : string;
    CustomerId  : string;
    AmountInr   : number | string;
    Provider?   : PaymentProvider;
    //Spend store credit first, then charge the remainder to the gateway.
    UseWallet?  : boolean;
    //Captured so a webhook can send the receipt without a lookup. See the
    //Payment model.
    CustomerPhone?    : string;
    CustomerLanguage? : 'en' | 'mr';
    Metadata?   : Record<string, unknown>;
}

export interface InitiateResult {
    OrderId          : string;
    TotalInr         : string;
    WalletPaidInr    : string;
    GatewayAmountInr : string;
    //Null when the wallet covered everything — there is no gateway step.
    Payment          : Payment | null;
    ProviderOrderId  : string | null;
    Provider         : PaymentProvider | null;
    FullyPaid        : boolean;
}

@injectable()
export class PaymentService extends BaseService {

    constructor(
        @inject(RazorpayProvider) private _razorpay: RazorpayProvider,
        @inject(ZohopayProvider)  private _zohopay:  ZohopayProvider,
        @inject(WalletService)    private _wallet:   WalletService,
        @inject(NotificationsServiceConnector) private _notify: NotificationsServiceConnector,
    ) {
        super();
    }

    private _paymentRepo = Source.getRepository(Payment);
    private _webhookRepo = Source.getRepository(WebhookEvent);
    private _refundRepo  = Source.getRepository(Refund);

    /**
     * Start paying for an order.
     *
     * The wallet portion is debited inside the transaction that writes the
     * Payment row: if the gateway order fails to create, the wallet debit must
     * roll back with it or the customer loses store credit for a payment that
     * never started.
     */
    public initiate = async (input: InitiatePaymentInput): Promise<InitiateResult> => {
        const provider   = input.Provider ?? (ConfigurationManager.PrimaryPayment as PaymentProvider);
        const totalPaise = Money.toPaise(input.AmountInr);
        if (totalPaise <= 0) ErrorHandler.throwInputValidationError(['Payment amount must be greater than zero']);

        //Don't charge twice for the same order.
        const settled = await this.settledTotalPaiseFor(input.OrderId);
        if (settled >= totalPaise) {
            ErrorHandler.throwConflictError('This order is already paid', {
                PaidInr: Money.fromPaise(settled), TotalInr: Money.fromPaise(totalPaise),
            });
        }
        const duePaise = totalPaise - settled;

        return Source.transaction(async (manager) => {
            let walletPaidPaise = 0;

            if (input.UseWallet) {
                const spendable = Money.toPaise(await this._wallet.spendable(input.TenantId, input.CustomerId));
                //Spend what's there, up to what's owed. Never more.
                walletPaidPaise = Math.max(0, Math.min(spendable, duePaise));
                if (walletPaidPaise > 0) {
                    await this._wallet.debit({
                        TenantId       : input.TenantId,
                        CustomerId     : input.CustomerId,
                        AmountInr      : Money.fromPaise(walletPaidPaise),
                        Reason         : WalletTxnReason.OrderPayment,
                        OrderId        : input.OrderId,
                        //One wallet debit per order attempt. A retried initiate
                        //for the same order will not double-spend the wallet.
                        IdempotencyKey : `order-payment:${input.OrderId}`,
                        Description    : `Payment for order ${input.OrderCode}`,
                    }, manager);
                }
            }

            const gatewayPaise = duePaise - walletPaidPaise;

            //Wallet covered it all — no gateway round trip, nothing to confirm.
            if (gatewayPaise <= 0) {
                const walletPayment = await manager.save(manager.create(Payment, {
                    TenantId  : input.TenantId,
                    OrderId   : input.OrderId,
                    OrderCode : input.OrderCode,
                    CustomerId: input.CustomerId,
                    CustomerPhone   : input.CustomerPhone ?? null,
                    CustomerLanguage: input.CustomerLanguage ?? null,
                    Provider  : PaymentProvider.Wallet,
                    AmountInr : Money.fromPaise(walletPaidPaise),
                    //Store credit is already ours; there is nothing to capture.
                    Status    : PaymentStatus.Captured,
                    CapturedAt: new Date(),
                    Metadata  : input.Metadata,
                }));
                //Wallet-only payments capture immediately, so the receipt fires
                //here rather than through a webhook that will never come.
                void this.announcePayment(walletPayment, 'Wallet');
                return {
                    OrderId: input.OrderId, TotalInr: Money.fromPaise(totalPaise),
                    WalletPaidInr: Money.fromPaise(walletPaidPaise), GatewayAmountInr: '0.00',
                    Payment: walletPayment, ProviderOrderId: null, Provider: PaymentProvider.Wallet,
                    FullyPaid: true,
                };
            }

            const providerOrder = provider === PaymentProvider.Zohopay
                ? await this._zohopay.createOrder({
                    AmountInPaise: gatewayPaise, Currency: 'INR', Receipt: input.OrderCode,
                    Notes: { OrderId: input.OrderId, CustomerId: input.CustomerId },
                })
                : await this._razorpay.createOrder({
                    AmountInPaise: gatewayPaise, Currency: 'INR', Receipt: input.OrderCode,
                    Notes: { OrderId: input.OrderId, CustomerId: input.CustomerId },
                });

            const payment = await manager.save(manager.create(Payment, {
                TenantId        : input.TenantId,
                OrderId         : input.OrderId,
                OrderCode       : input.OrderCode,
                CustomerId      : input.CustomerId,
                CustomerPhone   : input.CustomerPhone ?? null,
                CustomerLanguage: input.CustomerLanguage ?? null,
                Provider        : provider,
                ProviderOrderId : providerOrder.Id,
                AmountInr       : Money.fromPaise(gatewayPaise),
                WalletPaidInr   : Money.fromPaise(walletPaidPaise),
                Status          : PaymentStatus.Pending,
                Metadata        : input.Metadata,
            }));

            return {
                OrderId: input.OrderId, TotalInr: Money.fromPaise(totalPaise),
                WalletPaidInr: Money.fromPaise(walletPaidPaise), GatewayAmountInr: Money.fromPaise(gatewayPaise),
                Payment: payment, ProviderOrderId: providerOrder.Id, Provider: provider,
                FullyPaid: false,
            };
        });
    };

    /** Paise already settled against an order, across every attempt. */
    private settledTotalPaiseFor = async (orderId: string): Promise<number> => {
        const rows = await this._paymentRepo.find({ where: { OrderId: orderId } });
        return rows
            .filter((p) => p.Status === PaymentStatus.Captured || p.Status === PaymentStatus.PartiallyRefunded)
            .reduce((sum, p) => sum + Money.toPaise(p.AmountInr) + Money.toPaise(p.WalletPaidInr ?? 0), 0);
    };

    /**
     * Confirm from the client (Checkout callback).
     *
     * Two independent checks before a rupee is recognised:
     *   1) the signature proves the provider produced this result
     *   2) we re-fetch the payment from the provider and trust THAT
     * The client's claimed amount is never used.
     */
    public verifyAndCapture = async (
        paymentId : string,
        providerPaymentId: string,
        signature : string,
    ): Promise<Payment> => {
        const payment = await this._paymentRepo.findOne({ where: { id: paymentId } });
        if (!payment) ErrorHandler.throwNotFoundError('Payment not found');

        if (payment.Provider === PaymentProvider.Razorpay) {
            const ok = this._razorpay.verifyCheckoutSignature(payment.ProviderOrderId, providerPaymentId, signature);
            if (!ok) {
                logger.warn(`Razorpay checkout signature rejected for payment=${paymentId}`);
                ErrorHandler.throwUnauthorizedError('Payment signature verification failed');
            }
        }

        //Ask the provider, don't trust the caller.
        const verification = payment.Provider === PaymentProvider.Zohopay
            ? await this._zohopay.verify(providerPaymentId)
            : await this._razorpay.verify(providerPaymentId);

        const success = payment.Provider === PaymentProvider.Zohopay
            ? ZohopayProvider.isSuccessStatus(verification.Status)
            : RazorpayProvider.isSuccessStatus(verification.Status);

        if (!success) {
            return this.applyStatus(payment.id, PaymentStatus.Failed, {
                FailureReason: `Provider reports status=${verification.Status}`,
                Source: 'verify',
            });
        }

        //Guard against a short payment being accepted as full. Skipped when the
        //provider reports 0 (mock mode).
        if (verification.AmountInPaise > 0) {
            const expected = Money.toPaise(payment.AmountInr);
            if (verification.AmountInPaise < expected) {
                logger.error(`Underpayment on ${paymentId}: provider says ${verification.AmountInPaise}p, expected ${expected}p`);
                ErrorHandler.throwUnprocessableError('The amount paid is less than the amount due');
            }
        }

        return this.applyStatus(payment.id, PaymentStatus.Captured, {
            ProviderPaymentId: verification.PaymentId, Source: 'verify',
        });
    };

    /**
     * The single writer of Payment.Status.
     *
     * Locks the row, asks the state machine, and no-ops on an illegal or
     * duplicate move instead of throwing — webhooks and verify legitimately
     * race, and the loser must be quiet.
     */
    public applyStatus = async (
        paymentId : string,
        to        : PaymentStatus,
        details?  : { ProviderPaymentId?: string; FailureReason?: string; Source?: string; Raw?: Record<string, unknown> },
        manager?  : EntityManager,
    ): Promise<Payment> => {
        //Whether THIS call actually transitioned the payment to Captured, so
        //the receipt fires exactly once and only after commit.
        let justCaptured = false;

        const run = async (m: EntityManager): Promise<Payment> => {
            const payment = await m.findOne(Payment, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } });
            if (!payment) ErrorHandler.throwNotFoundError('Payment not found');

            const decision = PaymentStateMachine.resolve(payment.Status as PaymentStatus, to);
            if (!decision.Apply) {
                logger.info(`Payment ${paymentId} ${payment.Status} -> ${to} skipped via ${details?.Source ?? 'unknown'}: ${decision.Reason}`);
                return payment;
            }

            payment.Status = to;
            if (details?.ProviderPaymentId) payment.ProviderPaymentId = details.ProviderPaymentId;
            if (details?.FailureReason)     payment.FailureReason     = details.FailureReason;
            if (to === PaymentStatus.Captured) { payment.CapturedAt = new Date(); justCaptured = true; }
            if (details?.Raw) payment.Metadata = { ...(payment.Metadata ?? {}), LastProviderEvent: details.Raw };

            const saved = await m.save(payment);
            logger.info(`Payment ${paymentId} -> ${to} via ${details?.Source ?? 'unknown'}`);
            return saved;
        };

        const saved = manager ? await run(manager) : await Source.transaction(run);

        //Receipt AFTER commit — never announce a capture the transaction might
        //still roll back. Skipped when called inside a caller's transaction
        //(refund): that path decides its own messaging.
        if (justCaptured && !manager) {
            void this.announcePayment(saved, saved.Provider);
        }
        return saved;
    };

    /**
     * "Payment received" receipt to the customer.
     *
     * Fire-and-forget by construction — a failed notification must never undo
     * a captured payment. Silently returns when we have no phone on file
     * (a payment initiated before the phone was passed through).
     */
    private announcePayment = async (payment: Payment, method: string): Promise<void> => {
        if (!payment.CustomerPhone) return;
        const language = (payment.CustomerLanguage === 'mr' ? 'mr' : 'en') as 'en' | 'mr';
        await this._notify.fanOut(
            {
                TenantId : payment.TenantId,
                Code     : 'PAYMENT_RECEIVED',
                Recipient: payment.CustomerPhone,
                Language : language,
                Variables: {
                    OrderCode: payment.OrderCode,
                    //Total settled = gateway amount + any wallet portion.
                    Amount   : Money.fromPaise(Money.toPaise(payment.AmountInr) + Money.toPaise(payment.WalletPaidInr ?? 0)),
                    Method   : method,
                },
            },
            ['SMS', 'WhatsApp'],
        );
    };

    public markCash = async (input: InitiatePaymentInput, receivedBy: string): Promise<Payment> => {
        const payment = await this._paymentRepo.save(this._paymentRepo.create({
            TenantId  : input.TenantId,
            OrderId   : input.OrderId,
            OrderCode : input.OrderCode,
            CustomerId: input.CustomerId,
            CustomerPhone   : input.CustomerPhone ?? null,
            CustomerLanguage: input.CustomerLanguage ?? null,
            Provider  : PaymentProvider.Cash,
            AmountInr : Money.fromPaise(Money.toPaise(input.AmountInr)),
            //Cash in the till is already captured — there is no gateway step.
            Status    : PaymentStatus.Captured,
            CapturedAt: new Date(),
            Metadata  : { ...(input.Metadata ?? {}), ReceivedBy: receivedBy },
        }));
        //A cash receipt at the counter is exactly when a WhatsApp copy is most
        //useful — the customer walks away with it.
        void this.announcePayment(payment, 'Cash');
        return payment;
    };

    public listForOrder = async (orderId: string): Promise<Payment[]> =>
        this._paymentRepo.find({ where: { OrderId: orderId }, order: { CreatedAt: 'DESC' } });

    public getById = async (id: string): Promise<Payment> =>
        this._paymentRepo.findOne({ where: { id } });

    //  --- Refunds ---------------------------------------------------------

    /**
     * Refund some or all of a captured payment.
     *
     * `ToWallet` returns the money as store credit: instant for the customer,
     * no gateway fee, and it works even when the original card is long gone.
     */
    public refund = async (input: {
        TenantId       : string;
        PaymentId      : string;
        AmountInr      : number | string;
        Reason         : string;
        ToWallet?      : boolean;
        IdempotencyKey?: string;
        RequestedBy?   : string;
    }): Promise<Refund> => {
        const result = await Source.transaction(async (manager) => {
            const payment = await manager.findOne(Payment, {
                where: { id: input.PaymentId }, lock: { mode: 'pessimistic_write' },
            });
            if (!payment) ErrorHandler.throwNotFoundError('Payment not found');

            if (input.IdempotencyKey) {
                const prior = await manager.findOne(Refund, {
                    where: { PaymentId: payment.id, IdempotencyKey: input.IdempotencyKey },
                });
                //A replay already ran (and already notified). Return it without
                //re-announcing — the AlreadyNotified flag suppresses the send.
                if (prior) return { refund: prior, payment, AlreadyNotified: true };
            }

            if (payment.Status !== PaymentStatus.Captured && payment.Status !== PaymentStatus.PartiallyRefunded) {
                ErrorHandler.throwUnprocessableError(`Only a captured payment can be refunded (this one is ${payment.Status})`);
            }

            const capturedPaise = Money.toPaise(payment.AmountInr) + Money.toPaise(payment.WalletPaidInr ?? 0);
            const alreadyPaise  = await this.refundedPaise(payment.id, manager);
            const wantPaise     = Money.toPaise(input.AmountInr);

            if (wantPaise <= 0) ErrorHandler.throwInputValidationError(['Refund amount must be greater than zero']);
            if (alreadyPaise + wantPaise > capturedPaise) {
                //The check that stops us refunding more than we ever took.
                ErrorHandler.throwUnprocessableError(
                    `Refund exceeds the captured amount: ${Money.fromPaise(wantPaise)} requested, ${Money.fromPaise(capturedPaise - alreadyPaise)} refundable`,
                    { CapturedInr: Money.fromPaise(capturedPaise), AlreadyRefundedInr: Money.fromPaise(alreadyPaise) },
                );
            }

            const refund = await manager.save(manager.create(Refund, {
                TenantId       : input.TenantId,
                PaymentId      : payment.id,
                OrderId        : payment.OrderId,
                AmountInr      : Money.fromPaise(wantPaise),
                Reason         : input.Reason,
                ToWallet       : !!input.ToWallet,
                IdempotencyKey : input.IdempotencyKey ?? null,
                RequestedBy    : input.RequestedBy ?? null,
                Status         : RefundStatus.Pending,
            }));

            if (input.ToWallet) {
                await this._wallet.credit({
                    TenantId       : input.TenantId,
                    CustomerId     : payment.CustomerId,
                    AmountInr      : Money.fromPaise(wantPaise),
                    Reason         : WalletTxnReason.RefundToWallet,
                    OrderId        : payment.OrderId,
                    PaymentId      : payment.id,
                    IdempotencyKey : `refund:${refund.id}`,
                    Description    : `Refund for order ${payment.OrderCode}: ${input.Reason}`,
                }, manager);
                refund.Status      = RefundStatus.Processed;
                refund.ProcessedAt = new Date();
            } else if (payment.Provider === PaymentProvider.Cash || payment.Provider === PaymentProvider.Wallet) {
                //Nothing to call: cash goes back over the counter, wallet money
                //never left. Record it and let the ledger/till reflect reality.
                refund.Status      = RefundStatus.Processed;
                refund.ProcessedAt = new Date();
            } else {
                try {
                    const result = payment.Provider === PaymentProvider.Zohopay
                        ? await this._zohopay.refund(payment.ProviderPaymentId, wantPaise, input.Reason)
                        : await this._razorpay.refund(payment.ProviderPaymentId, wantPaise, input.Reason);
                    refund.ProviderRefundId = result.Id;
                    //Gateways settle asynchronously; the refund webhook flips
                    //Pending -> Processed when the money actually moves.
                    refund.Status      = ['processed', 'succeeded'].includes(result.Status.toLowerCase())
                        ? RefundStatus.Processed : RefundStatus.Pending;
                    if (refund.Status === RefundStatus.Processed) refund.ProcessedAt = new Date();
                } catch (error: any) {
                    refund.Status        = RefundStatus.Failed;
                    refund.FailureReason = error?.message ?? String(error);
                    await manager.save(refund);
                    throw error;
                }
            }
            await manager.save(refund);

            //Payment status follows the refunded TOTAL, not this one refund —
            //that is what distinguishes PartiallyRefunded from Refunded.
            //A failed refund never reaches here: that branch re-throws above.
            const totalRefunded = alreadyPaise + wantPaise;
            if (totalRefunded > 0) {
                await this.applyStatus(
                    payment.id,
                    totalRefunded >= capturedPaise ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded,
                    { Source: 'refund' }, manager,
                );
            }
            //Carry out what the notification needs; sending happens after commit.
            return { refund, payment };
        });

        //Tell the customer their money is on the way — but only for a refund
        //that actually processed (a gateway refund can settle asynchronously,
        //and its own webhook flips Pending->Processed later). After commit, so
        //we never announce a refund the transaction rolled back.
        if (!result.AlreadyNotified && result.refund.Status === RefundStatus.Processed && result.payment.CustomerPhone) {
            const language = (result.payment.CustomerLanguage === 'mr' ? 'mr' : 'en') as 'en' | 'mr';
            void this._notify.fanOut(
                {
                    TenantId : result.payment.TenantId,
                    Code     : 'REFUND_PROCESSED',
                    Recipient: result.payment.CustomerPhone,
                    Language : language,
                    Variables: {
                        OrderCode  : result.payment.OrderCode,
                        Amount     : result.refund.AmountInr,
                        //Where it went — store credit is instant, a gateway
                        //refund takes a few days.
                        Destination: result.refund.ToWallet ? 'your wallet' : 'your original payment method',
                    },
                },
                ['SMS', 'WhatsApp'],
            );
        }
        return result.refund;
    };

    private refundedPaise = async (paymentId: string, manager?: EntityManager): Promise<number> => {
        const repo = manager ? manager.getRepository(Refund) : this._refundRepo;
        const rows = await repo.find({ where: { PaymentId: paymentId } });
        return rows
            .filter((r) => r.Status !== RefundStatus.Failed)
            .reduce((sum, r) => sum + Money.toPaise(r.AmountInr), 0);
    };

    public listRefunds = async (paymentId: string): Promise<Refund[]> =>
        this._refundRepo.find({ where: { PaymentId: paymentId }, order: { CreatedAt: 'DESC' } });

    //  --- Webhooks --------------------------------------------------------

    /**
     * Pull provider order / payment ids out of a webhook body.
     * Razorpay nests under `payload.payment.entity`; Zoho under
     * `event_object.payment`.
     */
    private extractRefs = (provider: string, payload: any): { OrderRef?: string; PaymentRef?: string } => {
        if (provider === PaymentProvider.Razorpay) {
            const entity = payload?.payload?.payment?.entity ?? payload?.payload?.refund?.entity;
            return { OrderRef: entity?.order_id, PaymentRef: entity?.id ?? entity?.payment_id };
        }
        const payment = payload?.event_object?.payment ?? payload;
        //Zoho echoes the `reference_number` we set at session-create — our own
        //order code. That, not a Zoho id, is the join key.
        return { OrderRef: payment?.reference_number, PaymentRef: payment?.payment_id };
    };

    public ingestWebhook = async (
        provider        : string,
        eventType       : string,
        payload         : Record<string, unknown>,
        providerEventId?: string,
    ): Promise<{ Event: WebhookEvent; Duplicate: boolean }> => {

        let event: WebhookEvent;
        try {
            event = await this._webhookRepo.save(this._webhookRepo.create({
                Provider        : provider,
                ProviderEventId : providerEventId ?? null,
                EventType       : eventType,
                Payload         : payload,
                Processed       : false,
            }));
        } catch (error: any) {
            //23505 = unique_violation: we lost the race with a concurrent retry
            //of the same event. That request owns the side effects. Catching the
            //constraint rather than pre-checking is what makes this safe — a
            //check-then-insert has a window between the two.
            if (error?.code === '23505' && providerEventId) {
                const existing = await this._webhookRepo.findOne({
                    where: { Provider: provider, ProviderEventId: providerEventId },
                });
                return { Event: existing, Duplicate: true };
            }
            throw error;
        }

        try {
            const { OrderRef, PaymentRef } = this.extractRefs(provider, payload);
            if (OrderRef) {
                const match = provider === PaymentProvider.Razorpay
                    ? await this._paymentRepo.findOne({ where: { ProviderOrderId: OrderRef } })
                    : await this._paymentRepo.findOne({ where: { OrderCode: OrderRef } });

                if (match) {
                    event.PaymentId = match.id;
                    //The state machine decides whether a late/duplicate event
                    //applies. applyStatus is a no-op when it doesn't.
                    if (this.isSuccessEvent(provider, eventType) && PaymentRef) {
                        await this.applyStatus(match.id, PaymentStatus.Captured, {
                            ProviderPaymentId: PaymentRef, Source: 'webhook', Raw: payload,
                        });
                    } else if (this.isFailureEvent(eventType)) {
                        await this.applyStatus(match.id, PaymentStatus.Failed, {
                            FailureReason: `Provider webhook: ${eventType}`, Source: 'webhook', Raw: payload,
                        });
                    } else if (this.isRefundEvent(eventType)) {
                        await this.markRefundProcessed(match.id, payload);
                    }
                } else {
                    logger.warn(`${provider}.webhook ${eventType}: no Payment matches ref=${OrderRef}`);
                }
            }
            event.Processed = true;
            return { Event: await this._webhookRepo.save(event), Duplicate: false };
        } catch (error: any) {
            //Keep the row with the error attached: an accepted-but-unapplied
            //webhook is exactly what an operator needs to find, and
            //Processed=false is what a redrive job selects on.
            event.Processed       = false;
            event.ProcessingError = error?.message ?? String(error);
            await this._webhookRepo.save(event);
            throw error;
        }
    };

    /** A gateway refund settled — flip the matching Pending refund. */
    private markRefundProcessed = async (paymentId: string, payload: any): Promise<void> => {
        const providerRefundId = payload?.payload?.refund?.entity?.id ?? payload?.event_object?.refund?.refund_id;
        const pending = await this._refundRepo.find({ where: { PaymentId: paymentId, Status: RefundStatus.Pending } });
        const target  = pending.find((r) => r.ProviderRefundId === providerRefundId) ?? pending[0];
        if (!target) {
            logger.warn(`Refund webhook for payment=${paymentId} matched no pending refund`);
            return;
        }
        target.Status      = RefundStatus.Processed;
        target.ProcessedAt = new Date();
        await this._refundRepo.save(target);
        logger.info(`Refund ${target.id} marked processed by webhook`);
    };

    private isSuccessEvent = (provider: string, eventType: string): boolean =>
        provider === PaymentProvider.Razorpay
            ? eventType === 'payment.captured'
            //Zoho sends 'payment.succeeded' — not 'payment.success'.
            : eventType === 'payment.succeeded';

    private isFailureEvent = (eventType: string): boolean => eventType === 'payment.failed';

    private isRefundEvent = (eventType: string): boolean =>
        ['refund.processed', 'refund.succeeded'].includes(eventType);
}
