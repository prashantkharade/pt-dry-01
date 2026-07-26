import express from 'express';
import { container } from 'tsyringe';
import { OrderService } from '../../database/typeorm/services/order.service';
import { IdentityServiceConnector } from '../../modules/identity/identity.service.connector';
import { OrderValidator } from './order.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { ErrorHandler } from '../../common/api.error';

export class OrderController {

    private _orders   = container.resolve(OrderService);
    private _identity = container.resolve(IdentityServiceConnector);

    private static bearer = (request: express.Request): string =>
        request.headers.authorization?.slice('Bearer '.length).trim() ?? '';

    private static isOps = (request: express.Request): boolean =>
        request.currentUser.Roles.some((r) => r === 'SystemAdmin' || r === 'Receptionist');

    /**
     * The CustomerId of the caller themselves, or null for staff.
     *
     * The JWT carries a UserId, not a CustomerId, so the app has to ask
     * identity "who am I". Crucially it is resolved from the TOKEN and never
     * from the request: a client-supplied CustomerId is a request, not an
     * identity claim, and trusting one lets any customer read any other
     * customer's orders by guessing an id.
     */
    private callerCustomerId = async (request: express.Request): Promise<string | null> => {
        if (OrderController.isOps(request)) return null;
        const me = await this._identity.getMyCustomer(OrderController.bearer(request));
        return me?.id ?? null;
    };

    public create = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await OrderValidator.validateCreate(request);
            const u     = request.currentUser;

            //A customer may only order for themselves. Staff book on behalf of
            //anyone — that IS the receptionist's job.
            const mine = await this.callerCustomerId(request);
            if (mine && input.CustomerId !== mine) {
                ErrorHandler.throwForbiddenError('You can only place orders for yourself');
            }

            const order = await this._orders.create(input, u.UserId, OrderController.bearer(request));
            return ResponseHandler.created(request, response, 'Order created', order);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public search = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const filters = await OrderValidator.validateSearch(request);
            const u       = request.currentUser;

            //Search is a staff tool. If a customer reaches it, silently narrow
            //it to their own orders rather than handing over the whole tenant.
            const mine = await this.callerCustomerId(request);
            const result = await this._orders.list({
                ...filters,
                TenantId  : u.TenantId,
                CustomerId: mine ?? filters.CustomerId,
            });
            return ResponseHandler.success(request, response, 'OK', 200, result);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /orders/mine — the caller's own orders.
    public listMine = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u = request.currentUser;

            //Resolved from the token. The old behaviour took CustomerId from
            //the query string and returned that customer's orders to whoever
            //asked — any signed-in user could read anyone's history.
            const mine = await this.callerCustomerId(request);
            //Staff calling /mine may name a customer; a customer cannot.
            const customerId = mine ?? (request.query.CustomerId as string | undefined);
            if (!customerId) ErrorHandler.throwNotFoundError('No customer profile for this user');

            const filters = await OrderValidator.validateSearch(request);
            const result  = await this._orders.list({
                ...filters,
                TenantId  : u.TenantId,
                CustomerId: customerId,
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

            const mine = await this.callerCustomerId(request);
            if (mine && dto.CustomerId !== mine) {
                //404, not 403: a 403 confirms the order exists, which lets
                //someone enumerate order ids.
                ErrorHandler.throwNotFoundError('Order not found');
            }
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /orders/summary — aggregates over the same filters as the list,
    //  so the dashboard's numbers always match its own table.
    public summary = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const filters = await OrderValidator.validateSearch(request);
            const u       = request.currentUser;
            const mine    = await this.callerCustomerId(request);
            const dto = await this._orders.summary({
                ...filters, TenantId: u.TenantId, CustomerId: mine ?? filters.CustomerId,
            });
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /orders/:id/tracking — the customer-facing journey.
    public tracking = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u   = request.currentUser;
            const mine = await this.callerCustomerId(request);
            const dto = await this._orders.tracking(u.TenantId, request.params.id, mine);
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
