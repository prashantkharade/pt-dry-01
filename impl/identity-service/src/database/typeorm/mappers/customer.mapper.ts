import { Customer } from '../models/customer.model';
import { CustomerAddress } from '../models/customer.address.model';
import { CustomerAddressDto, CustomerDto } from '../../../domain.types/customers/customer.types';

/////////////////////////////////////////////////////////////////////////
//  Entity → DTO mapping for Customer + Address.
/////////////////////////////////////////////////////////////////////////

export class CustomerAddressMapper {
    static toDto = (a: CustomerAddress): CustomerAddressDto => {
        if (!a) return null;
        return {
            id        : a.id,
            Label     : a.Label,
            Flat      : a.Flat,
            Building  : a.Building,
            Society   : a.Society,
            Landmark  : a.Landmark,
            Area      : a.Area,
            City      : a.City,
            State     : a.State,
            Pincode   : a.Pincode,
            IsDefault : a.IsDefault,
        };
    };
}

export class CustomerMapper {
    static toDto = (c: Customer, addresses: CustomerAddress[] = []): CustomerDto => {
        if (!c) return null;
        return {
            id              : c.id,
            TenantId        : c.TenantId,
            BranchId        : c.BranchId,
            UserId          : c.UserId,
            CustomerCode    : c.CustomerCode,
            CustomerType    : c.CustomerType,
            Name            : c.Name,
            BusinessName    : c.BusinessName,
            Phone           : c.Phone,
            Email           : c.Email,
            Gstin           : c.Gstin,
            CreditLimit     : c.CreditLimit,
            PaymentTermsDays: c.PaymentTermsDays,
            PriceTier       : c.PriceTier,
            IsBlocked       : c.IsBlocked,
            Addresses       : (addresses ?? []).map((a) => CustomerAddressMapper.toDto(a)),
            OnboardedAt     : c.OnboardedAt,
            CreatedAt       : c.CreatedAt,
            UpdatedAt       : c.UpdatedAt,
        };
    };
}
