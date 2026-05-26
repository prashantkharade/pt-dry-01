import express from 'express';
import { container } from 'tsyringe';
import { OrderService } from '../../database/typeorm/services/order.service';
import { OrderValidator } from './order.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { ErrorHandler } from '../../common/api.error';

export class OrderController {

    private _orders = container.resolve(OrderService);

    public create = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await OrderValidator.validateCreate(request);
            const u     = request.currentUser;
            const accessToken = request.headers.authorization?.slice('Bearer '.length).trim() ?? '';
            const order = await this._orders.create(input, u.UserId, accessToken);
            return ResponseHandler.created(request, response, 'Order created', order);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public search = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const filters = await OrderValidator.validateSearch(request);
            const u       = request.currentUser;
            const result  = await this._orders.list({ ...filters, TenantId: u.TenantId });
            return ResponseHandler.success(request, response, 'OK', 200, result);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listMine = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u           = request.currentUser;
            const customerId  = request.query.CustomerId as string;
            if (!customerId) ErrorHandler.throwInputValidationError(['CustomerId is required']);
            const result = await this._orders.list({
                TenantId    : u.TenantId,
                CustomerId  : customerId,
                PageIndex   : request.query.PageIndex    ? Number(request.query.PageIndex)    : undefined,
                ItemsPerPage: request.query.ItemsPerPage ? Number(request.query.ItemsPerPage) : undefined,
            });
            return ResponseHandler.success(request, response, 'OK', 200, result);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public getById = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u   = request.currentUser;
            const dto = await this._orders.getById(u.TenantId, request.params.id);
            if (!dto) ErrorHandler.throwNotFoundError('Order not found');
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public updateStatus = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const body = await OrderValidator.validateStatusUpdate(request);
            const u    = request.currentUser;
            const dto  = await this._orders.updateStatus(
                u.TenantId,
                request.params.id,
                body.Status,
                u.UserId,
                u.DisplayName ?? u.UserId,
                body.Note,
            );
            return ResponseHandler.success(request, response, `Order status → ${body.Status}`, 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
