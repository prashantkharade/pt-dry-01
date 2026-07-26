import express from 'express';
import joi from 'joi';
import { ErrorHandler } from '../../common/api.error';
import { PaymentProvider, WalletTxnReason } from '../../domain.types/enums/payment.enums';

//  Money arrives as a decimal string or number and is parsed to paise by
//  Money.toPaise. Two decimals max — a third would be silently rounded, and
//  rejecting is better than quietly charging a different amount.
const MoneySchema = joi.alternatives().try(
    joi.number().precision(2).greater(0),
    joi.string().pattern(/^\d+(\.\d{1,2})?$/).message('Amount must be a number with at most 2 decimals'),
);

export class PaymentValidator {

    private static run = async <T>(schema: joi.ObjectSchema, payload: unknown): Promise<T> => {
        try {
            return await schema.validateAsync(payload, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateInitiate = async (request: express.Request) =>
        PaymentValidator.run<any>(joi.object({
            OrderId    : joi.string().uuid().required(),
            OrderCode  : joi.string().max(32).required(),
            CustomerId : joi.string().uuid().required(),
            AmountInr  : MoneySchema.required(),
            Provider   : joi.string().valid(PaymentProvider.Razorpay, PaymentProvider.Zohopay).optional(),
            UseWallet  : joi.boolean().default(false),
            //Where the "payment received" receipt goes. Optional — an internal
            //caller may not have it, and a missing phone just means no receipt.
            CustomerPhone    : joi.string().pattern(/^\+91[6-9]\d{9}$/).message('CustomerPhone must be +91XXXXXXXXXX').optional(),
            CustomerLanguage : joi.string().valid('en', 'mr').optional(),
            Metadata   : joi.object().optional(),
        }), request.body);

    public static validateVerify = async (request: express.Request) =>
        PaymentValidator.run<{ ProviderPaymentId: string; Signature: string }>(joi.object({
            ProviderPaymentId : joi.string().max(128).required(),
            //Razorpay's checkout handshake. Required — a verify without a
            //signature is just a client claiming it paid.
            Signature         : joi.string().max(256).required(),
        }), request.body);

    public static validateMarkCash = async (request: express.Request) =>
        PaymentValidator.run<any>(joi.object({
            OrderId    : joi.string().uuid().required(),
            OrderCode  : joi.string().max(32).required(),
            CustomerId : joi.string().uuid().required(),
            AmountInr  : MoneySchema.required(),
            CustomerPhone    : joi.string().pattern(/^\+91[6-9]\d{9}$/).message('CustomerPhone must be +91XXXXXXXXXX').optional(),
            CustomerLanguage : joi.string().valid('en', 'mr').optional(),
        }), request.body);

    public static validateRefund = async (request: express.Request) =>
        PaymentValidator.run<any>(joi.object({
            AmountInr      : MoneySchema.required(),
            Reason         : joi.string().min(3).max(512).required(),
            //Store credit instead of a gateway refund: instant, no fee.
            ToWallet       : joi.boolean().default(false),
            IdempotencyKey : joi.string().max(128).optional(),
        }), request.body);

    public static validateTopUp = async (request: express.Request) =>
        PaymentValidator.run<any>(joi.object({
            AmountInr      : MoneySchema.required(),
            Reason         : joi.string().valid(WalletTxnReason.TopUp, WalletTxnReason.Adjustment).default(WalletTxnReason.TopUp),
            IdempotencyKey : joi.string().max(128).optional(),
            Description    : joi.string().max(512).optional(),
        }), request.body);

    public static validateCreditLimit = async (request: express.Request) =>
        PaymentValidator.run<{ CreditLimitInr: number }>(joi.object({
            //Stored as a negative floor on the wallet. 0 disables credit.
            CreditLimitInr : joi.number().min(0).max(10_000_000).required(),
        }), request.body);
}
