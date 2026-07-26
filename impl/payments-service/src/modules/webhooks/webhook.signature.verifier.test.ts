import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebhookSignatureVerifier } from './webhook.signature.verifier';

/////////////////////////////////////////////////////////////////////////
//  These endpoints are the one place an attacker can reach us with no
//  credential, so the signature check is load-bearing. The cases that
//  matter most are the negative ones — particularly that an unset secret
//  rejects rather than waves the request through.
/////////////////////////////////////////////////////////////////////////

const RZP_SECRET  = 'rzp_test_webhook_secret';
const ZOHO_SECRET = 'zoho_test_webhook_secret';

const rzpBody = Buffer.from(JSON.stringify({
    event   : 'payment.captured',
    payload : { payment: { entity: { id: 'pay_1', order_id: 'order_1' } } },
}));

const zohoBody = Buffer.from(JSON.stringify({
    event_type   : 'payment.succeeded',
    event_object : { payment: { payment_id: 'p1', reference_number: 'PTK-1' } },
}));

const rzpSign  = (secret: string, body: Buffer) => crypto.createHmac('sha256', secret).update(body).digest('hex');
const zohoSign = (secret: string, ts: number, body: Buffer) =>
    crypto.createHmac('sha256', secret).update(`${ts}.${body.toString('utf8')}`).digest('hex');

let savedEnv: NodeJS.ProcessEnv;
beforeEach(() => {
    savedEnv = { ...process.env };
    process.env.RAZORPAY_WEBHOOK_SECRET = RZP_SECRET;
    process.env.ZOHOPAY_WEBHOOK_SECRET  = ZOHO_SECRET;
});
afterEach(() => { process.env = savedEnv; });

describe('Razorpay webhook signatures', () => {

    it('accepts a signature produced with the configured secret', () => {
        const sig = rzpSign(RZP_SECRET, rzpBody);
        expect(WebhookSignatureVerifier.verifyRazorpay(rzpBody, sig).Verified).toBe(true);
    });

    it('rejects a body tampered with after signing', () => {
        const sig      = rzpSign(RZP_SECRET, rzpBody);
        const tampered = Buffer.from(rzpBody.toString().replace('pay_1', 'pay_ATTACKER'));
        expect(WebhookSignatureVerifier.verifyRazorpay(tampered, sig).Verified).toBe(false);
    });

    it('rejects a signature made with a different secret', () => {
        const sig = rzpSign('not-our-secret', rzpBody);
        expect(WebhookSignatureVerifier.verifyRazorpay(rzpBody, sig).Verified).toBe(false);
    });

    it.each([
        ['missing signature', undefined],
        ['garbage signature', 'deadbeef'],
        ['empty signature',   ''],
    ])('rejects %s', (_label, sig) => {
        expect(WebhookSignatureVerifier.verifyRazorpay(rzpBody, sig as string).Verified).toBe(false);
    });

    it('rejects when the raw body was not captured', () => {
        //Guards against a middleware regression silently disabling verification.
        const sig = rzpSign(RZP_SECRET, rzpBody);
        expect(WebhookSignatureVerifier.verifyRazorpay(undefined, sig).Verified).toBe(false);
    });
});

describe('Zoho Pay webhook signatures', () => {

    const now = 1_760_000_000_000;
    const ts  = Math.floor(now / 1000);

    it('accepts a well-formed t=,v= signature', () => {
        const sig = `t=${ts},v=${zohoSign(ZOHO_SECRET, ts, zohoBody)}`;
        expect(WebhookSignatureVerifier.verifyZohopay(zohoBody, sig, now).Verified).toBe(true);
    });

    it('signs over timestamp AND body, so a tampered body fails', () => {
        const sig      = `t=${ts},v=${zohoSign(ZOHO_SECRET, ts, zohoBody)}`;
        const tampered = Buffer.from(zohoBody.toString().replace('p1', 'pX'));
        expect(WebhookSignatureVerifier.verifyZohopay(tampered, sig, now).Verified).toBe(false);
    });

    it('rejects a replay of a validly-signed but stale event', () => {
        //The whole reason the timestamp is inside the signed message.
        const oldTs = ts - (10 * 60);
        const sig   = `t=${oldTs},v=${zohoSign(ZOHO_SECRET, oldTs, zohoBody)}`;
        expect(WebhookSignatureVerifier.verifyZohopay(zohoBody, sig, now).Verified).toBe(false);
    });

    it('tolerates modest clock skew', () => {
        const skewed = ts - 60;
        const sig    = `t=${skewed},v=${zohoSign(ZOHO_SECRET, skewed, zohoBody)}`;
        expect(WebhookSignatureVerifier.verifyZohopay(zohoBody, sig, now).Verified).toBe(true);
    });

    it.each([
        ['no separator',      'garbage'],
        ['timestamp only',    `t=${ts}`],
        ['signature only',    'v=abc'],
        ['non-numeric ts',    't=abc,v=def'],
    ])('rejects malformed header: %s', (_label, sig) => {
        expect(WebhookSignatureVerifier.verifyZohopay(zohoBody, sig, now).Verified).toBe(false);
    });
});

describe('fail-closed on misconfiguration', () => {

    //The bug this guards against: treating an unset secret as "verification
    //is off". That turns a deploy that forgot an env var into an open
    //endpoint that will mark any order paid. Rejecting is the only safe read.

    it('rejects every request when the Razorpay secret is unset', () => {
        const sig = rzpSign(RZP_SECRET, rzpBody);
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
        expect(WebhookSignatureVerifier.verifyRazorpay(rzpBody, sig).Verified).toBe(false);
    });

    it('rejects when the Razorpay secret is blank', () => {
        const sig = rzpSign(RZP_SECRET, rzpBody);
        process.env.RAZORPAY_WEBHOOK_SECRET = '   ';
        expect(WebhookSignatureVerifier.verifyRazorpay(rzpBody, sig).Verified).toBe(false);
    });

    it('rejects every request when the Zoho secret is unset', () => {
        const ts  = Math.floor(Date.now() / 1000);
        const sig = `t=${ts},v=${zohoSign(ZOHO_SECRET, ts, zohoBody)}`;
        delete process.env.ZOHOPAY_WEBHOOK_SECRET;
        expect(WebhookSignatureVerifier.verifyZohopay(zohoBody, sig).Verified).toBe(false);
    });
});
