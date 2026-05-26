import express from 'express';
import { container } from 'tsyringe';
import { RateCardService } from '../../database/typeorm/services/rate.card.service';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { RateCardValidator } from './rate.card.validator';

export class RateCardController {

    private _rates = container.resolve(RateCardService);

    public list = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const items = await this._rates.listForTenant(u.TenantId);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public create = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await RateCardValidator.validateCreate(request);
            const dto   = await this._rates.create({ ...input, TenantId: u.TenantId }, u.UserId);
            return ResponseHandler.created(request, response, 'Rate created', dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
