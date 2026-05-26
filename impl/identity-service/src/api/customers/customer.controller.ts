import express from 'express';
import { container } from 'tsyringe';
import { CustomerService } from '../../database/typeorm/services/customer.service';
import { CustomerValidator } from './customer.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { ErrorHandler } from '../../common/api.error';

export class CustomerController {

    private _customers = container.resolve(CustomerService);

    public create = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await CustomerValidator.validateCreate(request);
            const dto   = await this._customers.create({
                ...input,
                TenantId: u.TenantId,
                BranchId: u.BranchId,
            });
            return ResponseHandler.created(request, response, 'Customer created', dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public search = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u       = request.currentUser;
            const filters = await CustomerValidator.validateSearch(request);
            const results = await this._customers.search({ ...filters, TenantId: u.TenantId });
            return ResponseHandler.success(request, response, 'OK', 200, results);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public getById = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const dto = await this._customers.getById(request.params.id);
            if (!dto) ErrorHandler.throwNotFoundError('Customer not found');
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public update = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const model = await CustomerValidator.validateUpdate(request);
            const dto   = await this._customers.update(request.params.id, model);
            if (!dto) ErrorHandler.throwNotFoundError('Customer not found');
            return ResponseHandler.success(request, response, 'Customer updated', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public getInternal = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const dto = await this._customers.getById(request.params.id);
            if (!dto) ErrorHandler.throwNotFoundError('Customer not found');
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
