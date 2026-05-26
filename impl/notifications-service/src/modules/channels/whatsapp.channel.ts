import { injectable } from 'tsyringe';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

@injectable()
export class WhatsAppChannel {

    public send = async (phone: string, body: string): Promise<{ MessageId?: string }> => {
        if (!ConfigurationManager.WhatsAppEnabled) {
            logger.info(`WhatsAppChannel: feature flag off, skipping send to ${phone}`);
            return {};
        }
        // Meta Cloud API to be wired here.
        logger.warn(`WhatsAppChannel (stub): would send to=${phone}`);
        return {};
    };
}
