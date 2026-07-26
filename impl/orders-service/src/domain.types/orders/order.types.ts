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

    //  --- The two legs -------------------------------------------------
    //  Required only for the legs this order actually has:
    //    Channel=HomePickup      -> Pickup{SlotId,Date} required
    //    DeliveryType=HomeDelivery -> Delivery{SlotId,Date} required
    //  A DropAtShop + CustomerPickup order books no slots at all.
    PickupSlotId?     : string;
    PickupDate?       : string;
    DeliverySlotId?   : string;
    DeliveryDate?     : string;
    //  Resolves the address to a zone, and therefore to partners who can
    //  reach it. Required whenever either leg comes to the customer.
    SocietyId?        : string;
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
    SocietyId?            : string;
    PickupSlotBookingId?  : string;
    DeliverySlotBookingId?: string;
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

/**
 * Named windows the UI offers instead of making staff pick dates.
 * 'Today' and 'Week' are what the shop floor actually asks for; the explicit
 * From/To is the escape hatch for everything else.
 */
export type DatePreset = 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'All';

export interface OrderSearchFilters {
    TenantId?     : string;
    Status?       : OrderStatus;
    CustomerId?   : string;
    Query?        : string;

    //  --- Date range ---
    //  Preset is resolved to From/To server-side. An explicit From/To always
    //  wins, so a saved report URL keeps meaning the same thing tomorrow.
    Preset?       : DatePreset;
    FromDate?     : string;
    ToDate?       : string;

    //  --- Dimensions ---
    ServiceTypeCode?: string;
    Channel?        : OrderChannel;
    DeliveryType?   : OrderDeliveryType;
    IsExpress?      : boolean;
    BilledTo?       : BilledTo;

    SortBy?       : 'CreatedAt' | 'TotalInr' | 'OrderCode' | 'Status';
    SortOrder?    : 'ASC' | 'DESC';
    PageIndex?    : number;
    ItemsPerPage? : number;
}

/** Aggregates for the dashboard, over the same filter set. */
export interface OrderSummaryDto {
    Total          : number;
    RevenueInr     : string;
    ByStatus       : Record<string, number>;
    ByServiceType  : Record<string, number>;
    /** Daily buckets for a chart, oldest first. */
    Trend          : Array<{ Date: string; Count: number; RevenueInr: string }>;
}
