import crypto from 'node:crypto';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Webhook signature verification.
//
//  A webhook endpoint is unauthenticated by construction — the provider
//  POSTs to it directly and cannot carry our JWT. The HMAC signature over
//  the raw body IS the authentication. Anyone who can reach the URL can
//  otherwise claim any payment succeeded.
//
//  Two invariants hold for every verifier here:
//
//  1) FAIL CLOSED. A missing/blank secret rejects the request. It must
//     never be read as "verification disabled" — that turns a config
//     mistake into a silent auth bypass in production.
//  2) Compare with timingSafeEqual over raw bytes. String `!==` leaks the
//     signature one byte at a time to an attacker who can measure latency.
/////////////////////////////////////////////////////////////////////////

export type WebhookProvider = 'Razorpay' | 'Zohopay';

//Zoho replay window. Five minutes is the usual provider-side clock-skew
//allowance; wider defeats the point of signing the timestamp at all.
const ZOHO_TOLERANCE_MS = 5 * 60 * 1000;

export interface VerificationResult {
    Verified : boolean;
    Reason?  : string;
    //Provider's own event id, when the payload carries one. Used to dedupe replays.
    EventId? : string;
}

/**
 * Constant-time compare of two hex digests.
 *
 * `timingSafeEqual` throws when the buffers differ in length, so the length
 * check has to happen first — and a length mismatch is already a definitive
 * "no", which leaks nothing an attacker can't see from the digest algorithm.
 */
const safeEqualHex = (expected: string, actual: string): boolean => {
    if (typeof actual !== 'string' || expected.length !== actual.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'));
    } catch {
        return false;
    }
};

const hmacHex = (secret: string, payload: string | Buffer): string =>
    crypto.createHmac('sha256', secret).update(payload).digest('hex');

export class WebhookSignatureVerifier {

    /**
     * Razorpay: HMAC-SHA256 of the raw body, keyed by the webhook secret,
     * hex-encoded, sent in `x-razorpay-signature`.
     */
    public static verifyRazorpay = (rawBody: Buffer | undefined, signature: string | undefined): VerificationResult => {
        const secret = ConfigurationManager.getEnvOptional('RAZORPAY_WEBHOOK_SECRET');
        if (!secret || secret.trim() === '') {
            return { Verified: false, Reason: 'RAZORPAY_WEBHOOK_SECRET is not configured' };
        }
        if (!rawBody || rawBody.length === 0) {
            return { Verified: false, Reason: 'Raw request body unavailable' };
        }
        if (!signature) {
            return { Verified: false, Reason: 'Missing x-razorpay-signature header' };
        }
        const expected = hmacHex(secret, rawBody);
        if (!safeEqualHex(expected, signature)) {
            return { Verified: false, Reason: 'Signature mismatch' };
        }
        return { Verified: true };
    };

    /**
     * Zoho Pay: `x-zoho-webhook-signature: t=<unix-ts>,v=<hex>`, where the
     * signed message is `${timestamp}.${rawBody}`.
     *
     * The timestamp is part of the signed message specifically so it can be
     * age-checked: without that check a captured-but-valid payload can be
     * replayed forever. We reject anything outside a tolerance window.
     */
    public static verifyZohopay = (
        rawBody   : Buffer | undefined,
        signature : string | undefined,
        nowMs     : number = Date.now(),
    ): VerificationResult => {
        const secret = ConfigurationManager.getEnvOptional('ZOHOPAY_WEBHOOK_SECRET');
        if (!secret || secret.trim() === '') {
            return { Verified: false, Reason: 'ZOHOPAY_WEBHOOK_SECRET is not configured' };
        }
        if (!rawBody || rawBody.length === 0) {
            return { Verified: false, Reason: 'Raw request body unavailable' };
        }
        if (!signature) {
            return { Verified: false, Reason: 'Missing x-zoho-webhook-signature header' };
        }

        const parts: Record<string, string> = {};
        for (const segment of signature.split(',')) {
            const idx = segment.indexOf('=');
            if (idx <= 0) continue;
            parts[segment.slice(0, idx).trim()] = segment.slice(idx + 1).trim();
        }
        const timestamp = parts['t'];
        const provided  = parts['v'];
        if (!timestamp || !provided) {
            return { Verified: false, Reason: 'Malformed signature header (expected "t=<ts>,v=<sig>")' };
        }

        const tsSeconds = Number(timestamp);
        if (!Number.isFinite(tsSeconds)) {
            return { Verified: false, Reason: 'Signature timestamp is not a number' };
        }
        const ageMs = Math.abs(nowMs - (tsSeconds * 1000));
        if (ageMs > ZOHO_TOLERANCE_MS) {
            return { Verified: false, Reason: `Signature timestamp outside ${ZOHO_TOLERANCE_MS / 60000}min tolerance` };
        }

        const expected = hmacHex(secret, `${timestamp}.${rawBody.toString('utf8')}`);
        if (!safeEqualHex(expected, provided)) {
            return { Verified: false, Reason: 'Signature mismatch' };
        }
        return { Verified: true };
    };

    public static verify = (
        provider  : WebhookProvider,
        rawBody   : Buffer | undefined,
        signature : string | undefined,
    ): VerificationResult => {
        const result = provider === 'Razorpay'
            ? WebhookSignatureVerifier.verifyRazorpay(rawBody, signature)
            : WebhookSignatureVerifier.verifyZohopay(rawBody, signature);

        if (!result.Verified) {
            //Never log the signature or body — an attacker probing the endpoint
            //shouldn't get our logs to echo back what they sent.
            logger.warn(`${provider}.webhook rejected: ${result.Reason}`);
        }
        return result;
    };
}
