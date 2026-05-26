import { injectable } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { RateCard } from '../models/rate.card.model';
import { Item } from '../models/item.model';
import {
    RateCardCreateModel, RateCardDto,
} from '../../../domain.types/catalog/catalog.types';
import { ErrorHandler } from '../../../common/api.error';

@injectable()
export class RateCardService {

    private _rateRepo = Source.getRepository(RateCard);
    private _itemRepo = Source.getRepository(Item);

    public listForTenant = async (tenantId: string): Promise<RateCardDto[]> => {
        const rows = await this._rateRepo.find({ where: { TenantId: tenantId }, order: { CreatedAt: 'DESC' } });
        const items = await this._itemRepo.find({ where: { TenantId: tenantId } });
        const codeById = new Map(items.map((i) => [i.id, i.Code]));
        return rows.map((r) => ({
            id              : r.id,
            TenantId        : r.TenantId,
            ItemId          : r.ItemId,
            ItemCode        : codeById.get(r.ItemId),
            ServiceTypeCode : r.ServiceTypeCode,
            Rate            : r.Rate,
            Uom             : r.Uom,
            EffectiveFrom   : r.EffectiveFrom,
            EffectiveTo     : r.EffectiveTo,
            IsVendorRate    : r.IsVendorRate,
        }));
    };

    public create = async (model: RateCardCreateModel, updatedBy?: string): Promise<RateCardDto> => {
        const item = await this._itemRepo.findOne({ where: { id: model.ItemId, TenantId: model.TenantId } });
        if (!item) ErrorHandler.throwNotFoundError('Item not found for tenant');
        const today = new Date().toISOString().slice(0, 10);
        const saved = await this._rateRepo.save(this._rateRepo.create({
            TenantId        : model.TenantId,
            ItemId          : model.ItemId,
            ServiceTypeCode : model.ServiceTypeCode,
            Rate            : String(model.Rate),
            Uom             : model.Uom ?? item.DefaultUom ?? 'piece',
            EffectiveFrom   : model.EffectiveFrom ?? today,
            IsVendorRate    : !!model.IsVendorRate,
            UpdatedBy       : updatedBy,
        }));
        return {
            id: saved.id, TenantId: saved.TenantId, ItemId: saved.ItemId, ItemCode: item.Code,
            ServiceTypeCode: saved.ServiceTypeCode, Rate: saved.Rate, Uom: saved.Uom,
            EffectiveFrom: saved.EffectiveFrom, IsVendorRate: saved.IsVendorRate,
        };
    };
}
