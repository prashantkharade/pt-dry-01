import { dataSource } from '../database/data-source';
import { Item } from '../database/models/item.entity';
import { RateCard } from '../database/models/rate-card.entity';
import { SurchargeConfig } from '../database/models/surcharge-config.entity';
import { ApiError } from '@ptk/shared';

export interface QuoteLineInput {
  itemId: string;
  quantity: number;
}

export interface QuoteInput {
  tenantId: string;
  serviceTypeCode: string;
  isVendor: boolean;
  isExpress: boolean;
  deliveryType: 'HomeDelivery' | 'CustomerPickup';
  items: QuoteLineInput[];
}

export interface QuoteLineResult {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitRateInr: number;
  lineTotalInr: number;
}

export interface QuoteResult {
  lines: QuoteLineResult[];
  subtotalInr: number;
  deliveryChargeInr: number;
  expressChargeInr: number;
  gstInr: number;
  totalInr: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const toNum = (n: string | number | undefined) => (n === undefined ? 0 : Number(n));
const round2 = (n: number) => Math.round(n * 100) / 100;

export const PricingService = {
  async quote(input: QuoteInput): Promise<QuoteResult> {
    if (input.items.length === 0) throw ApiError.badRequest('No items in quote');

    const itemRepo = dataSource.getRepository(Item);
    const rateRepo = dataSource.getRepository(RateCard);
    const surRepo = dataSource.getRepository(SurchargeConfig);

    const itemIds = [...new Set(input.items.map((l) => l.itemId))];
    const items = await itemRepo.findBy(itemIds.map((id) => ({ id, TenantId: input.tenantId })));
    const byId = new Map(items.map((i) => [i.id, i]));

    if (items.length !== itemIds.length) {
      throw ApiError.badRequest('One or more items not found for tenant');
    }

    const lines: QuoteLineResult[] = [];
    let subtotal = 0;
    const t = today();

    for (const ln of input.items) {
      const item = byId.get(ln.itemId);
      if (!item) throw ApiError.badRequest(`Unknown item: ${ln.itemId}`);

      // Look up the active rate (retail or vendor).
      const rates = await rateRepo
        .createQueryBuilder('rc')
        .where('rc."TenantId" = :t', { t: input.tenantId })
        .andWhere('rc."ItemId" = :i', { i: item.id })
        .andWhere('rc."ServiceTypeCode" = :s', { s: input.serviceTypeCode })
        .andWhere('rc."IsVendorRate" = :v', { v: input.isVendor })
        .andWhere('rc."EffectiveFrom" <= :d', { d: t })
        .andWhere('(rc."EffectiveTo" IS NULL OR rc."EffectiveTo" >= :d)', { d: t })
        .orderBy('rc."EffectiveFrom"', 'DESC')
        .getMany();

      const rate = rates[0];
      if (!rate) throw ApiError.unprocessable(`No active rate for ${item.Code} / ${input.serviceTypeCode}`);

      const unit = toNum(rate.Rate);
      const lineTotal = round2(unit * ln.quantity);
      subtotal += lineTotal;
      lines.push({
        itemId: item.id,
        itemCode: item.Code,
        itemName: item.Name,
        quantity: ln.quantity,
        unitRateInr: unit,
        lineTotalInr: lineTotal,
      });
    }

    // Surcharges.
    const sur = await surRepo.findBy([
      { TenantId: input.tenantId, Key: 'HOME_DELIVERY_FLAT_INR' },
      { TenantId: input.tenantId, Key: 'EXPRESS_PCT' },
      { TenantId: input.tenantId, Key: 'GST_DEFAULT_PCT' },
    ]);
    const surMap = Object.fromEntries(sur.map((s) => [s.Key, toNum(s.Value)]));

    const deliveryCharge = input.deliveryType === 'HomeDelivery' ? toNum(surMap['HOME_DELIVERY_FLAT_INR']) : 0;
    const expressPct = input.isExpress ? toNum(surMap['EXPRESS_PCT']) : 0;
    const expressCharge = round2(subtotal * (expressPct / 100));
    const beforeTax = subtotal + deliveryCharge + expressCharge;
    const gstPct = toNum(surMap['GST_DEFAULT_PCT']);
    const gst = round2(beforeTax * (gstPct / 100));
    const total = round2(beforeTax + gst);

    return {
      lines,
      subtotalInr: round2(subtotal),
      deliveryChargeInr: round2(deliveryCharge),
      expressChargeInr: expressCharge,
      gstInr: gst,
      totalInr: total,
    };
  },
};
