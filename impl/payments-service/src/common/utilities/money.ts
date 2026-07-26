/////////////////////////////////////////////////////////////////////////
//  Money.
//
//  Rupees are carried as strings (TypeORM reads NUMERIC back as a string)
//  and all arithmetic happens in integer paise. Never in floats:
//  0.1 + 0.2 === 0.30000000000000004, and across a ledger that error
//  compounds until an invoice fails to foot by a paisa nobody can explain.
//
//  The rule: convert to paise at the edge, compute in integers, convert back
//  once at the end.
/////////////////////////////////////////////////////////////////////////

export class Money {

    /**
     * Rupees -> integer paise.
     *
     * Parses the decimal string directly rather than doing `value * 100`:
     * Number('19.99') * 100 is 1998.9999999999998, which truncates to 1998 —
     * a paisa lost on a very ordinary price.
     */
    public static toPaise = (value: number | string | null | undefined): number => {
        if (value === null || value === undefined || value === '') return 0;

        const raw = String(value).trim();
        const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(raw);
        if (!match) {
            //Fall back for exponential notation etc. Rounding, not truncating.
            const n = Number(raw);
            if (Number.isNaN(n)) throw new Error(`Not a valid money value: ${raw}`);
            return Math.round(n * 100);
        }

        const [, sign, whole = '0', frac = ''] = match;
        //Pad/truncate the fractional part to exactly 2 digits, rounding the
        //third digit rather than dropping it.
        const paiseFrac = frac.length === 0 ? 0
            : frac.length === 1 ? Number(frac) * 10
            : frac.length === 2 ? Number(frac)
            : Math.round(Number(`${frac.slice(0, 2)}.${frac.slice(2)}`));

        const total = Number(whole || '0') * 100 + paiseFrac;
        return sign === '-' ? -total : total;
    };

    /** Integer paise -> a 2-decimal rupee string, the shape NUMERIC columns take. */
    public static fromPaise = (paise: number): string => {
        const neg = paise < 0;
        const abs = Math.abs(Math.round(paise));
        const s   = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
        return neg ? `-${s}` : s;
    };

    public static add = (...values: Array<number | string>): string =>
        Money.fromPaise(values.reduce<number>((sum, v) => sum + Money.toPaise(v), 0));

    public static subtract = (a: number | string, b: number | string): string =>
        Money.fromPaise(Money.toPaise(a) - Money.toPaise(b));

    /** Multiply money by a plain count (e.g. a line quantity). */
    public static multiply = (value: number | string, factor: number): string =>
        Money.fromPaise(Math.round(Money.toPaise(value) * factor));

    /** A percentage of an amount — GST, express surcharge. Rounds to the paisa. */
    public static percentOf = (value: number | string, percent: number): string =>
        Money.fromPaise(Math.round((Money.toPaise(value) * percent) / 100));

    public static isZero        = (v: number | string) => Money.toPaise(v) === 0;
    public static isNegative    = (v: number | string) => Money.toPaise(v) < 0;
    public static compare       = (a: number | string, b: number | string) => Money.toPaise(a) - Money.toPaise(b);
    public static max           = (a: number | string, b: number | string) => (Money.compare(a, b) >= 0 ? Money.fromPaise(Money.toPaise(a)) : Money.fromPaise(Money.toPaise(b)));
    public static min           = (a: number | string, b: number | string) => (Money.compare(a, b) <= 0 ? Money.fromPaise(Money.toPaise(a)) : Money.fromPaise(Money.toPaise(b)));
}
