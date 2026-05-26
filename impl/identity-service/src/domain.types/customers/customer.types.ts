import { CustomerType } from '../../database/typeorm/models/customer.model';

/////////////////////////////////////////////////////////////////////////
//  Customers domain DTOs.
/////////////////////////////////////////////////////////////////////////

export interface AddressInput {
    Flat?      : string;
    Building?  : string;
    Society?   : string;
    Landmark?  : string;
    Area?      : string;
    City       : string;
    State      : string;
    Pincode    : string;
}

export interface CustomerCreateModel {
    TenantId      : string;
    BranchId      : string;
    Name          : string;
    Phone?        : string;
    Email?        : string;
    CustomerType? : CustomerType;
    BusinessName? : string;
    Gstin?        : string;
    PriceTier?    : string;
    CreditLimit?  : number;
    PaymentTermsDays?: number;
    Address?      : AddressInput;
}

export interface CustomerUpdateModel {
    Name?         : string;
    Phone?        : string;
    Email?        : string;
    CustomerType? : CustomerType;
    BusinessName? : string;
    Gstin?        : string;
    PriceTier?    : string;
    CreditLimit?  : number;
    PaymentTermsDays?: number;
    IsBlocked?    : boolean;
}

export interface CustomerAddressDto {
    id            : string;
    Label         : string;
    Flat?         : string;
    Building?     : string;
    Society?      : string;
    Landmark?     : string;
    Area?         : string;
    City          : string;
    State         : string;
    Pincode       : string;
    IsDefault     : boolean;
}

export interface CustomerDto {
    id            : string;
    TenantId      : string;
    BranchId      : string;
    UserId?       : string;
    CustomerCode  : string;
    CustomerType  : CustomerType;
    Name          : string;
    BusinessName? : string;
    Phone?        : string;
    Email?        : string;
    Gstin?        : string;
    CreditLimit   : string;
    PaymentTermsDays: number;
    PriceTier     : string;
    IsBlocked     : boolean;
    Addresses?    : CustomerAddressDto[];
    OnboardedAt   : Date;
    CreatedAt     : Date;
    UpdatedAt     : Date;
}

export interface CustomerSearchFilters {
    TenantId?     : string;
    BranchId?     : string;
    Query?        : string;
    CustomerType? : CustomerType;
    PageIndex?    : number;
    ItemsPerPage? : number;
}
