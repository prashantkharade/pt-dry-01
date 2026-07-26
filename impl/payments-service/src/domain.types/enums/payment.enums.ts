/////////////////////////////////////////////////////////////////////////
//  Payment domain enums + the transition map that governs them.
//
//  Money state must never move by accident. Every write to Payment.Status
//  goes through PaymentStateMachine.assertCanTransition, so a late or
//  duplicate provider webhook cannot walk a captured payment backwards.
/////////////////////////////////////////////////////////////////////////

export enum PaymentProvider {
    Razorpay = 'Razorpay',
    Zohopay  = 'Zohopay',
    Cash     = 'Cash',
    Wallet   = 'Wallet',
}

export enum PaymentStatus {
    Pending           = 'Pending',
    //Provider holds the funds but has not moved them yet.
    Authorized        = 'Authorized',
    Captured          = 'Captured',
    Failed            = 'Failed',
    Refunded          = 'Refunded',
    PartiallyRefunded = 'PartiallyRefunded',
    Cancelled         = 'Cancelled',
}

export enum RefundStatus {
    Pending   = 'Pending',
    Processed = 'Processed',
    Failed    = 'Failed',
}

export enum WalletTxnType {
    Credit = 'Credit',
    Debit  = 'Debit',
}

export enum WalletTxnReason {
    TopUp         = 'TopUp',
    OrderPayment  = 'OrderPayment',
    RefundToWallet= 'RefundToWallet',
    Adjustment    = 'Adjustment',
    //B2B vendors settle on credit terms; this is the drawdown.
    CreditDrawdown= 'CreditDrawdown',
}

/**
 * Legal status moves.
 *
 * Captured is NOT terminal — money can still come back out as a refund.
 * Refunded and Cancelled are terminal: nothing legitimately follows them.
 */
export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.Pending]           : [PaymentStatus.Authorized, PaymentStatus.Captured, PaymentStatus.Failed, PaymentStatus.Cancelled],
    //Authorize-then-capture is a two-step flow; a hold can also simply expire.
    [PaymentStatus.Authorized]        : [PaymentStatus.Captured, PaymentStatus.Failed, PaymentStatus.Cancelled],
    [PaymentStatus.Captured]          : [PaymentStatus.Refunded, PaymentStatus.PartiallyRefunded],
    [PaymentStatus.PartiallyRefunded] : [PaymentStatus.Refunded, PaymentStatus.PartiallyRefunded],
    //A failed attempt is dead. The customer retries by creating a NEW payment,
    //so we keep one row per attempt rather than resurrecting this one — the
    //audit trail of what was tried has to survive.
    [PaymentStatus.Failed]            : [],
    [PaymentStatus.Refunded]          : [],
    [PaymentStatus.Cancelled]         : [],
};

/** Statuses after which the money is ours and the order may proceed. */
export const SETTLED_STATUSES: PaymentStatus[] = [
    PaymentStatus.Captured, PaymentStatus.PartiallyRefunded,
];

/** Statuses that can never change again. */
export const TERMINAL_STATUSES: PaymentStatus[] = [
    PaymentStatus.Failed, PaymentStatus.Refunded, PaymentStatus.Cancelled,
];
