import { describe, it, expect } from 'vitest';
import { Money } from './money';

/////////////////////////////////////////////////////////////////////////
//  Everything downstream — wallets, split payments, refunds, GST —
//  computes on top of this. A rounding bug here is a rounding bug in
//  every invoice, so the awkward cases get pinned down explicitly.
/////////////////////////////////////////////////////////////////////////

describe('Money.toPaise', () => {

    it.each([
        ['0',        0],
        ['1',        100],
        ['0.01',     1],
        ['19.99',    1999],
        ['100.00',   10000],
        ['1234.56',  123456],
        ['-50.25',  -5025],
    ])('parses %s -> %i paise', (input, expected) => {
        expect(Money.toPaise(input)).toBe(expected);
    });

    it('does not lose a paisa on values float multiplication would break', () => {
        //Number('19.99') * 100 === 1998.9999999999998 -> truncates to 1998.
        expect(Money.toPaise('19.99')).toBe(1999);
        expect(Money.toPaise('0.29')).toBe(29);
        expect(Money.toPaise('1.15')).toBe(115);
        expect(Money.toPaise('8.20')).toBe(820);
    });

    it('treats a single decimal digit as tenths, not hundredths', () => {
        //'40.5' is forty rupees fifty paise, not forty rupees five paise.
        expect(Money.toPaise('40.5')).toBe(4050);
    });

    it('rounds a third decimal rather than dropping it', () => {
        expect(Money.toPaise('1.005')).toBe(101);
        expect(Money.toPaise('1.004')).toBe(100);
    });

    it.each([null, undefined, ''])('treats %s as zero', (v) => {
        expect(Money.toPaise(v as unknown as string)).toBe(0);
    });

    it('accepts numbers as well as strings', () => {
        expect(Money.toPaise(19.99)).toBe(1999);
    });
});

describe('Money.fromPaise', () => {

    it.each([
        [0,       '0.00'],
        [1,       '0.01'],
        [100,     '1.00'],
        [1999,    '19.99'],
        [123456,  '1234.56'],
        [-5025,   '-50.25'],
    ])('formats %i paise -> %s', (input, expected) => {
        expect(Money.fromPaise(input)).toBe(expected);
    });

    it('always pads to two decimals, as NUMERIC(15,2) expects', () => {
        expect(Money.fromPaise(1050)).toBe('10.50');
        expect(Money.fromPaise(1005)).toBe('10.05');
    });
});

describe('round-tripping', () => {
    it.each(['0.00', '0.01', '19.99', '40.50', '1234.56', '99999.99'])('%s survives a round trip', (v) => {
        expect(Money.fromPaise(Money.toPaise(v))).toBe(v);
    });
});

describe('arithmetic', () => {

    it('adds without float drift', () => {
        //The canonical float failure: 0.1 + 0.2 !== 0.3
        expect(Money.add('0.10', '0.20')).toBe('0.30');
    });

    it('sums a realistic invoice exactly', () => {
        //3 shirts @ 50 + 40 delivery + 18% GST on 190
        const subtotal = Money.multiply('50.00', 3);
        const withDelivery = Money.add(subtotal, '40.00');
        const gst = Money.percentOf(withDelivery, 18);
        expect(subtotal).toBe('150.00');
        expect(withDelivery).toBe('190.00');
        expect(gst).toBe('34.20');
        expect(Money.add(withDelivery, gst)).toBe('224.20');
    });

    it('subtracts', () => {
        expect(Money.subtract('100.00', '19.99')).toBe('80.01');
    });

    it('goes negative correctly (B2B credit drawdown)', () => {
        expect(Money.subtract('0.00', '250.50')).toBe('-250.50');
    });

    it('accumulates a hundred small amounts without drift', () => {
        //Do this in floats and you land at 1.0000000000000007
        let total = '0.00';
        for (let i = 0; i < 100; i++) total = Money.add(total, '0.01');
        expect(total).toBe('1.00');
    });

    it('multiplies by a quantity', () => {
        expect(Money.multiply('19.99', 3)).toBe('59.97');
    });

    it('computes a percentage to the paisa', () => {
        expect(Money.percentOf('100.00', 18)).toBe('18.00');
        expect(Money.percentOf('19.99', 18)).toBe('3.60');   // 3.5982 -> 3.60
    });
});

describe('comparison', () => {
    it('compares by value, not string', () => {
        //'9.00' > '10.00' lexically — this is why comparison needs a helper.
        expect(Money.compare('10.00', '9.00')).toBeGreaterThan(0);
        expect(Money.compare('9.00', '10.00')).toBeLessThan(0);
        expect(Money.compare('10.00', '10.00')).toBe(0);
    });

    it('detects zero and negative', () => {
        expect(Money.isZero('0.00')).toBe(true);
        expect(Money.isZero('0.01')).toBe(false);
        expect(Money.isNegative('-0.01')).toBe(true);
    });

    it('min/max return money strings', () => {
        expect(Money.max('10.00', '9.99')).toBe('10.00');
        expect(Money.min('10.00', '9.99')).toBe('9.99');
    });
});
