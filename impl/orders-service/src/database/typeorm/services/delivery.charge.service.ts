import { injectable } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { DeliveryChargeRate } from '../models/delivery.charge.rate.model';
import { DeliverySociety } from '../models/delivery.society.model';
import { BaseService } from './base.service';
import { logger } from '../../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  What the delivery leg costs.
//
//  Money is computed in paise (integers) and only converted back to rupees
//  at the end. Doing the arithmetic in floats is how you get an invoice that
//  is a paisa off and does not foot.
/////////////////////////////////////////////////////////////////////////

export interface ChargeQuote {
    ChargeInr   : string;
    DistanceKm  : string;
    RateId      : string | null;
    //Present when no bracket matched, so the caller can surface why it's free.
    Reason?     : string;
}

@injectable()
export class DeliveryChargeService extends BaseService {

    private _rateRepo    = Source.getRepository(DeliveryChargeRate);
    private _societyRepo = Source.getRepository(DeliverySociety);

    /**
     * Quote the charge for delivering to a society.
     *
     * A rate naming the service type beats the catch-all (ServiceTypeCode
     * NULL) row, so express dry-clean can carry its own bracket without
     * duplicating every generic row.
     */
    public quote = async (
        tenantId        : string,
        societyId       : string,
        serviceTypeCode?: string,
        onDate          : string = new Date().toISOString().slice(0, 10),
    ): Promise<ChargeQuote> => {
        const society = await this._societyRepo.findOne({ where: { id: societyId } });
        if (!society) {
            return { ChargeInr: '0.00', DistanceKm: '0.00', RateId: null, Reason: 'Unknown society' };
        }
        const distanceKm = Number(society.DistanceKm ?? 0);

        const rates = await this._rateRepo
            .createQueryBuilder('r')
            .where('r.TenantId = :tenantId', { tenantId })
            .andWhere('r.EffectiveFrom <= :onDate', { onDate })
            .andWhere('(r.EffectiveTo IS NULL OR r.EffectiveTo >= :onDate)', { onDate })
            .andWhere('r.MinDistanceKm <= :d AND r.MaxDistanceKm >= :d', { d: distanceKm })
            .andWhere('(r.ServiceTypeCode = :code OR r.ServiceTypeCode IS NULL)', { code: serviceTypeCode ?? '' })
            .getMany();

        if (rates.length === 0) {
            //No bracket is a config gap, not a free delivery. Loud, and the
            //caller gets a Reason it can show rather than a silent zero.
            logger.warn(`No delivery charge rate for tenant=${tenantId} distance=${distanceKm}km service=${serviceTypeCode ?? 'any'} on ${onDate}`);
            return { ChargeInr: '0.00', DistanceKm: distanceKm.toFixed(2), RateId: null, Reason: 'No rate bracket configured for this distance' };
        }

        //Specific service type wins over the NULL catch-all.
        rates.sort((a, b) => (a.ServiceTypeCode ? 0 : 1) - (b.ServiceTypeCode ? 0 : 1));
        const rate = rates[0];

        const basePaise = Math.round(Number(rate.BaseCharge) * 100);
        const perKmPaise = Math.round(Number(rate.ChargePerKm) * 100);
        //Per-km applies to distance beyond the bracket floor, not from zero —
        //otherwise the 5-10km bracket charges 10km of per-km on a 5km trip.
        const billableKm = Math.max(0, distanceKm - Number(rate.MinDistanceKm));
        const totalPaise = basePaise + Math.round(perKmPaise * billableKm);

        return {
            ChargeInr  : (totalPaise / 100).toFixed(2),
            DistanceKm : distanceKm.toFixed(2),
            RateId     : rate.id,
        };
    };
}
