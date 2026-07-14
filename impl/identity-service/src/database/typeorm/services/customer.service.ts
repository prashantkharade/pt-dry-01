import { injectable } from 'tsyringe';
import { ILike } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { Customer } from '../models/customer.model';
import { CustomerAddress } from '../models/customer.address.model';
import { BaseService } from './base.service';
import { CustomerMapper } from '../mappers/customer.mapper';
import {
    CustomerCreateModel, CustomerDto, CustomerSearchFilters, CustomerUpdateModel,
} from '../../../domain.types/customers/customer.types';
import { BaseSearchResults } from '../../../domain.types/miscellaneous/search.types';
import { StringUtils } from '../../../common/utilities/string.utils';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Application service for Customer + Address.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class CustomerService extends BaseService {

    private _customerRepo = Source.getRepository(Customer);
    private _addressRepo  = Source.getRepository(CustomerAddress);

    public create = async (model: CustomerCreateModel): Promise<CustomerDto> => {
        const dup = model.Phone
            ? await this._customerRepo.findOne({ where: { TenantId: model.TenantId, Phone: model.Phone } })
            : null;
        if (dup) ErrorHandler.throwConflictError('A customer with this phone already exists', { id: dup.id });

        const code = StringUtils.generateCustomerCode();
        const customer = await this._customerRepo.save(this._customerRepo.create({
            TenantId        : model.TenantId,
            BranchId        : model.BranchId,
            CustomerCode    : code,
            CustomerType    : model.CustomerType ?? 'Retail',
            Name            : model.Name,
            Phone           : model.Phone,
            Email           : model.Email,
            BusinessName    : model.BusinessName,
            Gstin           : model.Gstin,
            PriceTier       : model.PriceTier ?? 'Default',
            CreditLimit     : model.CreditLimit != null ? String(model.CreditLimit) : '0',
            PaymentTermsDays: model.PaymentTermsDays ?? 0,
        }));

        if (model.Address) {
            await this._addressRepo.save(this._addressRepo.create({
                CustomerId: customer.id,
                Label     : 'Home',
                Flat      : model.Address.Flat,
                Building  : model.Address.Building,
                Society   : model.Address.Society,
                Landmark  : model.Address.Landmark,
                Area      : model.Address.Area,
                City      : model.Address.City,
                State     : model.Address.State,
                Pincode   : model.Address.Pincode,
                IsDefault : true,
            }));
        }
        return this.getById(customer.id);
    };

    public getById = async (id: string): Promise<CustomerDto> => {
        const customer = await this._customerRepo.findOne({ where: { id } });
        if (!customer) return null;
        const addresses = await this._addressRepo.find({
            where: { CustomerId: id }, order: { IsDefault: 'DESC', CreatedAt: 'DESC' },
        });
        return CustomerMapper.toDto(customer, addresses);
    };

    public getByPhone = async (tenantId: string, phone: string): Promise<CustomerDto> => {
        const customer = await this._customerRepo.findOne({ where: { TenantId: tenantId, Phone: phone } });
        if (!customer) return null;
        return this.getById(customer.id);
    };

    public getByUserId = async (userId: string): Promise<CustomerDto> => {
        const customer = await this._customerRepo.findOne({ where: { UserId: userId } });
        if (!customer) return null;
        return this.getById(customer.id);
    };

    //  Resolve (and self-heal) the customer profile for a logged-in app user.
    //  App users are auto-provisioned with a UserId-linked customer at OTP
    //  login, but a customer created earlier in the admin portal for the same
    //  phone won't carry a UserId yet — link it lazily so both point at one row.
    public getOrLinkForUser = async (
        userId: string, tenantId: string, phone?: string,
    ): Promise<CustomerDto> => {
        const linked = await this.getByUserId(userId);
        if (linked) return linked;
        if (!phone) return null;
        const byPhone = await this._customerRepo.findOne({ where: { TenantId: tenantId, Phone: phone } });
        if (!byPhone) return null;
        if (!byPhone.UserId) {
            byPhone.UserId = userId;
            await this._customerRepo.save(byPhone);
        }
        return this.getById(byPhone.id);
    };

    public update = async (id: string, model: CustomerUpdateModel): Promise<CustomerDto> => {
        const c = await this._customerRepo.findOne({ where: { id } });
        if (!c) return null;
        if (model.Name !== undefined)            c.Name = model.Name;
        if (model.Phone !== undefined)           c.Phone = model.Phone;
        if (model.Email !== undefined)           c.Email = model.Email;
        if (model.CustomerType !== undefined)    c.CustomerType = model.CustomerType;
        if (model.BusinessName !== undefined)    c.BusinessName = model.BusinessName;
        if (model.Gstin !== undefined)           c.Gstin = model.Gstin;
        if (model.PriceTier !== undefined)       c.PriceTier = model.PriceTier;
        if (model.CreditLimit !== undefined)     c.CreditLimit = String(model.CreditLimit);
        if (model.PaymentTermsDays !== undefined) c.PaymentTermsDays = model.PaymentTermsDays;
        if (model.IsBlocked !== undefined)       c.IsBlocked = model.IsBlocked;
        await this._customerRepo.save(c);
        return this.getById(c.id);
    };

    public search = async (filters: CustomerSearchFilters): Promise<BaseSearchResults<CustomerDto>> => {
        const q = (filters.Query ?? '').trim();
        const baseWhere: any = {};
        if (filters.TenantId)     baseWhere.TenantId = filters.TenantId;
        if (filters.BranchId)     baseWhere.BranchId = filters.BranchId;
        if (filters.CustomerType) baseWhere.CustomerType = filters.CustomerType;

        const where = q
            ? [
                { ...baseWhere, Name: ILike(`%${q}%`) },
                { ...baseWhere, Phone: ILike(`%${q}%`) },
                { ...baseWhere, CustomerCode: ILike(`%${q}%`) },
              ]
            : baseWhere;

        const pageIndex = this.pageIndex(filters.PageIndex);
        const pageSize  = this.pageSize(filters.ItemsPerPage);

        const [items, total] = await this._customerRepo.findAndCount({
            where,
            skip : pageIndex * pageSize,
            take : pageSize,
            order: { CreatedAt: 'DESC' },
        });
        const dtos = items.map((c) => CustomerMapper.toDto(c));
        return { Items: dtos, Total: total, PageIndex: pageIndex, ItemsPerPage: pageSize };
    };
}
