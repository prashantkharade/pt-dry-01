import argon2 from 'argon2';
import { Source } from '../database/typeorm/typeorm.database.connector';
import { Tenant }    from '../database/typeorm/models/tenant.model';
import { Branch }    from '../database/typeorm/models/branch.model';
import { Role }      from '../database/typeorm/models/role.model';
import { User }      from '../database/typeorm/models/user.model';
import { UserRole } from '../database/typeorm/models/user.role.model';
import { ClientApp } from '../database/typeorm/models/client.app.model';
import { logger } from '../logger/logger';
import { ConfigurationManager } from '../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Idempotent seeder — runs on every boot, but only writes data that is
//  missing. Seeds tenant, default branch, system roles, the system admin
//  user, and the inter-service client_apps (admin portal, customer app,
//  orders/catalog/payments/notifications).
/////////////////////////////////////////////////////////////////////////

export class Seeder {

    public static seed = async (): Promise<void> => {
        await Seeder.seedTenantAndBranch();
        await Seeder.seedRoles();
        await Seeder.seedSystemAdmin();
        await Seeder.seedClientApps();
        logger.info('Seeder: complete');
    };

    private static seedTenantAndBranch = async (): Promise<void> => {
        const tenantRepo = Source.getRepository(Tenant);
        let tenant = await tenantRepo.findOne({ where: {} });
        if (!tenant) {
            tenant = await tenantRepo.save(tenantRepo.create({
                Name      : 'PT Kharade Group of Industries',
                LegalName : 'PT Kharade Group of Industries',
                IsActive  : true,
            }));
            logger.info(`Seeder: tenant created ${tenant.id}`);
        }
        const branchRepo = Source.getRepository(Branch);
        let branch = await branchRepo.findOne({ where: { TenantId: tenant.id, Code: 'MNG-01' } });
        if (!branch) {
            branch = await branchRepo.save(branchRepo.create({
                TenantId    : tenant.id,
                Code        : 'MNG-01',
                Name        : 'Mukundnagar Shop',
                AddressLine : 'Mukundnagar, Pune',
                City        : 'Pune',
                State       : 'Maharashtra',
                Pincode     : '411037',
                Phone       : '+919876543210',
                IsActive    : true,
            }));
            logger.info(`Seeder: branch created ${branch.id}`);
        }
    };

    private static seedRoles = async (): Promise<void> => {
        const repo = Source.getRepository(Role);
        const wanted = [
            { Code: 'SystemAdmin'  , Name: 'System Admin'  , Description: 'Full access' },
            { Code: 'Receptionist' , Name: 'Receptionist'  , Description: 'Order intake, billing, status updates' },
            { Code: 'Customer'     , Name: 'Customer'      , Description: 'Self-service via mobile/web app' },
            { Code: 'Vendor'       , Name: 'Vendor'        , Description: 'B2B customer with credit terms' },
            //  Pickup/drop staff. They sign in to the admin portal and see only
            //  their own runs — see orders-service DeliveryAuth.myRuns.
            { Code: 'DeliveryPartner', Name: 'Delivery Partner', Description: 'Collects and returns garments; sees only their own runs' },
        ];
        for (const r of wanted) {
            const existing = await repo.findOne({ where: { Code: r.Code } });
            if (!existing) {
                await repo.save(repo.create({ ...r, IsSystem: true }));
                logger.info(`Seeder: role created ${r.Code}`);
            }
        }
    };

    private static seedSystemAdmin = async (): Promise<void> => {
        const email    = ConfigurationManager.getEnv('SEED_ADMIN_EMAIL'   , 'admin@ptkharade.in').toLowerCase();
        const phone    = ConfigurationManager.getEnv('SEED_ADMIN_PHONE'   , '+919999900001');
        const password = ConfigurationManager.getEnv('SEED_ADMIN_PASSWORD', 'Admin@12345');

        const userRepo = Source.getRepository(User);
        const existing = await userRepo.findOne({ where: { Email: email } });
        if (existing) return;

        const tenant   = await Source.getRepository(Tenant).findOneByOrFail({});
        const branch   = await Source.getRepository(Branch).findOneByOrFail({ TenantId: tenant.id });
        const adminRole        = await Source.getRepository(Role).findOneByOrFail({ Code: 'SystemAdmin' });
        const receptionistRole = await Source.getRepository(Role).findOneByOrFail({ Code: 'Receptionist' });

        const passwordHash = await argon2.hash(password);
        const user = await userRepo.save(userRepo.create({
            TenantId          : tenant.id,
            BranchId          : branch.id,
            FirstName         : 'PT',
            LastName          : 'Admin',
            Email             : email,
            Phone             : phone,
            PasswordHash      : passwordHash,
            PasswordChangedAt : new Date(),
            EmailVerifiedAt   : new Date(),
            PhoneVerifiedAt   : new Date(),
            PreferredLanguage : 'en',
            IsActive          : true,
        }));

        const urRepo = Source.getRepository(UserRole);
        for (const role of [adminRole, receptionistRole]) {
            await urRepo.save(urRepo.create({
                UserId: user.id, RoleId: role.id, TenantId: tenant.id, BranchId: branch.id,
            }));
        }
        logger.info(`Seeder: system admin created ${email}`);
    };

    private static seedClientApps = async (): Promise<void> => {
        const repo = Source.getRepository(ClientApp);
        const want = [
            { ClientCode: 'ADMIN-PORTAL'              , Name: 'Admin Portal'         , ApiKey: ConfigurationManager.getEnv('API_KEY_ADMIN_PORTAL'        , 'admin-portal-dev-key') },
            { ClientCode: 'CUSTOMER-APP'              , Name: 'Customer App'         , ApiKey: ConfigurationManager.getEnv('API_KEY_CUSTOMER_APP'        , 'customer-app-dev-key') },
            { ClientCode: 'IDENTITY-SERVICE'          , Name: 'Identity Service'     , ApiKey: ConfigurationManager.getEnv('API_KEY_IDENTITY_SERVICE'    , 'identity-service-dev-key') },
            { ClientCode: 'ORDERS-SERVICE'            , Name: 'Orders Service'       , ApiKey: ConfigurationManager.getEnv('API_KEY_ORDERS_SERVICE'      , 'orders-service-dev-key') },
            { ClientCode: 'CATALOG-PRICING-SERVICE'   , Name: 'Catalog & Pricing'    , ApiKey: ConfigurationManager.getEnv('API_KEY_CATALOG_PRICING_SERVICE', 'catalog-pricing-service-dev-key') },
            { ClientCode: 'PAYMENTS-SERVICE'          , Name: 'Payments Service'     , ApiKey: ConfigurationManager.getEnv('API_KEY_PAYMENTS_SERVICE'    , 'payments-service-dev-key') },
            { ClientCode: 'NOTIFICATIONS-SERVICE'     , Name: 'Notifications Service', ApiKey: ConfigurationManager.getEnv('API_KEY_NOTIFICATIONS_SERVICE', 'notifications-service-dev-key') },
        ];
        for (const w of want) {
            const ex = await repo.findOne({ where: { ClientCode: w.ClientCode } });
            if (!ex) {
                await repo.save(repo.create({ ...w, IsActive: true }));
                logger.info(`Seeder: client_app created ${w.ClientCode}`);
            }
        }
    };
}
