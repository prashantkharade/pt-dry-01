/////////////////////////////////////////////////////////////////////////
//  Pricing engine I/O — mirrors the orders-service connector shape so
//  the wire contract is symmetrical.
/////////////////////////////////////////////////////////////////////////

export interface QuoteLineInput {
    ItemId   : string;
    Quantity : number;
}

export interface QuoteRequestModel {
    TenantId        : string;
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
