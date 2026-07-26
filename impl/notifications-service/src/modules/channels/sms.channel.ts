import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  SMS.
//
//  Two providers, chosen by SMS_PROVIDER: MSG91 (DLT-registered template
//  flows, which is what Indian transactional SMS requires) and SMSCountry
//  (plain text). Unset keys fall back to a logging no-op so the whole
//  notification flow stays testable in dev.
//
//  Nothing here logs the message body: OTPs and order details go through
//  this channel, and the reference implementation dumped both into logs at
//  info level.
/////////////////////////////////////////////////////////////////////////

export type SmsProvider = 'MSG91' | 'SMSCountry' | 'Mock';

export interface SmsResult {
    MessageId? : string;
    Skipped?   : boolean;
}

@injectable()
export class SmsChannel {

    private get provider(): SmsProvider {
        const configured = ConfigurationManager.getEnvOptional('SMS_PROVIDER') as SmsProvider | undefined;
        if (configured) return configured;
        //Infer from whichever credentials are present, so a deploy that sets
        //keys but forgets SMS_PROVIDER still works.
        if (ConfigurationManager.getEnvOptional('MSG91_AUTH_KEY'))        return 'MSG91';
        if (ConfigurationManager.getEnvOptional('SMSCOUNTRY_AUTH_KEY'))   return 'SMSCountry';
        return 'Mock';
    }

    public get isConfigured(): boolean {
        return this.provider !== 'Mock';
    }

    /** E.164 in, provider-shaped out. Indian gateways want a bare 10-digit MSISDN. */
    private static toMsisdn = (phone: string): string => phone.replace(/^\+/, '').replace(/\D/g, '');

    public send = async (phone: string, body: string, templateVars?: Record<string, string>): Promise<SmsResult> => {
        switch (this.provider) {
            case 'MSG91'      : return this.sendViaMsg91(phone, body, templateVars);
            case 'SMSCountry' : return this.sendViaSmsCountry(phone, body);
            default:
                //Log the recipient and length, never the body.
                logger.warn(`SmsChannel not configured — would send ${body.length} chars to ${phone}`);
                return { Skipped: true };
        }
    };

    /**
     * MSG91 flow API. Indian transactional SMS is DLT-regulated: the template
     * is pre-registered and we only supply variables, so `body` is not sent
     * verbatim — templateVars is the real payload.
     */
    private sendViaMsg91 = async (phone: string, body: string, templateVars?: Record<string, string>): Promise<SmsResult> => {
        const authKey = ConfigurationManager.getEnv('MSG91_AUTH_KEY');
        try {
            const res = await axios.post(
                'https://api.msg91.com/api/v5/flow/',
                {
                    template_id : ConfigurationManager.getEnv('MSG91_TEMPLATE_ID'),
                    sender      : ConfigurationManager.getEnv('MSG91_SENDER', 'PTKHRD'),
                    recipients  : [{
                        mobiles : SmsChannel.toMsisdn(phone),
                        //VAR1 keeps the simple single-variable template working;
                        //richer templates pass their own named vars.
                        ...(templateVars ?? { VAR1: body }),
                    }],
                },
                { headers: { authkey: authKey }, timeout: 10_000 },
            );
            const id = res.data?.request_id;
            if (!id) {
                //MSG91 answers 200 with a body-level error. Treating that as
                //success is how "sent" messages silently never arrive.
                throw new Error(`MSG91 returned no request_id: ${JSON.stringify(res.data)}`);
            }
            logger.info(`SMS sent via MSG91 to=${phone} requestId=${id}`);
            return { MessageId: id };
        } catch (error: any) {
            logger.error(`MSG91 send failed to=${phone}: ${error?.response?.status ?? ''} ${error?.message}`);
            throw error;
        }
    };

    private sendViaSmsCountry = async (phone: string, body: string): Promise<SmsResult> => {
        const authKey   = ConfigurationManager.getEnv('SMSCOUNTRY_AUTH_KEY');
        const authToken = ConfigurationManager.getEnv('SMSCOUNTRY_AUTH_TOKEN');
        const senderId  = ConfigurationManager.getEnv('SMSCOUNTRY_SENDER_ID', 'PTKHRD');
        const auth      = Buffer.from(`${authKey}:${authToken}`).toString('base64');
        try {
            const res = await axios.post(
                `https://restapi.smscountry.com/v0.1/Accounts/${authKey}/SMSes/`,
                { Text: body, Number: SmsChannel.toMsisdn(phone), SenderId: senderId, Tool: 'API' },
                { headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` }, timeout: 10_000 },
            );
            const accepted = res.status === 202 || res.data?.ResponseCode === '202';
            if (!accepted) throw new Error(`SMSCountry rejected the message: ${JSON.stringify(res.data)}`);
            logger.info(`SMS sent via SMSCountry to=${phone} id=${res.data?.MessageUUID ?? 'n/a'}`);
            return { MessageId: res.data?.MessageUUID };
        } catch (error: any) {
            logger.error(`SMSCountry send failed to=${phone}: ${error?.response?.status ?? ''} ${error?.message}`);
            throw error;
        }
    };
}
