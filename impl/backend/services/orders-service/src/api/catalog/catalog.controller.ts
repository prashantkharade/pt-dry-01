import { Router } from 'express';
import { asyncHandler, ResponseHandler, userAuthenticator } from '@ptk/shared';
import { dataSource } from '../../database/data-source';
import { Item } from '../../database/models/item.entity';
import { ServiceType } from '../../database/models/service-type.entity';
import { ItemCategory } from '../../database/models/item-category.entity';

const router = Router();

router.get(
  '/service-types',
  userAuthenticator(),
  asyncHandler(async (_req, res) => {
    const items = await dataSource
      .getRepository(ServiceType)
      .find({ where: { IsActive: true }, order: { SortOrder: 'ASC' } });
    return ResponseHandler.success(res, { items });
  }),
);

router.get(
  '/categories',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const items = await dataSource
      .getRepository(ItemCategory)
      .find({ where: { TenantId: req.currentUser!.tenantId, IsActive: true }, order: { SortOrder: 'ASC' } });
    return ResponseHandler.success(res, { items });
  }),
);

router.get(
  '/items',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const tenantId = req.currentUser!.tenantId;
    const service = (req.query.service as string) || undefined;
    const includeVendor = req.query.includeVendor === '1' || req.currentUser!.roles.includes('Vendor');
    let qb = dataSource
      .getRepository(Item)
      .createQueryBuilder('i')
      .where('i."TenantId" = :t', { t: tenantId })
      .andWhere('i."IsActive" = TRUE');
    if (service) qb = qb.andWhere(`:s = ANY(i."ApplicableServices")`, { s: service });
    if (!includeVendor) qb = qb.andWhere('i."IsVendorOnly" = FALSE');
    const items = await qb.orderBy('i."SortOrder"', 'ASC').addOrderBy('i."Name"', 'ASC').getMany();
    return ResponseHandler.success(res, { items });
  }),
);

export default router;
