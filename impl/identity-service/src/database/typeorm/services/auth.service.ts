import { injectable, inject } from 'tsyringe';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Source } from '../typeorm.database.connector';
import { User } from '../models/user.model';
import { UserRole } from '../models/user.role.model';
import { Customer } from '../models/customer.model';
import { UserService } from './user.service';
import { TenantService } from './tenant.service';
import { RoleService } from './role.service';
import { JwtService } from './jwt.service';
import { redis } from '../../../common/cache/redis.cache';
import { ErrorHandler } from '../../../common/api.error';
import { LoginResultDto } from '../../../domain.types/auth/auth.types';
import { StringUtils } from '../../../common/utilities/string.utils';
import { ConfigurationManager } from '../../../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  AuthService — password login (admin/receptionist), post-OTP login
//  (customer app), and session revocation. Sessions are stored in Redis
//  keyed by `session:<userId>:<sessionId>` so a future "logout other
//  devices" feature can list and revoke them cheaply.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class AuthService {

    constructor(
        @inject(UserService)    private _users:   UserService,
        @inject(TenantService)  private _tenants: TenantService,
        @inject(RoleService)    private _roles:   RoleService,
        @inject(JwtService)     private _jwt:     JwtService,
    ) {}

    private _userRepo     = Source.getRepository(User);
    private _userRoleRepo = Source.getRepository(UserRole);
    private _customerRepo = Source.getRepository(Customer);

    private bootstrapCustomerUser = async (phone: string): Promise<User> => {
        const tenant   = await this._tenants.getDefaultTenant();
        const branch   = await this._tenants.getDefaultBranch(tenant.id);
        const role     = await this._roles.getByCode('Customer');

        const user = await this._userRepo.save(this._userRepo.create({
            TenantId         : tenant.id,
            BranchId         : branch.id,
            FirstName        : 'Customer',
            Phone            : phone,
            PhoneVerifiedAt  : new Date(),
            PreferredLanguage: 'en',
            IsActive         : true,
        }));
        await this._users.assignRole(user.id, role.id, tenant.id, branch.id);
        await this._customerRepo.save(this._customerRepo.create({
            TenantId    : tenant.id,
            BranchId    : branch.id,
            UserId      : user.id,
            CustomerCode: StringUtils.generateCustomerCode(),
            CustomerType: 'Retail',
            Name        : 'Customer',
            Phone       : phone,
        }));
        return user;
    };

    private issueTokens = async (user: User, roles: string[]): Promise<LoginResultDto> => {
        const sessionId = randomUUID();
        const base = { UserId: user.id, TenantId: user.TenantId, BranchId: user.BranchId, SessionId: sessionId, Roles: roles };
        const accessToken  = this._jwt.signAccess(base);
        const refreshToken = this._jwt.signRefresh(base);

        await redis().set(
            `session:${user.id}:${sessionId}`,
            JSON.stringify(base),
            ConfigurationManager.Auth.RefreshTokenExpiresInSeconds,
        );
        await this._users.touchLogin(user.id);

        return {
            AccessToken : accessToken,
            RefreshToken: refreshToken,
            User: {
                id               : user.id,
                FirstName        : user.FirstName,
                LastName         : user.LastName,
                Email            : user.Email,
                Phone            : user.Phone,
                TenantId         : user.TenantId,
                BranchId         : user.BranchId,
                Roles            : roles,
                PreferredLanguage: user.PreferredLanguage,
                ProfileImageUrl  : user.ProfileImageUrl,
            },
        };
    };

    public loginPassword = async (emailOrPhone: string, password: string): Promise<LoginResultDto> => {
        const isEmail = StringUtils.isEmail(emailOrPhone);
        const user = isEmail
            ? await this._users.getByEmail(StringUtils.normalizeEmail(emailOrPhone))
            : await this._users.getByPhone(emailOrPhone);
        if (!user || !user.PasswordHash) ErrorHandler.throwUnauthorizedError('Invalid credentials');
        if (!user.IsActive)              ErrorHandler.throwForbiddenError('User is inactive');

        const ok = await argon2.verify(user.PasswordHash, password);
        if (!ok) ErrorHandler.throwUnauthorizedError('Invalid credentials');

        const roles = await this._users.getRoleCodes(user.id);
        return this.issueTokens(user, roles);
    };

    public loginAfterOtp = async (phone: string): Promise<LoginResultDto> => {
        let user = await this._users.getByPhone(phone);
        if (!user) user = await this.bootstrapCustomerUser(phone);
        if (!user.PhoneVerifiedAt) {
            user.PhoneVerifiedAt = new Date();
            await this._userRepo.save(user);
        }
        const roles = await this._users.getRoleCodes(user.id);
        return this.issueTokens(user, roles);
    };

    public logout = async (userId: string, sessionId: string): Promise<void> => {
        await redis().del(`session:${userId}:${sessionId}`);
    };
}
