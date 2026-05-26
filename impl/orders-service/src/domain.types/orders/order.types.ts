import {
    BilledTo, OrderChannel, OrderDeliveryType, OrderStatus,
} from '../enums/order.enums';

/////////////////////////////////////////////////////////////////////////
//  Orders DTOs — request models + response shapes.
/////////////////////////////////////////////////////////////////////////

export interface OrderLineInput {
    ItemId   : string;
    Quantity : number;
    Note?    : string;
}

export interface OrderCreateModel {
    CustomerId       : string;
    ServiceTypeCode  : string;
    Channel          : OrderChannel;
    DeliveryType     : OrderDeliveryType;
    IsExpress?       : boolean;
    BilledTo?        : BilledTo;
    Items            : OrderLineInput[];
    ScheduledAt?     : string;
    DeliveryAddressId?: string;
    Notes?           : string;
}

export interface OrderStatusUpdateModel {
    Status : OrderStatus;
    Note?  : string;
}

export interface OrderLineDto {
    id              : string;
    ItemId          : string;
    ItemCode        : string;
    ItemName        : string;
    ServiceTypeCode : string;
    Quantity        : number;
    UnitRateInr     : string;
    LineTotalInr    : string;
    Note?           : string;
}

export interface OrderHistoryDto {
    id            : string;
    FromStatus?   : string;
    ToStatus      : string;
    ChangedBy?    : string;
    ChangedByName?: string;
    Note?         : string;
    CreatedAt     : Date;
}

export interface OrderDto {
    id                : string;
    OrderCode         : string;
    TenantId          : string;
    BranchId          : string;
    CustomerId        : string;
    CustomerName      : string;
    CustomerPhone     : string;
    BilledTo          : BilledTo;
    ServiceTypeCode   : string;
    Channel           : OrderChannel;
    DeliveryType      : OrderDeliveryType;
    IsExpress         : boolean;
    Status            : OrderStatus;
    ScheduledAt?      : Date;
    DeliveryAddressId?: string;
    SubtotalInr       : string;
    DeliveryChargeInr : string;
    ExpressChargeInr  : string;
    GstInr            : string;
    TotalInr          : string;
    Notes?            : string;
    Lines?            : OrderLineDto[];
    History?          : OrderHistoryDto[];
    CreatedAt         : Date;
    UpdatedAt         : Date;
}

export interface OrderSearchFilters {
    TenantId?     : string;
    Status?       : OrderStatus;
    CustomerId?   : string;
    Query?        : string;
    PageIndex?    : number;
    ItemsPerPage? : number;
}
