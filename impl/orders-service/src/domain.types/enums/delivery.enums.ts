/////////////////////////////////////////////////////////////////////////
//  Delivery-domain enums.
//
//  Laundry is a TWO-LEG business: we collect garments from the customer,
//  process them, and return them. Every slot booking and every partner
//  assignment therefore carries a Direction — the same order occupies one
//  Pickup slot and, later, one Delivery slot.
//
//  (The reference implementation this domain is modelled on is one-way
//  hub->customer only, so the two-leg shape is ours, not a port.)
/////////////////////////////////////////////////////////////////////////

/** The leg a booking/assignment belongs to. */
export enum DeliveryDirection {
    Pickup   = 'Pickup',
    Delivery = 'Delivery',
}

/**
 * What a slot template may be used for. `Both` means the window is open to
 * either leg — bookings still record a concrete Direction.
 */
export enum SlotType {
    Pickup   = 'Pickup',
    Delivery = 'Delivery',
    Both     = 'Both',
}

/** Lifecycle of one partner run (one leg of one order). */
export enum AssignmentStatus {
    Assigned  = 'Assigned',
    Started   = 'Started',
    Arrived   = 'Arrived',
    Completed = 'Completed',
    Failed    = 'Failed',
    Cancelled = 'Cancelled',
}

export const ASSIGNMENT_STATUS_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
    //A partner may fail a run at any point before completing it — customer not
    //home, gate locked, nobody to hand over to.
    [AssignmentStatus.Assigned]  : [AssignmentStatus.Started, AssignmentStatus.Failed, AssignmentStatus.Cancelled],
    [AssignmentStatus.Started]   : [AssignmentStatus.Arrived, AssignmentStatus.Failed, AssignmentStatus.Cancelled],
    [AssignmentStatus.Arrived]   : [AssignmentStatus.Completed, AssignmentStatus.Failed],
    [AssignmentStatus.Completed] : [],
    //Failed is not terminal: a failed run is re-attempted by re-assigning it.
    [AssignmentStatus.Failed]    : [AssignmentStatus.Assigned],
    [AssignmentStatus.Cancelled] : [],
};

export enum VehicleType {
    Bike    = 'Bike',
    Cycle   = 'Cycle',
    Scooter = 'Scooter',
    Van     = 'Van',
    Walking = 'Walking',
}

export enum ShiftPreference {
    Morning = 'Morning',
    Evening = 'Evening',
    Full    = 'Full',
}

/**
 * Which order statuses each leg drives the order to on completion.
 * Pickup completed -> the garments are with us. Delivery completed -> done.
 */
export const DIRECTION_COMPLETION_STATUS: Record<DeliveryDirection, string> = {
    [DeliveryDirection.Pickup]   : 'Received',
    [DeliveryDirection.Delivery] : 'Delivered',
};
