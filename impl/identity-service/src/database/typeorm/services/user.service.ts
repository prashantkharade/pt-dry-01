import { injectable } from 'tsyringe';
import { ILike } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { User } from '../models/user.model';
import { UserRole } from '../models/user.role.model';
import { Role } from '../models/role.model';
import { BaseService } from './base.service';
import { UserMapper } from '../mappers/user.mapper';
import {
    UserCreateModel, UserDto, UserSearchFilters, UserUpdateModel,
} from '../../../domain.types/users/user.types';
import { BaseSearchResults } from '../../../domain.types/miscellaneous/search.types';

/////////////////////////////////////////////////////////////////////////
//  Application service for User aggregate. Persists via TypeORM
//  repositories and returns DTOs via the mapper.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class UserService extends BaseService {

    private _userRepo     = Source.getRepository(User);
    private _userRoleRepo = Source.getRepository(UserRole);
    private _roleRepo     = Source.getRepository(Role);

    public create = async (model: UserCreateModel): Promise<UserDto> => {
        const entity = this._userRepo.create({
            TenantId         : model.TenantId,
            BranchId         : model.BranchId,
            FirstName        : model.FirstName,
            LastName         : model.LastName ?? null,
            Email            : model.Email ?? null,
            Phone            : model.Phone ?? null,
            PasswordHash     : model.PasswordHash ?? null,
            PreferredLanguage: model.PreferredLanguage ?? 'en',
            IsActive         : true,
        });
        const saved = await this._userRepo.save(entity);
        return this.getById(saved.id);
    };

    public getById = async (id: string): Promise<UserDto> => {
        const user = await this._userRepo.findOne({ where: { id } });
        if (!user) return null;
        const roles = await this.getRoleCodes(user.id);
        return UserMapper.toDto(user, roles);
    };

    public getByEmail = async (email: string): Promise<User> => {
        return this._userRepo.findOne({ where: { Email: email.toLowerCase() } });
    };

    public getByPhone = async (phone: string): Promise<User> => {
        return this._userRepo.findOne({ where: { Phone: phone } });
    };

    public getRoleCodes = async (userId: string): Promise<string[]> => {
        const rows = await this._userRoleRepo
            .createQueryBuilder('ur')
            .innerJoin(Role, 'r', 'r.id = ur."RoleId"')
            .select('r."Code"', 'code')
            .where('ur."UserId" = :uid', { uid: userId })
            .getRawMany<{ code: string }>();
        return rows.map((r) => r.code);
    };

    public update = async (id: string, model: UserUpdateModel): Promise<UserDto> => {
        const user = await this._userRepo.findOne({ where: { id } });
        if (!user) return null;
        if (model.FirstName !== undefined)         user.FirstName = model.FirstName;
        if (model.LastName !== undefined)          user.LastName = model.LastName;
        if (model.Email !== undefined)             user.Email = model.Email;
        if (model.PreferredLanguage !== undefined) user.PreferredLanguage = model.PreferredLanguage;
        if (model.ProfileImageUrl !== undefined)   user.ProfileImageUrl = model.ProfileImageUrl;
        if (model.ThemePrefs !== undefined)        user.ThemePrefs = model.ThemePrefs;
        await this._userRepo.save(user);
        return this.getById(user.id);
    };

    public touchLogin = async (id: string): Promise<void> => {
        await this._userRepo.update({ id }, { LastLoginAt: new Date() });
    };

    public assignRole = async (userId: string, roleId: string, tenantId: string, branchId?: string): Promise<void> => {
        const existing = await this._userRoleRepo.findOne({ where: { UserId: userId, RoleId: roleId, TenantId: tenantId } });
        if (existing) return;
        await this._userRoleRepo.save(this._userRoleRepo.create({
            UserId: userId, RoleId: roleId, TenantId: tenantId, BranchId: branchId,
        }));
    };

    public search = async (filters: UserSearchFilters): Promise<BaseSearchResults<UserDto>> => {
        const where: any = {};
        if (filters.TenantId) where.TenantId = filters.TenantId;
        if (filters.BranchId) where.BranchId = filters.BranchId;
        if (filters.Phone)    where.Phone    = filters.Phone;
        if (filters.Email)    where.Email    = ILike(filters.Email.toLowerCase());
        if (filters.NameLike) where.FirstName = ILike(`%${filters.NameLike}%`);

        const pageIndex = this.pageIndex(filters.PageIndex);
        const pageSize  = this.pageSize(filters.ItemsPerPage);

        const [items, total] = await this._userRepo.findAndCount({
            where,
            skip : pageIndex * pageSize,
            take : pageSize,
            order: { CreatedAt: 'DESC' },
        });
        const dtos: UserDto[] = [];
        for (const u of items) {
            const roles = await this.getRoleCodes(u.id);
            dtos.push(UserMapper.toDto(u, roles));
        }
        return { Items: dtos, Total: total, PageIndex: pageIndex, ItemsPerPage: pageSize };
    };
}
