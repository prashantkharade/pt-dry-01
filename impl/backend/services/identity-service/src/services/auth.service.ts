import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { dataSource } from '../database/data-source';
import { User } from '../database/models/user.entity';
import { UserRole } from '../database/models/user-role.entity';
import { Role } from '../database/models/role.entity';
import { Customer } from '../database/models/customer.entity';
import { Tenant } from '../database/models/tenant.entity';
import { Branch } from '../database/models/branch.entity';
import { ApiError, Jwt } from '@ptk/shared';
import { redis } from './redis';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tenantId: string;
    branchId: string;
    roles: string[];
    preferredLanguage: string;
    profileImageUrl?: string;
  };
}

async function bootstrapCustomerUser(phone: string): Promise<User> {
  // Auto-provision a Customer user on first successful OTP login.
  const tenant = await dataSource.getRepository(Tenant).findOneByOrFail({});
  const branch = await dataSource.getRepository(Branch).findOneByOrFail({ TenantId: tenant.id });
  const customerRole = await dataSource.getRepository(Role).findOneByOrFail({ Code: 'Customer' });

  const user = dataSource.getRepository(User).create({
    TenantId: tenant.id,
    BranchId: branch.id,
    FirstName: 'Customer',
    Phone: phone,
    PhoneVerifiedAt: new Date(),
    PreferredLanguage: 'en',
    IsActive: true,
  });
  await dataSource.getRepository(User).save(user);

  await dataSource.getRepository(UserRole).save({
    UserId: user.id,
    RoleId: customerRole.id,
    TenantId: tenant.id,
    BranchId: branch.id,
  });

  // Create customer profile too.
  const code = `PTK-CUST-${String(Date.now()).slice(-6)}`;
  await dataSource.getRepository(Customer).save({
    TenantId: tenant.id,
    BranchId: branch.id,
    UserId: user.id,
    CustomerCode: code,
    CustomerType: 'Retail',
    Name: 'Customer',
    Phone: phone,
  });

  return user;
}

async function rolesFor(userId: string): Promise<string[]> {
  const rows = await dataSource
    .getRepository(UserRole)
    .createQueryBuilder('ur')
    .innerJoin(Role, 'r', 'r.id = ur."RoleId"')
    .select('r."Code"', 'code')
    .where('ur."UserId" = :uid', { uid: userId })
    .getRawMany<{ code: string }>();
  return rows.map((r) => r.code);
}

async function issueTokens(user: User, roles: string[]): Promise<LoginResult> {
  const sessionId = randomUUID();
  const base = {
    userId: user.id,
    tenantId: user.TenantId,
    branchId: user.BranchId,
    sessionId,
    roles,
  };
  const accessToken = Jwt.signAccess(base);
  const refreshToken = Jwt.signRefresh(base);

  // Persist session for revocation / lookup.
  await redis().set(
    `session:${user.id}:${sessionId}`,
    JSON.stringify(base),
    'EX',
    60 * 60,
  );

  user.LastLoginAt = new Date();
  await dataSource.getRepository(User).save(user);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
      phone: user.Phone,
      tenantId: user.TenantId,
      branchId: user.BranchId,
      roles,
      preferredLanguage: user.PreferredLanguage,
      profileImageUrl: user.ProfileImageUrl,
    },
  };
}

export const AuthService = {
  async loginPassword(emailOrPhone: string, password: string): Promise<LoginResult> {
    const repo = dataSource.getRepository(User);
    const isEmail = emailOrPhone.includes('@');
    const user = isEmail
      ? await repo.findOne({ where: { Email: emailOrPhone.toLowerCase() } })
      : await repo.findOne({ where: { Phone: emailOrPhone } });
    if (!user || !user.PasswordHash) throw ApiError.unauthorized('Invalid credentials');
    if (!user.IsActive) throw ApiError.forbidden('User is inactive');

    const ok = await argon2.verify(user.PasswordHash, password);
    if (!ok) throw ApiError.unauthorized('Invalid credentials');

    const roles = await rolesFor(user.id);
    return issueTokens(user, roles);
  },

  async loginAfterOtp(phone: string): Promise<LoginResult> {
    let user = await dataSource.getRepository(User).findOne({ where: { Phone: phone } });
    if (!user) user = await bootstrapCustomerUser(phone);
    user.PhoneVerifiedAt = user.PhoneVerifiedAt ?? new Date();
    await dataSource.getRepository(User).save(user);

    const roles = await rolesFor(user.id);
    return issueTokens(user, roles);
  },

  async logout(userId: string, sessionId: string): Promise<void> {
    await redis().del(`session:${userId}:${sessionId}`);
  },
};
