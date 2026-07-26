import { PaymentStatus, PAYMENT_STATUS_TRANSITIONS, TERMINAL_STATUSES } from '../enums/payment.enums';
import { ErrorHandler } from '../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  The one gate every payment status change passes through.
//
//  Payment events do NOT arrive in order. A provider can deliver
//  payment.captured and payment.failed for the same payment seconds apart,
//  retry either of them hours later, and a client-side verify can race the
//  webhook for the same transition. Without a state machine, whichever
//  request lands last wins — and "captured payment silently marked Failed"
//  means a paying customer's order gets cancelled.
/////////////////////////////////////////////////////////////////////////

export class PaymentStateMachine {

    public static canTransition = (from: PaymentStatus, to: PaymentStatus): boolean =>
        (PAYMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);

    public static isTerminal = (status: PaymentStatus): boolean =>
        TERMINAL_STATUSES.includes(status);

    /**
     * Throw unless the move is legal.
     *
     * A no-op (from === to) is explicitly allowed and reported as such, so a
     * duplicate webhook is a quiet success rather than a 409 that makes the
     * provider retry forever.
     */
    public static assertCanTransition = (from: PaymentStatus, to: PaymentStatus): void => {
        if (from === to) return;
        if (!PaymentStateMachine.canTransition(from, to)) {
            ErrorHandler.throwConflictError(
                `Cannot move a payment from ${from} to ${to}`,
                { From: from, To: to, Allowed: PAYMENT_STATUS_TRANSITIONS[from] ?? [] },
            );
        }
    };

    /**
     * Decide what a late/duplicate event should do, without throwing.
     *
     * Webhook handlers use this instead of assertCanTransition: an out-of-order
     * event is normal provider behaviour, not a client error, and answering it
     * with a non-2xx just makes the provider hammer us harder.
     */
    public static resolve = (from: PaymentStatus, to: PaymentStatus): {
        Apply : boolean;
        Reason: string;
    } => {
        if (from === to)                                  return { Apply: false, Reason: 'Already in this state (duplicate event)' };
        if (PaymentStateMachine.isTerminal(from))         return { Apply: false, Reason: `Payment is terminal (${from}); ignoring late ${to}` };
        if (!PaymentStateMachine.canTransition(from, to)) return { Apply: false, Reason: `Illegal transition ${from} -> ${to}; ignoring` };
        return { Apply: true, Reason: 'ok' };
    };
}
