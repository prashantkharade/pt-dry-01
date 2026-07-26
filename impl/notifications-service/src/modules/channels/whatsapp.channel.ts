import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  WhatsApp via the Meta Cloud API.
//
//  The rule that shapes everything here: OUTSIDE a 24-hour customer-service
//  window, WhatsApp only permits pre-approved TEMPLATE messages. Free-form
//  text is rejected. An order confirmation is usually the first thing we say
//  to someone that day, so the template path is the NORMAL path and
//  free-form is the exception — not the other way round.
//
//  Templates are registered and approved in Meta Business Manager, not here.
//  This code only supplies the variables. An unapproved template fails at
//  send time with 132001, which is why the errors below are named rather
//  than passed through as "status code 400".
/////////////////////////////////////////////////////////////////////////

export interface WhatsAppResult {
    MessageId? : string;
    Skipped?   : boolean;
}

/** Meta error codes worth naming — the raw numbers are opaque. */
const ERROR_HINTS: Record<number, string> = {
    131_026: 'Recipient is not a WhatsApp user or cannot receive messages',
    132_000: 'Variable count does not match the approved template',
    132_001: 'Template does not exist or is not approved for this language',
    131_047: 'Outside the 24h window — free-form was rejected; an approved template is required',
    131_051: 'Unsupported message type',
    130_429: 'Rate limit hit',
};

@injectable()
export class WhatsAppChannel {

    private get phoneNumberId() { return ConfigurationManager.getEnvOptional('WHATSAPP_PHONE_NUMBER_ID'); }
    private get accessToken()   { return ConfigurationManager.getEnvOptional('WHATSAPP_ACCESS_TOKEN'); }
    private get apiVersion()    { return ConfigurationManager.getEnvOptional('WHATSAPP_API_VERSION') ?? 'v21.0'; }

    public get isConfigured(): boolean {
        return Boolean(this.phoneNumberId && this.accessToken);
    }

    private url(): string {
        return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    }

    /**
     * E.164 without the '+'. Meta wants a country code but no plus, and a bare
     * 10-digit Indian mobile silently goes nowhere — so default the country
     * rather than send into a void.
     */
    private static toWaId = (phone: string): string => {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) return `91${digits}`;
        return digits;
    };

    /**
     * Send an approved template.
     *
     * Meta templates use positional {{1}}, {{2}} placeholders, so the ORDER of
     * bodyParams matters and is the caller's responsibility.
     */
    public sendTemplate = async (
        toPhone      : string,
        templateName : string,
        language     : string,
        bodyParams   : string[],
    ): Promise<WhatsAppResult> => {
        if (!this.isConfigured) {
            logger.warn(`WhatsAppChannel not configured — would send template "${templateName}" to ${toPhone}`);
            return { Skipped: true };
        }
        return this.post({
            messaging_product: 'whatsapp',
            to               : WhatsAppChannel.toWaId(toPhone),
            type             : 'template',
            template         : {
                name      : templateName,
                language  : { code: language },
                components: bodyParams.length
                    ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) })) }]
                    : [],
            },
        }, toPhone);
    };

    /**
     * Free-form text.
     *
     * Only lands INSIDE the 24-hour window (the customer messaged us recently).
     * Outside it Meta rejects with 131047 — named in ERROR_HINTS so the log
     * says why rather than leaving a silent non-delivery.
     */
    public sendText = async (toPhone: string, body: string): Promise<WhatsAppResult> => {
        if (!this.isConfigured) {
            logger.warn(`WhatsAppChannel not configured — would send ${body.length} chars to ${toPhone}`);
            return { Skipped: true };
        }
        return this.post({
            messaging_product: 'whatsapp',
            to               : WhatsAppChannel.toWaId(toPhone),
            type             : 'text',
            //Let WhatsApp render the receipt link.
            text             : { preview_url: true, body },
        }, toPhone);
    };

    /**
     * What NotificationService calls.
     *
     * Prefers the approved template when one is mapped for this event; falls
     * back to free-form otherwise.
     */
    public send = async (toPhone: string, body: string, opts?: {
        TemplateCode?: string; Language?: string; Params?: string[];
    }): Promise<WhatsAppResult> => {
        const mapped = opts?.TemplateCode ? this.templateNameFor(opts.TemplateCode) : null;
        if (mapped) {
            return this.sendTemplate(toPhone, mapped, opts!.Language ?? 'en', opts!.Params ?? []);
        }
        return this.sendText(toPhone, body);
    };

    /**
     * Our event code -> the template name approved in Meta Business Manager.
     *
     * Configured, not hardcoded: the approved names belong to whoever owns the
     * WhatsApp Business account and will not match our internal codes.
     * Format: WHATSAPP_TEMPLATE_MAP="ORDER_BOOKED=ptk_order_booked,ORDER_READY=ptk_order_ready"
     */
    private templateNameFor = (code: string): string | null => {
        const raw = ConfigurationManager.getEnvOptional('WHATSAPP_TEMPLATE_MAP');
        if (!raw) return null;
        for (const pair of raw.split(',')) {
            const [k, v] = pair.split('=').map((x) => x.trim());
            if (k === code && v) return v;
        }
        return null;
    };

    private post = async (payload: Record<string, unknown>, toPhone: string): Promise<WhatsAppResult> => {
        try {
            const res = await axios.post(this.url(), payload, {
                headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
                timeout: 15_000,
            });
            const id = res.data?.messages?.[0]?.id;
            if (!id) throw new Error(`WhatsApp returned no message id: ${JSON.stringify(res.data)}`);
            logger.info(`WhatsApp sent to=${toPhone} id=${id}`);
            return { MessageId: id };
        } catch (error: any) {
            const meta = error?.response?.data?.error;
            const code = Number(meta?.code);
            const hint = ERROR_HINTS[code];
            //Name the failure. "Request failed with status code 400" tells an
            //operator nothing; "template not approved" tells them what to do.
            logger.error(`WhatsApp send failed to=${toPhone}: ${code || error?.response?.status || ''} ${meta?.message ?? error?.message}${hint ? ` — ${hint}` : ''}`);
            throw new Error(hint ?? meta?.message ?? error?.message);
        }
    };
}
