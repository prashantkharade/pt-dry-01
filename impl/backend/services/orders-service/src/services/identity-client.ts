import axios from 'axios';
import { ConfigurationManager, ApiError, Logger } from '@ptk/shared';

const baseUrl = () => ConfigurationManager.get('IDENTITY_SERVICE_URL');

export interface CustomerLookup {
  id: string;
  TenantId: string;
  BranchId: string;
  Name: string;
  Phone?: string;
  CustomerType: 'Retail' | 'Vendor';
  CreditLimit: string;
}

export const IdentityClient = {
  async getCustomer(customerId: string, accessToken: string): Promise<CustomerLookup> {
    try {
      const res = await axios.get(`${baseUrl()}/customers/${customerId}/internal`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-api-key': ConfigurationManager.get('API_KEY_ORDERS_SERVICE'),
        },
        timeout: 5000,
      });
      return res.data?.Data;
    } catch (e: unknown) {
      const err = e as { response?: { status: number; data?: unknown }; message?: string };
      Logger.warn('identity.getCustomer.failed', { status: err.response?.status, msg: err.message });
      if (err.response?.status === 404) throw ApiError.notFound('Customer not found');
      throw ApiError.badRequest('Unable to look up customer');
    }
  },
};
