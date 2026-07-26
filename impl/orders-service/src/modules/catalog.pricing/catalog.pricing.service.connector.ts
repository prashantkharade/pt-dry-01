import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';
import { ErrorHandler } from '../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Client for catalog-pricing-service /pricing/quote — the source of
//  truth for line totals + surcharges. orders-service never reads the
//  rate-card table directly.
/////////////////////////////////////////////////////////////////////////

export interface QuoteLineInput {
    ItemId  : string;
    Quantity: number;
}

export interface QuoteRequestModel {
    // NOTE: TenantId is intentionally NOT part of the request body. The
    // pricing-service derives the tenant from the caller's JWT
    // (request.currentUser.TenantId) and its validator rejects an
    // unknown "TenantId" key. Sending it here yields a 400 → 422.
    ServiceTypeCode : string;
    IsVendor        : boolean;
    IsExpress       : boolean;
    DeliveryType    : 'HomeDelivery' | 'CustomerPickup';
    Items           : QuoteLineInput[];
}

export interface QuoteLineResult {
    ItemId       : string;
    ItemCode     : string;
    ItemName     : string;
    Quantity     : number;
    UnitRateInr  : number;
    LineTotalInr : number;
}

export interface QuoteResult {
    Lines             : QuoteLineResult[];
    SubtotalInr       : number;
    DeliveryChargeInr : number;
    ExpressChargeInr  : number;
    GstInr            : number;
    TotalInr          : number;
}

@injectable()
export class CatalogPricingServiceConnector {

    private baseUrl(): string {
        return ConfigurationManager.getEnv('CATALOG_PRICING_SERVICE_URL', 'http://localhost:4002');
    }

    public quote = async (input: QuoteRequestModel, accessToken: string): Promise<QuoteResult> => {
        try {
            const res = await axios.post(`${this.baseUrl()}/api/v1/pricing/quote`, input, {
                headers: {
                    Authorization : `Bearer ${accessToken}`,
                    'x-api-key'   : ConfigurationManager.getEnv('API_KEY_ORDERS_SERVICE', 'orders-service-dev-key'),
                },
                timeout: 5000,
            });
            return res.data?.Data;
        } catch (e: any) {
            logger.warn(`catalog-pricing.quote.failed status=${e?.response?.status} msg=${e?.message}`);
            ErrorHandler.throwUnprocessableError('Unable to compute quote', e?.response?.data ?? { message: e?.message });
        }
    };
}
