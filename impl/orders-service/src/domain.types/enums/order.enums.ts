/////////////////////////////////////////////////////////////////////////
//  Domain enums for the Orders aggregate. Kept here (not on the entity)
//  so other layers can reference them without pulling TypeORM in.
/////////////////////////////////////////////////////////////////////////

export enum OrderStatus {
    Booked         = 'Booked',
    PickedUp       = 'PickedUp',
    Received       = 'Received',
    InProcess      = 'InProcess',
    Ready          = 'Ready',
    OutForDelivery = 'OutForDelivery',
    Delivered      = 'Delivered',
    Closed         = 'Closed',
    Cancelled      = 'Cancelled',
    OnHold         = 'OnHold',
}

export enum OrderChannel {
    HomePickup = 'HomePickup',
    DropAtShop = 'DropAtShop',
}

export enum OrderDeliveryType {
    HomeDelivery   = 'HomeDelivery',
    CustomerPickup = 'CustomerPickup',
}

export enum BilledTo {
    Customer = 'Customer',
    Vendor   = 'Vendor',
}

export enum ServiceTypeCode {
    DryClean  = 'DRY_CLEAN',
    Laundry   = 'LAUNDRY',
    PressOnly = 'PRESS_ONLY',
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.Booked]         : [OrderStatus.PickedUp, OrderStatus.Received, OrderStatus.Cancelled, OrderStatus.OnHold],
    [OrderStatus.PickedUp]       : [OrderStatus.Received, OrderStatus.InProcess, OrderStatus.Cancelled, OrderStatus.OnHold],
    [OrderStatus.Received]       : [OrderStatus.InProcess, OrderStatus.Cancelled, OrderStatus.OnHold],
    [OrderStatus.InProcess]      : [OrderStatus.Ready, OrderStatus.OnHold],
    [OrderStatus.Ready]          : [OrderStatus.OutForDelivery, OrderStatus.Delivered, OrderStatus.OnHold],
    [OrderStatus.OutForDelivery] : [OrderStatus.Delivered],
    [OrderStatus.Delivered]      : [OrderStatus.Closed],
    [OrderStatus.Closed]         : [],
    [OrderStatus.Cancelled]      : [],
    [OrderStatus.OnHold]         : [OrderStatus.InProcess, OrderStatus.Cancelled],
};
