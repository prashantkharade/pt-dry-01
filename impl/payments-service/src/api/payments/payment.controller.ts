import express from 'express';
import { container } from 'tsyringe';
import { PaymentService } from '../../database/typeorm/services/payment.service';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { PaymentValidator } from './payment.validator';

export class PaymentController {

    private _payments = container.resolve(PaymentService);

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

    public markCash = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await PaymentValidator.validateMarkCash(request);
            const dto   = await this._payments.initiate({ ...input, TenantId: u.TenantId });
            await this._payments.markCaptured(dto.id, `manual_${Date.now()}`);
            return ResponseHandler.created(request, response, 'Cash/UPI payment recorded', dto);
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
}
