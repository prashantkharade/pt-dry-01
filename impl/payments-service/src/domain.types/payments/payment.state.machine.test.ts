import { describe, it, expect } from 'vitest';
import { PaymentStateMachine } from './payment.state.machine';
import { PaymentStatus } from '../enums/payment.enums';

/////////////////////////////////////////////////////////////////////////
//  Providers deliver events out of order and retry them for hours. These
//  tests pin the rule that a captured payment can never be walked back to
//  Failed by a late event — which would cancel a paying customer's order.
/////////////////////////////////////////////////////////////////////////

describe('legal transitions', () => {
    it.each([
        [PaymentStatus.Pending,    PaymentStatus.Authorized],
        [PaymentStatus.Pending,    PaymentStatus.Captured],
        [PaymentStatus.Pending,    PaymentStatus.Failed],
        [PaymentStatus.Pending,    PaymentStatus.Cancelled],
        [PaymentStatus.Authorized, PaymentStatus.Captured],
        [PaymentStatus.Captured,   PaymentStatus.Refunded],
        [PaymentStatus.Captured,   PaymentStatus.PartiallyRefunded],
        [PaymentStatus.PartiallyRefunded, PaymentStatus.Refunded],
    ])('%s -> %s is allowed', (from, to) => {
        expect(PaymentStateMachine.canTransition(from, to)).toBe(true);
    });
});

describe('illegal transitions', () => {
    it('a captured payment can never become Failed', () => {
        //The one that matters: a late payment.failed arriving after
        //payment.captured would otherwise cancel a paid order.
        expect(PaymentStateMachine.canTransition(PaymentStatus.Captured, PaymentStatus.Failed)).toBe(false);
    });

    it('a failed payment cannot be resurrected — the retry is a new attempt', () => {
        expect(PaymentStateMachine.canTransition(PaymentStatus.Failed, PaymentStatus.Captured)).toBe(false);
        expect(PaymentStateMachine.canTransition(PaymentStatus.Failed, PaymentStatus.Pending)).toBe(false);
    });

    it('a refunded payment is final', () => {
        expect(PaymentStateMachine.canTransition(PaymentStatus.Refunded, PaymentStatus.Captured)).toBe(false);
        expect(PaymentStateMachine.canTransition(PaymentStatus.Refunded, PaymentStatus.Refunded)).toBe(false);
    });

    it('cannot go back to Pending from anywhere', () => {
        for (const from of Object.values(PaymentStatus)) {
            if (from === PaymentStatus.Pending) continue;
            expect(PaymentStateMachine.canTransition(from, PaymentStatus.Pending)).toBe(false);
        }
    });

    it('cannot capture without going through Pending or Authorized', () => {
        expect(PaymentStateMachine.canTransition(PaymentStatus.Cancelled, PaymentStatus.Captured)).toBe(false);
    });
});

describe('terminal states', () => {
    it.each([PaymentStatus.Failed, PaymentStatus.Refunded, PaymentStatus.Cancelled])('%s is terminal', (s) => {
        expect(PaymentStateMachine.isTerminal(s)).toBe(true);
    });

    it('Captured is NOT terminal — money can still be refunded', () => {
        expect(PaymentStateMachine.isTerminal(PaymentStatus.Captured)).toBe(false);
    });
});

describe('resolve() — what a webhook handler should do', () => {

    it('applies a legal move', () => {
        const r = PaymentStateMachine.resolve(PaymentStatus.Pending, PaymentStatus.Captured);
        expect(r.Apply).toBe(true);
    });

    it('treats a duplicate event as a quiet no-op, not an error', () => {
        //Providers retry. Answering non-2xx just makes them retry harder.
        const r = PaymentStateMachine.resolve(PaymentStatus.Captured, PaymentStatus.Captured);
        expect(r.Apply).toBe(false);
        expect(r.Reason).toMatch(/duplicate/i);
    });

    it('ignores a late failure after capture', () => {
        const r = PaymentStateMachine.resolve(PaymentStatus.Captured, PaymentStatus.Failed);
        expect(r.Apply).toBe(false);
        expect(r.Reason).toMatch(/illegal/i);
    });

    it('ignores any event once terminal', () => {
        const r = PaymentStateMachine.resolve(PaymentStatus.Refunded, PaymentStatus.Captured);
        expect(r.Apply).toBe(false);
        expect(r.Reason).toMatch(/terminal/i);
    });

    it('never throws — out-of-order delivery is normal, not a client error', () => {
        for (const from of Object.values(PaymentStatus)) {
            for (const to of Object.values(PaymentStatus)) {
                expect(() => PaymentStateMachine.resolve(from, to)).not.toThrow();
            }
        }
    });
});

describe('assertCanTransition()', () => {
    it('allows a no-op', () => {
        expect(() => PaymentStateMachine.assertCanTransition(PaymentStatus.Captured, PaymentStatus.Captured)).not.toThrow();
    });
    it('throws on an illegal move', () => {
        expect(() => PaymentStateMachine.assertCanTransition(PaymentStatus.Captured, PaymentStatus.Failed)).toThrow();
    });
});
