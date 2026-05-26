import express from 'express';
import { container } from 'tsyringe';
import { TenantService } from '../../database/typeorm/services/tenant.service';
import { ResponseHandler } from '../../common/handlers/response.handler';

export class TenantController {

    private _tenants = container.resolve(TenantService);

    public getCurrent = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const tenant = await this._tenants.getDefaultTenant();
            return ResponseHandler.success(request, response, 'OK', 200, tenant);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listBranches = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u        = request.currentUser;
            const branches = await this._tenants.getBranchesForTenant(u.TenantId);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: branches, Total: branches.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
