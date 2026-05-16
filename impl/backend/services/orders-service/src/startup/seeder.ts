import axios from 'axios';
import { Logger, ConfigurationManager } from '@ptk/shared';
import { dataSource } from '../database/data-source';
import { ServiceType } from '../database/models/service-type.entity';
import { ItemCategory } from '../database/models/item-category.entity';
import { Item } from '../database/models/item.entity';
import { RateCard } from '../database/models/rate-card.entity';
import { SurchargeConfig } from '../database/models/surcharge-config.entity';
import { SERVICE_TYPES, CATEGORIES, ITEMS, RATES, SURCHARGES } from './seed.data';

async function fetchTenant(): Promise<{ tenantId: string; branchId: string } | null> {
  // The orders-service needs to scope its seed to the identity-service's tenant.
  // Call identity for the system admin login and extract tenant/branch.
  try {
    const baseUrl = ConfigurationManager.get('IDENTITY_SERVICE_URL');
    const email = ConfigurationManager.get('SEED_ADMIN_EMAIL', 'admin@ptkharade.in');
    const password = ConfigurationManager.get('SEED_ADMIN_PASSWORD', 'Admin@12345');
    const res = await axios.post(`${baseUrl}/auth/login`, { emailOrPhone: email, password }, { timeout: 5000 });
    const data = res.data?.Data;
    if (!data?.user) return null;
    return { tenantId: data.user.tenantId, branchId: data.user.branchId };
  } catch (e) {
    return null;
  }
}

export async function seed(): Promise<void> {
  // Service types are platform-wide.
  const stRepo = dataSource.getRepository(ServiceType);
  for (const st of SERVICE_TYPES) {
    const ex = await stRepo.findOne({ where: { Code: st.Code } });
    if (!ex) await stRepo.save(st);
  }

  // Resolve the tenant from identity-service so we can seed tenant-scoped data.
  let scope: { tenantId: string; branchId: string } | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    scope = await fetchTenant();
    if (scope) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!scope) {
    Logger.warn('orders.seed: could not reach identity-service; skipping tenant-scoped seed');
    return;
  }
  const { tenantId } = scope;

  const catRepo = dataSource.getRepository(ItemCategory);
  for (const c of CATEGORIES) {
    const ex = await catRepo.findOne({ where: { TenantId: tenantId, Code: c.Code } });
    if (!ex) await catRepo.save({ ...c, TenantId: tenantId });
  }

  const itemRepo = dataSource.getRepository(Item);
  for (const it of ITEMS) {
    const ex = await itemRepo.findOne({ where: { TenantId: tenantId, Code: it.Code } });
    if (ex) continue;
    const cat = await catRepo.findOneByOrFail({ TenantId: tenantId, Code: it.CategoryCode });
    await itemRepo.save({
      TenantId: tenantId,
      CategoryId: cat.id,
      Code: it.Code,
      Name: it.Name,
      NameMr: it.NameMr,
      ApplicableServices: it.ApplicableServices,
      DefaultUom: it.DefaultUom ?? 'piece',
      IsVendorOnly: !!it.IsVendorOnly,
    });
  }

  const rateRepo = dataSource.getRepository(RateCard);
  for (const r of RATES) {
    const item = await itemRepo.findOne({ where: { TenantId: tenantId, Code: r.ItemCode } });
    if (!item) continue;
    const ex = await rateRepo.findOne({
      where: {
        TenantId: tenantId, ItemId: item.id, ServiceTypeCode: r.ServiceCode, IsVendorRate: !!r.IsVendorRate,
      },
    });
    if (ex) continue;
    await rateRepo.save({
      TenantId: tenantId,
      ItemId: item.id,
      ServiceTypeCode: r.ServiceCode,
      Rate: String(r.Rate),
      Uom: r.Uom ?? 'piece',
      EffectiveFrom: new Date().toISOString().slice(0, 10),
      IsVendorRate: !!r.IsVendorRate,
    });
  }

  const surRepo = dataSource.getRepository(SurchargeConfig);
  for (const s of SURCHARGES) {
    const ex = await surRepo.findOne({ where: { TenantId: tenantId, Key: s.Key } });
    if (!ex) await surRepo.save({ ...s, TenantId: tenantId });
  }

  Logger.info('orders.seed: complete', { tenantId });
}
