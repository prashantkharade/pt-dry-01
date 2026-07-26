import { describe, it, expect } from 'vitest';
import { resolvePreset, resolveRange, eachDay, toLocalIso } from './date.range';

/////////////////////////////////////////////////////////////////////////
//  Date windows are quietly easy to get wrong, and wrong here means a
//  report silently omits orders — which nobody notices until month-end.
//  The half-open [From, To) contract is pinned down explicitly.
/////////////////////////////////////////////////////////////////////////

//A Thursday, mid-afternoon, in the shop's local time.
const NOW = new Date('2026-07-16T14:30:00');
//Local, not toISOString() — the boundaries are local midnights, and comparing
//them in UTC is exactly the off-by-one-day bug these tests exist to catch.
const iso = toLocalIso;

describe('presets', () => {

    it('Today runs from midnight to midnight tomorrow', () => {
        const r = resolvePreset('Today', NOW)!;
        expect(iso(r.From)).toBe('2026-07-16');
        expect(iso(r.To)).toBe('2026-07-17');
        //The 2:30pm order must be inside today.
        expect(NOW >= r.From && NOW < r.To).toBe(true);
    });

    it('Today includes an order placed at 23:59', () => {
        //The bug this guards: an inclusive end of '2026-07-16' is midnight, so
        //everything after 00:00 that day falls outside the window.
        const r = resolvePreset('Today', NOW)!;
        const late = new Date('2026-07-16T23:59:59');
        expect(late < r.To).toBe(true);
    });

    it('Yesterday excludes today', () => {
        const r = resolvePreset('Yesterday', NOW)!;
        expect(iso(r.From)).toBe('2026-07-15');
        expect(iso(r.To)).toBe('2026-07-16');
        expect(NOW >= r.To).toBe(true);
    });

    it('Week is a rolling 7 days ending today, not the calendar week', () => {
        //A calendar week on a Monday morning shows almost nothing, which
        //reads as a broken report.
        const r = resolvePreset('Week', NOW)!;
        expect(iso(r.From)).toBe('2026-07-10');
        expect(iso(r.To)).toBe('2026-07-17');
        expect(eachDay(r)).toHaveLength(7);
    });

    it('Month is a rolling 30 days', () => {
        const r = resolvePreset('Month', NOW)!;
        expect(eachDay(r)).toHaveLength(30);
        expect(iso(r.To)).toBe('2026-07-17');
    });

    it.each([['Quarter', 90], ['Year', 365]] as const)('%s spans %i days', (preset, days) => {
        expect(eachDay(resolvePreset(preset, NOW)!)).toHaveLength(days);
    });

    it('All means no date filter at all — not an empty range', () => {
        expect(resolvePreset('All', NOW)).toBeNull();
    });
});

describe('explicit ranges', () => {

    it('treats ToDate as inclusive for the user', () => {
        //"1st to 3rd" must include the whole of the 3rd.
        const r = resolveRange({ FromDate: '2026-07-01', ToDate: '2026-07-03' }, NOW)!;
        expect(iso(r.From)).toBe('2026-07-01');
        expect(iso(r.To)).toBe('2026-07-04');
        expect(new Date('2026-07-03T23:00:00') < r.To).toBe(true);
        expect(eachDay(r)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    });

    it('explicit dates beat a preset, so a saved report keeps its meaning', () => {
        const r = resolveRange({ Preset: 'Today', FromDate: '2026-01-01', ToDate: '2026-01-31' }, NOW)!;
        expect(iso(r.From)).toBe('2026-01-01');
        expect(iso(r.To)).toBe('2026-02-01');
    });

    it('FromDate alone runs up to end of today', () => {
        const r = resolveRange({ FromDate: '2026-07-14' }, NOW)!;
        expect(iso(r.From)).toBe('2026-07-14');
        expect(iso(r.To)).toBe('2026-07-17');
    });

    it('a single day resolves to exactly that day', () => {
        const r = resolveRange({ FromDate: '2026-07-16', ToDate: '2026-07-16' }, NOW)!;
        expect(eachDay(r)).toEqual(['2026-07-16']);
    });

    it('no preset and no dates means no filtering', () => {
        expect(resolveRange({}, NOW)).toBeNull();
    });
});

describe('eachDay', () => {
    it('lists every day so a chart can show zero-days rather than skip them', () => {
        const days = eachDay(resolveRange({ FromDate: '2026-07-01', ToDate: '2026-07-05' }, NOW)!);
        expect(days).toEqual(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
    });

    it('spans a month boundary correctly', () => {
        const days = eachDay(resolveRange({ FromDate: '2026-01-30', ToDate: '2026-02-02' }, NOW)!);
        expect(days).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
    });

    it('handles a leap day', () => {
        const days = eachDay(resolveRange({ FromDate: '2028-02-28', ToDate: '2028-03-01' }, NOW)!);
        expect(days).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    });
});
