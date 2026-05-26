import { injectable } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { Role } from '../models/role.model';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Read surface for system roles (SystemAdmin, Receptionist, Customer,
//  Vendor). Writes happen exclusively through the seeder.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class RoleService {

    private _roleRepo = Source.getRepository(Role);

    public listAll = async (): Promise<Role[]> => {
        return this._roleRepo.find({ order: { Code: 'ASC' } });
    };

    public getByCode = async (code: string): Promise<Role> => {
        const role = await this._roleRepo.findOne({ where: { Code: code } });
        if (!role) ErrorHandler.throwNotFoundError(`Role not found: ${code}`);
        return role;
    };
}
