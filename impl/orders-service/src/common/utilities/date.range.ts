import { DatePreset } from '../../domain.types/orders/order.types';

/////////////////////////////////////////////////////////////////////////
//  Date presets -> a concrete [From, To) window.
//
//  Resolved on the SERVER, not the client. Two reasons: a phone in a
//  different timezone would otherwise disagree with the shop about what
//  "today" means, and the shop's day is the only one that matters for a
//  shop's report.
//
//  Windows are half-open [From, To): the end is exclusive. Using an
//  inclusive end date drops orders placed later the same day, because
//  '2026-07-16' as a timestamp is midnight — the classic "where did today's
//  orders go" bug.
/////////////////////////////////////////////////////////////////////////

export interface DateRange {
    From: Date;
    To  : Date;
}

const startOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const addDays = (d: Date, n: number): Date => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
};

/**
 * Resolve a preset against `now`.
 *
 * `now` is injectable so this is testable without freezing the clock.
 * Returns null for 'All' — meaning "don't filter by date at all", which is
 * different from "an empty range".
 */
export const resolvePreset = (preset: DatePreset, now: Date = new Date()): DateRange | null => {
    const today = startOfDay(now);
    switch (preset) {
        case 'All':
            return null;
        case 'Today':
            return { From: today, To: addDays(today, 1) };
        case 'Yesterday':
            return { From: addDays(today, -1), To: today };
        //Rolling windows, not calendar ones: "this week" on a Monday morning
        //would otherwise show almost nothing, which reads as broken.
        case 'Week':
            return { From: addDays(today, -6), To: addDays(today, 1) };
        case 'Month':
            return { From: addDays(today, -29), To: addDays(today, 1) };
        case 'Quarter':
            return { From: addDays(today, -89), To: addDays(today, 1) };
        case 'Year':
            return { From: addDays(today, -364), To: addDays(today, 1) };
        default:
            return null;
    }
};

/**
 * Final window from a preset and/or explicit dates.
 *
 * Explicit dates win over a preset, so a bookmarked report URL keeps meaning
 * what it meant when it was saved.
 */
export const resolveRange = (
    opts: { Preset?: DatePreset; FromDate?: string; ToDate?: string },
    now: Date = new Date(),
): DateRange | null => {
    if (opts.FromDate || opts.ToDate) {
        const from = opts.FromDate ? startOfDay(new Date(opts.FromDate)) : new Date(0);
        //ToDate is inclusive to the user ("up to the 16th") but exclusive in
        //the query, so push it to the start of the NEXT day.
        const to = opts.ToDate ? addDays(startOfDay(new Date(opts.ToDate)), 1) : addDays(startOfDay(now), 1);
        return { From: from, To: to };
    }
    return opts.Preset ? resolvePreset(opts.Preset, now) : null;
};

/**
 * Format a Date as YYYY-MM-DD in LOCAL time.
 *
 * Not toISOString().slice(0,10) — that converts to UTC first. In IST (+5:30)
 * local midnight on the 16th is 18:30 UTC on the 15th, so every bucket label
 * would be a day early and an evening order would be charted under the wrong
 * date. The shop's day is local; the labels must be too.
 */
export const toLocalIso = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/** Every date in a range — so a chart shows zero-days rather than skipping them. */
export const eachDay = (range: DateRange): string[] => {
    const days: string[] = [];
    for (let d = new Date(range.From); d < range.To; d = addDays(d, 1)) {
        days.push(toLocalIso(d));
    }
    return days;
};
