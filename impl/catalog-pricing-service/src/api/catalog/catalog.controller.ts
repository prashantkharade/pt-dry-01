import express from 'express';
import { container } from 'tsyringe';
import { CatalogService } from '../../database/typeorm/services/catalog.service';
import { ResponseHandler } from '../../common/handlers/response.handler';

export class CatalogController {

    private _catalog = container.resolve(CatalogService);

    public listServiceTypes = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const items = await this._catalog.listServiceTypes();
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listCategories = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const items = await this._catalog.listCategories(u.TenantId);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listItems = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u           = request.currentUser;
            const service     = (request.query.Service ?? request.query.service) as string | undefined;
            const includeRaw  = (request.query.IncludeVendor ?? request.query.includeVendor) as string | undefined;
            const includeVendor = includeRaw === '1' || u.Roles.includes('Vendor');
            const items = await this._catalog.listItems(u.TenantId, service, includeVendor);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public getItem = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u   = request.currentUser;
            const dto = await this._catalog.getItemById(u.TenantId, request.params.id);
            return ResponseHandler.success(request, response, 'OK', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
