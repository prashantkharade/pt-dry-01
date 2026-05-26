import { injectable } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { Item } from '../models/item.model';
import { RateCard } from '../models/rate.card.model';
import { SurchargeConfig } from '../models/surcharge.config.model';
import {
    QuoteRequestModel, QuoteResult, QuoteLineResult,
} from '../../../domain.types/pricing/pricing.types';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  PricingService — single source of truth for line totals + surcharges.
//  Pure (no side effects): given a tenant + items it returns the totals
//  the orders-service should persist on an Order aggregate.
/////////////////////////////////////////////////////////////////////////

const today  = (): string => new Date().toISOString().slice(0, 10);
const toNum  = (n: string | number | undefined): number => (n === undefined ? 0 : Number(n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

@injectable()
export class PricingService {

    private _itemRepo = Source.getRepository(Item);
    private _rateRepo = Source.getRepository(RateCard);
    private _surRepo  = Source.getRepository(SurchargeConfig);

    public quote = async (input: QuoteRequestModel): Promise<QuoteResult> => {
        if (!input.Items || input.Items.length === 0) {
            ErrorHandler.throwInputValidationError(['No items in quote']);
        }

        const itemIds = [...new Set(input.Items.map((l) => l.ItemId))];
        const items = await this._itemRepo.findBy(itemIds.map((id) => ({ id, TenantId: input.TenantId })));
        if (items.length !== itemIds.length) {
            ErrorHandler.throwInputValidationError(['One or more items not found for tenant']);
        }
        const byId = new Map(items.map((i) => [i.id, i]));

        const lines: QuoteLineResult[] = [];
        let subtotal = 0;
        const t = today();

        for (const ln of input.Items) {
            const item = byId.get(ln.ItemId);
            if (!item) ErrorHandler.throwInputValidationError([`Unknown item: ${ln.ItemId}`]);

            const rates = await this._rateRepo
                .createQueryBuilder('rc')
                .where('rc."TenantId" = :t', { t: input.TenantId })
                .andWhere('rc."ItemId" = :i', { i: item.id })
                .andWhere('rc."ServiceTypeCode" = :s', { s: input.ServiceTypeCode })
                .andWhere('rc."IsVendorRate" = :v', { v: input.IsVendor })
                .andWhere('rc."EffectiveFrom" <= :d', { d: t })
                .andWhere('(rc."EffectiveTo" IS NULL OR rc."EffectiveTo" >= :d)', { d: t })
                .orderBy('rc."EffectiveFrom"', 'DESC')
                .getMany();

            const rate = rates[0];
            if (!rate) ErrorHandler.throwUnprocessableError(`No active rate for ${item.Code} / ${input.ServiceTypeCode}`);

            const unit      = toNum(rate.Rate);
            const lineTotal = round2(unit * ln.Quantity);
            subtotal += lineTotal;
            lines.push({
                ItemId       : item.id,
                ItemCode     : item.Code,
                ItemName     : item.Name,
                Quantity     : ln.Quantity,
                UnitRateInr  : unit,
                LineTotalInr : lineTotal,
            });
        }

        const sur = await this._surRepo.findBy([
            { TenantId: input.TenantId, Key: 'HOME_DELIVERY_FLAT_INR' },
            { TenantId: input.TenantId, Key: 'EXPRESS_PCT' },
            { TenantId: input.TenantId, Key: 'GST_DEFAULT_PCT' },
        ]);
        const surMap = Object.fromEntries(sur.map((s) => [s.Key, toNum(s.Value)]));

        const deliveryCharge = input.DeliveryType === 'HomeDelivery' ? toNum(surMap['HOME_DELIVERY_FLAT_INR']) : 0;
        const expressPct     = input.IsExpress ? toNum(surMap['EXPRESS_PCT']) : 0;
        const expressCharge  = round2(subtotal * (expressPct / 100));
        const beforeTax      = subtotal + deliveryCharge + expressCharge;
        const gstPct         = toNum(surMap['GST_DEFAULT_PCT']);
        const gst            = round2(beforeTax * (gstPct / 100));
        const total          = round2(beforeTax + gst);

        return {
            Lines             : lines,
            SubtotalInr       : round2(subtotal),
            DeliveryChargeInr : round2(deliveryCharge),
            ExpressChargeInr  : expressCharge,
            GstInr            : gst,
            TotalInr          : total,
        };
    };

    public listSurcharges = async (tenantId: string) => {
        const rows = await this._surRepo.find({ where: { TenantId: tenantId } });
        return rows.map((s) => ({
            id: s.id, TenantId: s.TenantId, Key: s.Key, Value: s.Value, Unit: s.Unit, Description: s.Description,
        }));
    };
}
