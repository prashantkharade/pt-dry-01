/////////////////////////////////////////////////////////////////////////
//  Catalog DTOs — Service types, categories, items, rate cards.
/////////////////////////////////////////////////////////////////////////

export interface ServiceTypeDto {
    id          : string;
    Code        : string;
    Name        : string;
    NameMr?     : string;
    SortOrder   : number;
    IsActive    : boolean;
}

export interface ItemCategoryDto {
    id        : string;
    TenantId  : string;
    Code      : string;
    Name      : string;
    NameMr?   : string;
    SortOrder : number;
    IsActive  : boolean;
}

export interface ItemDto {
    id                : string;
    TenantId          : string;
    CategoryId        : string;
    CategoryCode?     : string;
    Code              : string;
    Name              : string;
    NameMr?           : string;
    ApplicableServices: string[];
    DefaultUom        : string;
    IsVendorOnly      : boolean;
    SortOrder         : number;
    IsActive          : boolean;
}

export interface RateCardDto {
    id              : string;
    TenantId        : string;
    ItemId          : string;
    ItemCode?       : string;
    ServiceTypeCode : string;
    Rate            : string;
    Uom             : string;
    EffectiveFrom   : string;
    EffectiveTo?    : string;
    IsVendorRate    : boolean;
}

export interface RateCardCreateModel {
    TenantId        : string;
    ItemId          : string;
    ServiceTypeCode : string;
    Rate            : number;
    Uom?            : string;
    EffectiveFrom?  : string;
    IsVendorRate?   : boolean;
}

export interface SurchargeDto {
    id          : string;
    TenantId    : string;
    Key         : string;
    Value       : string;
    Unit        : string;
    Description?: string;
}
