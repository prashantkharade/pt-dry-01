import express from 'express';
import { container } from 'tsyringe';
import { PaymentService } from '../../database/typeorm/services/payment.service';
import { WalletService } from '../../database/typeorm/services/wallet.service';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { PaymentValidator } from './payment.validator';

export class PaymentController {

    private _payments = container.resolve(PaymentService);
    private _wallets  = container.resolve(WalletService);

    //  POST /payments/initiate — split across wallet + gateway, return what
    //  the client needs to open checkout (or that it's already fully paid).
    public initiate = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await PaymentValidator.validateInitiate(request);
            const dto   = await this._payments.initiate({ ...input, TenantId: u.TenantId });
            return ResponseHandler.created(request, response, 'Payment initiated', dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  POST /payments/:id/verify — the client came back from checkout.
    //  Signature-verified, then re-fetched from the provider.
    public verify = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await PaymentValidator.validateVerify(request);
            const dto   = await this._payments.verifyAndCapture(
                request.params.id, input.ProviderPaymentId, input.Signature);
            return ResponseHandler.success(request, response, `Payment ${dto.Status}`, 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public markCash = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await PaymentValidator.validateMarkCash(request);
            const dto   = await this._payments.markCash({ ...input, TenantId: u.TenantId }, u.UserId);
            return ResponseHandler.created(request, response, 'Cash payment recorded', dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listForOrder = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const items = await this._payments.listForOrder(request.params.orderId);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  --- Refunds ---------------------------------------------------------

    public refund = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await PaymentValidator.validateRefund(request);
            const dto   = await this._payments.refund({
                ...input, TenantId: u.TenantId, PaymentId: request.params.id, RequestedBy: u.UserId,
            });
            return ResponseHandler.created(request, response, `Refund ${dto.Status}`, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listRefunds = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const items = await this._payments.listRefunds(request.params.id);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  --- Wallet ----------------------------------------------------------

    public walletBalance = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u         = request.currentUser;
            const wallet    = await this._wallets.getBalance(u.TenantId, request.params.customerId);
            const spendable = await this._wallets.spendable(u.TenantId, request.params.customerId);
            return ResponseHandler.success(request, response, 'OK', 200, {
                BalanceInr    : wallet.BalanceInr,
                //Balance minus the credit floor: what they can actually spend
                //right now. For a B2B vendor this exceeds the balance.
                SpendableInr  : spendable,
                MinBalanceInr : wallet.MinBalanceInr,
                IsActive      : wallet.IsActive,
            });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public walletTopUp = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await PaymentValidator.validateTopUp(request);
            const txn   = await this._wallets.credit({
                TenantId       : u.TenantId,
                CustomerId     : request.params.customerId,
                AmountInr      : input.AmountInr,
                Reason         : input.Reason,
                //Caller-supplied key so a retried top-up cannot credit twice.
                IdempotencyKey : input.IdempotencyKey,
                Description    : input.Description,
                CreatedBy      : u.UserId,
            });
            return ResponseHandler.created(request, response, 'Wallet credited', txn);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public walletHistory = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const items = await this._wallets.history(u.TenantId, request.params.customerId);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public setCreditLimit = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u      = request.currentUser;
            const input  = await PaymentValidator.validateCreditLimit(request);
            const wallet = await this._wallets.setCreditLimit(u.TenantId, request.params.customerId, input.CreditLimitInr);
            return ResponseHandler.success(request, response, 'Credit limit set', 200, wallet);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /payments/wallet/:customerId/reconcile — re-derive the balance from
    //  the ledger. Cheap insurance against silent drift in a money column.
    public walletReconcile = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u      = request.currentUser;
            const result = await this._wallets.reconcile(u.TenantId, request.params.customerId);
            return ResponseHandler.success(request, response, 'OK', 200, result);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
