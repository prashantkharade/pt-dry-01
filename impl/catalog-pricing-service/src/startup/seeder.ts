import axios from 'axios';
import { Source } from '../database/typeorm/typeorm.database.connector';
import { ServiceType }      from '../database/typeorm/models/service.type.model';
import { ItemCategory }     from '../database/typeorm/models/item.category.model';
import { Item }             from '../database/typeorm/models/item.model';
import { RateCard }         from '../database/typeorm/models/rate.card.model';
import { SurchargeConfig }  from '../database/typeorm/models/surcharge.config.model';
import { SubscriptionPlan } from '../database/typeorm/models/subscription.plan.model';
import { SERVICE_TYPES, CATEGORIES, ITEMS, RATES, SURCHARGES, SUBSCRIPTION_PLANS } from './seed.data';
import { logger } from '../logger/logger';
import { ConfigurationManager } from '../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Catalog-pricing seeder. Service types are platform-wide; everything
//  else is tenant-scoped, so we wait until identity-service is up and
//  resolve the default tenant from the system admin login response.
/////////////////////////////////////////////////////////////////////////

async function fetchTenant(): Promise<{ TenantId: string; BranchId: string } | null> {
    try {
        const baseUrl  = ConfigurationManager.getEnv('IDENTITY_SERVICE_URL', 'http://localhost:4001');
        const email    = ConfigurationManager.getEnv('SEED_ADMIN_EMAIL'    , 'admin@ptkharade.in');
        const password = ConfigurationManager.getEnv('SEED_ADMIN_PASSWORD' , 'Admin@12345');
        //Every identity-service route — login included — requires a registered
        //client key. "Anonymous" means no USER, not no CLIENT.
        const apiKey   = ConfigurationManager.getEnv('API_KEY_CATALOG_PRICING_SERVICE', 'catalog-pricing-service-dev-key');
        const res      = await axios.post(
            `${baseUrl}/api/v1/auth/login`,
            { EmailOrPhone: email, Password: password },
            { timeout: 5000, headers: { 'x-api-key': apiKey } },
        );
        const user     = res.data?.Data?.User;
        if (!user) return null;
        return { TenantId: user.TenantId, BranchId: user.BranchId };
    } catch (error: any) {
        //Log the reason. A bare `catch { return null }` here reports every
        //failure as "unreachable", which sends you looking at the network when
        //the truth is a 401 from a missing or wrong client key.
        const status = error?.response?.status;
        if (status) logger.warn(`catalog-pricing.seeder: identity-service rejected login (HTTP ${status}) — ${error?.response?.data?.Message ?? ''}`);
        return null;
    }
}

export class Seeder {

    public static seed = async (): Promise<void> => {
        await Seeder.seedServiceTypes();

        let scope: { TenantId: string; BranchId: string } | null = null;
        for (let attempt = 0; attempt < 30 && !scope; attempt++) {
            scope = await fetchTenant();
            if (!scope) await new Promise((r) => setTimeout(r, 1000));
        }
        if (!scope) {
            logger.warn('catalog-pricing.seeder: could not reach identity-service; skipping tenant-scoped seed');
            return;
        }
        await Seeder.seedCategories(scope.TenantId);
        await Seeder.seedItems(scope.TenantId);
        await Seeder.seedRates(scope.TenantId);
        await Seeder.seedSurcharges(scope.TenantId);
        await Seeder.seedSubscriptionPlans(scope.TenantId);
        logger.info(`Seeder: complete tenantId=${scope.TenantId}`);
    };

    private static seedServiceTypes = async (): Promise<void> => {
        const repo = Source.getRepository(ServiceType);
        for (const st of SERVICE_TYPES) {
            const ex = await repo.findOne({ where: { Code: st.Code } });
            if (!ex) await repo.save(repo.create(st));
        }
    };

    private static seedCategories = async (tenantId: string): Promise<void> => {
        const repo = Source.getRepository(ItemCategory);
        for (const c of CATEGORIES) {
            const ex = await repo.findOne({ where: { TenantId: tenantId, Code: c.Code } });
            if (!ex) await repo.save(repo.create({ ...c, TenantId: tenantId }));
        }
    };

    private static seedItems = async (tenantId: string): Promise<void> => {
        const catRepo  = Source.getRepository(ItemCategory);
        const itemRepo = Source.getRepository(Item);
        for (const it of ITEMS) {
            const ex = await itemRepo.findOne({ where: { TenantId: tenantId, Code: it.Code } });
            if (ex) continue;
            const cat = await catRepo.findOneByOrFail({ TenantId: tenantId, Code: it.CategoryCode });
            await itemRepo.save(itemRepo.create({
                TenantId          : tenantId,
                CategoryId        : cat.id,
                Code              : it.Code,
                Name              : it.Name,
                NameMr            : it.NameMr,
                ApplicableServices: it.ApplicableServices,
                DefaultUom        : it.DefaultUom ?? 'piece',
                IsVendorOnly      : !!it.IsVendorOnly,
            }));
        }
    };

    private static seedRates = async (tenantId: string): Promise<void> => {
        const itemRepo = Source.getRepository(Item);
        const rateRepo = Source.getRepository(RateCard);
        for (const r of RATES) {
            const item = await itemRepo.findOne({ where: { TenantId: tenantId, Code: r.ItemCode } });
            if (!item) continue;
            const ex = await rateRepo.findOne({
                where: {
                    TenantId: tenantId, ItemId: item.id, ServiceTypeCode: r.ServiceCode, IsVendorRate: !!r.IsVendorRate,
                },
            });
            if (ex) continue;
            await rateRepo.save(rateRepo.create({
                TenantId        : tenantId,
                ItemId          : item.id,
                ServiceTypeCode : r.ServiceCode,
                Rate            : String(r.Rate),
                Uom             : r.Uom ?? 'piece',
                EffectiveFrom   : new Date().toISOString().slice(0, 10),
                IsVendorRate    : !!r.IsVendorRate,
            }));
        }
    };

    private static seedSurcharges = async (tenantId: string): Promise<void> => {
        const repo = Source.getRepository(SurchargeConfig);
        for (const s of SURCHARGES) {
            const ex = await repo.findOne({ where: { TenantId: tenantId, Key: s.Key } });
            if (!ex) await repo.save(repo.create({ ...s, TenantId: tenantId }));
        }
    };

    private static seedSubscriptionPlans = async (tenantId: string): Promise<void> => {
        const repo = Source.getRepository(SubscriptionPlan);
        for (const p of SUBSCRIPTION_PLANS) {
            const ex = await repo.findOne({ where: { TenantId: tenantId, Code: p.Code } });
            if (!ex) await repo.save(repo.create({ ...p, TenantId: tenantId, IsActive: true }));
        }
    };
}
