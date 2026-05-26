import { injectable } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { ServiceType } from '../models/service.type.model';
import { ItemCategory } from '../models/item.category.model';
import { Item } from '../models/item.model';
import { BaseService } from './base.service';
import {
    ItemCategoryDto, ItemDto, ServiceTypeDto,
} from '../../../domain.types/catalog/catalog.types';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Read-side service for the catalog (service types, categories, items).
//  Write paths are admin-only and live on dedicated controllers.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class CatalogService extends BaseService {

    private _serviceRepo  = Source.getRepository(ServiceType);
    private _categoryRepo = Source.getRepository(ItemCategory);
    private _itemRepo     = Source.getRepository(Item);

    public listServiceTypes = async (): Promise<ServiceTypeDto[]> => {
        const items = await this._serviceRepo.find({ where: { IsActive: true }, order: { SortOrder: 'ASC' } });
        return items.map((s) => ({
            id: s.id, Code: s.Code, Name: s.Name, NameMr: s.NameMr, SortOrder: s.SortOrder, IsActive: s.IsActive,
        }));
    };

    public listCategories = async (tenantId: string): Promise<ItemCategoryDto[]> => {
        const items = await this._categoryRepo.find({
            where: { TenantId: tenantId, IsActive: true }, order: { SortOrder: 'ASC' },
        });
        return items.map((c) => ({
            id: c.id, TenantId: c.TenantId, Code: c.Code, Name: c.Name, NameMr: c.NameMr,
            SortOrder: c.SortOrder, IsActive: c.IsActive,
        }));
    };

    public listItems = async (
        tenantId: string,
        serviceCode?: string,
        includeVendor = false,
    ): Promise<ItemDto[]> => {
        let qb = this._itemRepo.createQueryBuilder('i')
            .where('i."TenantId" = :t', { t: tenantId })
            .andWhere('i."IsActive" = TRUE');
        if (serviceCode)    qb = qb.andWhere(`:s = ANY(i."ApplicableServices")`, { s: serviceCode });
        if (!includeVendor) qb = qb.andWhere('i."IsVendorOnly" = FALSE');
        const items = await qb.orderBy('i."SortOrder"', 'ASC').addOrderBy('i."Name"', 'ASC').getMany();
        return items.map((i) => ({
            id: i.id, TenantId: i.TenantId, CategoryId: i.CategoryId,
            Code: i.Code, Name: i.Name, NameMr: i.NameMr,
            ApplicableServices: i.ApplicableServices, DefaultUom: i.DefaultUom,
            IsVendorOnly: i.IsVendorOnly, SortOrder: i.SortOrder, IsActive: i.IsActive,
        }));
    };

    public getItemById = async (tenantId: string, id: string): Promise<ItemDto> => {
        const item = await this._itemRepo.findOne({ where: { id, TenantId: tenantId } });
        if (!item) ErrorHandler.throwNotFoundError('Item not found');
        return {
            id: item.id, TenantId: item.TenantId, CategoryId: item.CategoryId,
            Code: item.Code, Name: item.Name, NameMr: item.NameMr,
            ApplicableServices: item.ApplicableServices, DefaultUom: item.DefaultUom,
            IsVendorOnly: item.IsVendorOnly, SortOrder: item.SortOrder, IsActive: item.IsActive,
        };
    };
}
