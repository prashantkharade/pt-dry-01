import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './seed.templates';

/////////////////////////////////////////////////////////////////////////
//  renderTemplate() looks up (Code, Channel, Language) and THROWS on a
//  miss. So a Marathi-preferring customer hitting a gap gets no
//  notification at all — not an English fallback.
//
//  These tests make that gap impossible to introduce silently.
/////////////////////////////////////////////////////////////////////////

const LANGUAGES = ['en', 'mr'] as const;

const key = (t: { Code: string; Channel: string }) => `${t.Code}/${t.Channel}`;

describe('bilingual coverage', () => {

    it('every Code+Channel exists in BOTH en and mr', () => {
        const byKey = new Map<string, Set<string>>();
        for (const t of TEMPLATES) {
            if (!byKey.has(key(t))) byKey.set(key(t), new Set());
            byKey.get(key(t))!.add(t.Language);
        }
        const gaps: string[] = [];
        for (const [k, langs] of byKey) {
            for (const lang of LANGUAGES) {
                if (!langs.has(lang)) gaps.push(`${k} is missing ${lang}`);
            }
        }
        expect(gaps).toEqual([]);
    });

    it('has no duplicate Code+Channel+Language', () => {
        //A duplicate would silently shadow the other at seed time.
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const t of TEMPLATES) {
            const k = `${t.Code}/${t.Channel}/${t.Language}`;
            if (seen.has(k)) dupes.push(k);
            seen.add(k);
        }
        expect(dupes).toEqual([]);
    });
});

describe('variable consistency', () => {

    const varsOf = (s: string): string[] =>
        [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

    it('en and mr of the same template use the SAME variables', () => {
        //A translator dropping {{OrderCode}} from the Marathi copy would
        //render a message with a hole in it and nobody would notice.
        const grouped = new Map<string, typeof TEMPLATES>();
        for (const t of TEMPLATES) {
            if (!grouped.has(key(t))) grouped.set(key(t), []);
            grouped.get(key(t))!.push(t);
        }
        const mismatches: string[] = [];
        for (const [k, group] of grouped) {
            const en = group.find((t) => t.Language === 'en');
            const mr = group.find((t) => t.Language === 'mr');
            if (!en || !mr) continue;
            const enVars = [...new Set(varsOf(`${en.Subject ?? ''} ${en.Body}`))];
            const mrVars = [...new Set(varsOf(`${mr.Subject ?? ''} ${mr.Body}`))];
            if (JSON.stringify(enVars) !== JSON.stringify(mrVars)) {
                mismatches.push(`${k}: en=[${enVars}] mr=[${mrVars}]`);
            }
        }
        expect(mismatches).toEqual([]);
    });
});

describe('channel shape', () => {

    it('every Email template has a Subject', () => {
        const missing = TEMPLATES.filter((t) => t.Channel === 'Email' && !t.Subject).map(key);
        expect(missing).toEqual([]);
    });

    it('every Push template has a Subject (it becomes the notification title)', () => {
        const missing = TEMPLATES.filter((t) => t.Channel === 'Push' && !t.Subject).map(key);
        expect(missing).toEqual([]);
    });

    it('no template body is empty', () => {
        expect(TEMPLATES.filter((t) => !t.Body?.trim()).map(key)).toEqual([]);
    });
});

describe('SMS length budget', () => {

    //Devanagari does not fit GSM-7, so an SMS containing it encodes as UCS-2:
    //70 chars per segment instead of 160. A long Marathi template silently
    //becomes 3 billed segments.
    const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

    it('SMS templates stay within a sane segment count', () => {
        const overlong: string[] = [];
        for (const t of TEMPLATES.filter((x) => x.Channel === 'SMS')) {
            //Assume ~12 chars per substituted variable.
            const rendered = t.Body.replace(/\{\{\s*\w+\s*\}\}/g, 'X'.repeat(12));
            const perSegment = hasDevanagari(t.Body) ? 70 : 160;
            const segments = Math.ceil(rendered.length / perSegment);
            if (segments > 3) overlong.push(`${key(t)}/${t.Language}: ~${rendered.length} chars = ${segments} segments`);
        }
        expect(overlong).toEqual([]);
    });
});

describe('the lifecycle is covered', () => {
    it('has a template for every customer-visible event', () => {
        const codes = new Set(TEMPLATES.map((t) => t.Code));
        for (const required of [
            'OTP_LOGIN', 'ORDER_BOOKED',
            'PICKUP_SCHEDULED', 'PICKUP_ON_THE_WAY', 'PICKUP_DONE',
            'ORDER_READY', 'OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'DELIVERY_FAILED',
            'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REFUND_PROCESSED',
        ]) {
            expect(codes, `missing template: ${required}`).toContain(required);
        }
    });
});
