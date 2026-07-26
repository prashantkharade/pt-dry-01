import { OrderStatus, OrderChannel, OrderDeliveryType } from '../enums/order.enums';

/////////////////////////////////////////////////////////////////////////
//  The customer's view of where their order is.
//
//  Deliberately NOT the status history. That table is an admin audit log —
//  it carries internal enum names, who changed what, and every intermediate
//  hop. Showing it to a customer leaks vocabulary they never agreed to
//  ('OnHold', 'InProcess') and answers a question they didn't ask.
//
//  This is the journey instead: the fixed set of steps this particular
//  order will go through, which are done, which is happening now, and which
//  are still to come — the shape a delivery-tracking UI actually needs.
/////////////////////////////////////////////////////////////////////////

export type TrackingStepState = 'Done' | 'Current' | 'Upcoming' | 'Skipped' | 'Failed';

export interface TrackingStep {
    Key       : string;
    /** Plain-language, already localised by the caller's language. */
    Label     : string;
    LabelMr   : string;
    State     : TrackingStepState;
    /** When it happened. Null while Upcoming. */
    At?       : string;
    /** e.g. "Ravi is on the way" — the human detail under the step. */
    Detail?   : string;
}

export interface TrackingDto {
    OrderId       : string;
    OrderCode     : string;
    Status        : OrderStatus;
    /** 0-100, for a progress bar. */
    PercentComplete: number;
    IsComplete    : boolean;
    IsCancelled   : boolean;
    Steps         : TrackingStep[];

    //  The two legs, when this order has them.
    Pickup?  : TrackingLeg;
    Delivery?: TrackingLeg;

    /** Best current estimate, or null when we genuinely don't know. */
    EstimatedReadyAt?: string;
}

export interface TrackingLeg {
    Direction   : 'Pickup' | 'Delivery';
    Date?       : string;
    SlotName?   : string;
    SlotWindow? : string;
    Status?     : string;
    //Only exposed once a run is actually underway — a customer does not need
    //a partner's phone number the moment they book.
    PartnerName?: string;
    PartnerPhone?: string;
    ItemCount?  : number;
}

/**
 * The steps an order passes through, in order.
 *
 * `Channel`/`DeliveryType` decide which exist at all: a DropAtShop order has
 * no pickup step, and showing a greyed-out "we'll collect it" to someone
 * standing at the counter is just confusing.
 */
export const buildSteps = (channel: OrderChannel, deliveryType: OrderDeliveryType): Array<{
    Key: string; Label: string; LabelMr: string; Statuses: OrderStatus[];
}> => {
    const steps: Array<{ Key: string; Label: string; LabelMr: string; Statuses: OrderStatus[] }> = [
        { Key: 'booked', Label: 'Order placed', LabelMr: 'ऑर्डर दिली', Statuses: [OrderStatus.Booked] },
    ];

    if (channel === OrderChannel.HomePickup) {
        steps.push({ Key: 'pickup', Label: 'Picked up from you', LabelMr: 'तुमच्याकडून घेतले', Statuses: [OrderStatus.PickedUp] });
    }

    steps.push(
        { Key: 'received',  Label: 'Received at shop', LabelMr: 'दुकानात मिळाले',  Statuses: [OrderStatus.Received] },
        { Key: 'inprocess', Label: 'Being cleaned',    LabelMr: 'साफसफाई सुरू',    Statuses: [OrderStatus.InProcess] },
        { Key: 'ready',     Label: 'Ready',            LabelMr: 'तयार आहे',        Statuses: [OrderStatus.Ready] },
    );

    if (deliveryType === OrderDeliveryType.HomeDelivery) {
        steps.push({ Key: 'outfordelivery', Label: 'Out for delivery', LabelMr: 'डिलिव्हरीसाठी निघाले', Statuses: [OrderStatus.OutForDelivery] });
        steps.push({ Key: 'delivered',      Label: 'Delivered',        LabelMr: 'पोहोचली',            Statuses: [OrderStatus.Delivered, OrderStatus.Closed] });
    } else {
        steps.push({ Key: 'collected', Label: 'Collected by you', LabelMr: 'तुम्ही घेतले', Statuses: [OrderStatus.Delivered, OrderStatus.Closed] });
    }

    return steps;
};
