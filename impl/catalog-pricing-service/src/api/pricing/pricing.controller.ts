import express from 'express';
import { container } from 'tsyringe';
import { PricingService } from '../../database/typeorm/services/pricing.service';
import { PricingValidator } from './pricing.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';

export class PricingController {

    private _pricing = container.resolve(PricingService);

    public quote = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await PricingValidator.validateQuote(request);
            const quote = await this._pricing.quote({ ...input, TenantId: u.TenantId });
            return ResponseHandler.success(request, response, 'Quote computed', 200, quote);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listSurcharges = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const items = await this._pricing.listSurcharges(u.TenantId);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
