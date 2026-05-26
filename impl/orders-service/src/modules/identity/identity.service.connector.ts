import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';
import { ErrorHandler } from '../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Thin axios-backed client for identity-service. Surfaces only the
//  internal endpoints orders-service needs (customer lookup).
/////////////////////////////////////////////////////////////////////////

export interface CustomerLookup {
    id           : string;
    TenantId     : string;
    BranchId     : string;
    Name         : string;
    Phone?       : string;
    CustomerType : 'Retail' | 'Vendor';
    CreditLimit  : string;
}

@injectable()
export class IdentityServiceConnector {

    private baseUrl(): string {
        return ConfigurationManager.getEnv('IDENTITY_SERVICE_URL', 'http://localhost:4001');
    }

    public getCustomer = async (customerId: string, accessToken: string): Promise<CustomerLookup> => {
        try {
            const res = await axios.get(`${this.baseUrl()}/api/v1/customers/${customerId}/internal`, {
                headers: {
                    Authorization : `Bearer ${accessToken}`,
                    'x-api-key'   : ConfigurationManager.getEnv('API_KEY_ORDERS_SERVICE', 'dev-orders-service-key'),
                },
                timeout: 5000,
            });
            return res.data?.Data;
        } catch (e: any) {
            logger.warn(`identity.getCustomer.failed status=${e?.response?.status} msg=${e?.message}`);
            if (e?.response?.status === 404) ErrorHandler.throwNotFoundError('Customer not found');
            ErrorHandler.throwUnprocessableError('Unable to look up customer');
        }
    };
}
