import express from 'express';
import { container } from 'tsyringe';
import { UserService } from '../../database/typeorm/services/user.service';
import { UserValidator } from './user.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { ErrorHandler } from '../../common/api.error';

export class UserController {

    private _users = container.resolve(UserService);

    public getMe = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u = request.currentUser;
            const dto = await this._users.getById(u.UserId);
            if (!dto) ErrorHandler.throwNotFoundError('User not found');
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public updateMe = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const model = await UserValidator.validateUpdateMe(request);
            const dto   = await this._users.update(u.UserId, model);
            return ResponseHandler.success(request, response, 'User updated', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public getLookup = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const roles = await this._users.getRoleCodes(u.UserId);
            return ResponseHandler.success(request, response, 'OK', 200, { Roles: roles });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public getById = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const dto = await this._users.getById(request.params.id);
            if (!dto) ErrorHandler.throwNotFoundError('User not found');
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public search = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u       = request.currentUser;
            const filters = await UserValidator.validateSearch(request);
            const results = await this._users.search({ ...filters, TenantId: u.TenantId });
            return ResponseHandler.success(request, response, 'OK', 200, results);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
