import { injectable } from 'tsyringe';
import axios from 'axios';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  MSG91-backed SMS channel. Falls back to a no-op when keys aren't set
//  so the service is still useful in dev / CI.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class SmsChannel {

    public send = async (phone: string, body: string): Promise<{ MessageId?: string }> => {
        const authKey = ConfigurationManager.getEnvOptional('MSG91_AUTH_KEY');
        if (!authKey) {
            logger.warn(`SmsChannel (stub): would send to ${phone} body="${body.slice(0, 80)}"`);
            return {};
        }
        const sender = ConfigurationManager.getEnv('MSG91_SENDER', 'PTKHRD');
        const url    = `https://api.msg91.com/api/v5/flow/`;
        const res = await axios.post(url, {
            template_id: ConfigurationManager.getEnv('MSG91_TEMPLATE_ID'),
            sender,
            recipients : [{ mobiles: phone.replace('+', ''), VAR1: body }],
        }, { headers: { authkey: authKey }, timeout: 5000 });
        return { MessageId: res.data?.request_id };
    };
}
