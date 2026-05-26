import { injectable } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { Tenant } from '../models/tenant.model';
import { Branch } from '../models/branch.model';
import { BaseService } from './base.service';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Tenant + Branch read/write surface. Today the system runs as a single
//  tenant ("PT Kharade") with one branch ("Mukundnagar Shop") seeded; the
//  service is structured for multi-branch growth.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class TenantService extends BaseService {

    private _tenantRepo = Source.getRepository(Tenant);
    private _branchRepo = Source.getRepository(Branch);

    public getDefaultTenant = async (): Promise<Tenant> => {
        const t = await this._tenantRepo.findOne({ where: {} });
        if (!t) ErrorHandler.throwNotFoundError('Default tenant not found — seeder did not run?');
        return t;
    };

    public getDefaultBranch = async (tenantId: string): Promise<Branch> => {
        const b = await this._branchRepo.findOne({ where: { TenantId: tenantId } });
        if (!b) ErrorHandler.throwNotFoundError('Default branch not found');
        return b;
    };

    public getBranchesForTenant = async (tenantId: string): Promise<Branch[]> => {
        return this._branchRepo.find({ where: { TenantId: tenantId, IsActive: true } });
    };
}
