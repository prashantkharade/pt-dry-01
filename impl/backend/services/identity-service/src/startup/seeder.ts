import argon2 from 'argon2';
import { Logger, ConfigurationManager } from '@ptk/shared';
import { dataSource } from '../database/data-source';
import { Tenant } from '../database/models/tenant.entity';
import { Branch } from '../database/models/branch.entity';
import { Role } from '../database/models/role.entity';
import { User } from '../database/models/user.entity';
import { UserRole } from '../database/models/user-role.entity';
import { ClientApp } from '../database/models/client-app.entity';

export async function seed(): Promise<void> {
  await seedTenantAndBranch();
  await seedRoles();
  await seedSystemAdmin();
  await seedClientApps();
}

async function seedTenantAndBranch() {
  const tenantRepo = dataSource.getRepository(Tenant);
  let tenant = await tenantRepo.findOne({ where: {} });
  if (!tenant) {
    tenant = await tenantRepo.save({
      Name: 'PT Kharade Group of Industries',
      LegalName: 'PT Kharade Group of Industries',
      IsActive: true,
    });
    Logger.info('seed.tenant.created', { id: tenant.id });
  }
  const branchRepo = dataSource.getRepository(Branch);
  let branch = await branchRepo.findOne({ where: { TenantId: tenant.id, Code: 'MNG-01' } });
  if (!branch) {
    branch = await branchRepo.save({
      TenantId: tenant.id,
      Code: 'MNG-01',
      Name: 'Mukundnagar Shop',
      AddressLine: 'Mukundnagar, Pune',
      City: 'Pune',
      State: 'Maharashtra',
      Pincode: '411037',
      Phone: '+919876543210',
      IsActive: true,
    });
    Logger.info('seed.branch.created', { id: branch.id });
  }
}

async function seedRoles() {
  const repo = dataSource.getRepository(Role);
  const wanted = [
    { Code: 'SystemAdmin', Name: 'System Admin', Description: 'Full access' },
    { Code: 'Receptionist', Name: 'Receptionist', Description: 'Order intake, billing, status updates' },
    { Code: 'Customer', Name: 'Customer', Description: 'Self-service via app' },
    { Code: 'Vendor', Name: 'Vendor', Description: 'B2B customer with credit terms' },
  ];
  for (const r of wanted) {
    const existing = await repo.findOne({ where: { Code: r.Code } });
    if (!existing) {
      await repo.save({ ...r, IsSystem: true });
      Logger.info('seed.role.created', { code: r.Code });
    }
  }
}

async function seedSystemAdmin() {
  const email = ConfigurationManager.get('SEED_ADMIN_EMAIL', 'admin@ptkharade.in').toLowerCase();
  const phone = ConfigurationManager.get('SEED_ADMIN_PHONE', '+919999900001');
  const password = ConfigurationManager.get('SEED_ADMIN_PASSWORD', 'Admin@12345');

  const userRepo = dataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: { Email: email } });
  if (existing) return;

  const tenant = await dataSource.getRepository(Tenant).findOneByOrFail({});
  const branch = await dataSource.getRepository(Branch).findOneByOrFail({ TenantId: tenant.id });
  const adminRole = await dataSource.getRepository(Role).findOneByOrFail({ Code: 'SystemAdmin' });
  const receptionistRole = await dataSource.getRepository(Role).findOneByOrFail({ Code: 'Receptionist' });

  const passwordHash = await argon2.hash(password);
  const user = await userRepo.save({
    TenantId: tenant.id,
    BranchId: branch.id,
    FirstName: 'PT',
    LastName: 'Admin',
    Email: email,
    Phone: phone,
    PasswordHash: passwordHash,
    PasswordChangedAt: new Date(),
    EmailVerifiedAt: new Date(),
    PhoneVerifiedAt: new Date(),
    PreferredLanguage: 'en',
    IsActive: true,
  });

  // Grant SystemAdmin + Receptionist (so admin can also do receptionist work).
  for (const role of [adminRole, receptionistRole]) {
    await dataSource.getRepository(UserRole).save({
      UserId: user.id,
      RoleId: role.id,
      TenantId: tenant.id,
      BranchId: branch.id,
    });
  }
  Logger.info('seed.systemAdmin.created', { email });
}

async function seedClientApps() {
  const repo = dataSource.getRepository(ClientApp);
  const want = [
    { ClientCode: 'ADMIN-PORTAL', Name: 'Admin Portal', ApiKey: ConfigurationManager.get('API_KEY_ADMIN_PORTAL') },
    { ClientCode: 'CUSTOMER-APP', Name: 'Customer App', ApiKey: ConfigurationManager.get('API_KEY_CUSTOMER_APP') },
    { ClientCode: 'ORDERS-SERVICE', Name: 'Orders Service', ApiKey: ConfigurationManager.get('API_KEY_ORDERS_SERVICE') },
  ];
  for (const w of want) {
    const ex = await repo.findOne({ where: { ClientCode: w.ClientCode } });
    if (!ex) {
      await repo.save({ ...w, IsActive: true });
      Logger.info('seed.clientApp.created', { code: w.ClientCode });
    }
  }
}
