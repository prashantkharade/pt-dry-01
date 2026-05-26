import { injectable } from 'tsyringe';
import { logger } from '../../logger/logger';

@injectable()
export class PushChannel {

    public send = async (deviceToken: string, title: string, body: string): Promise<{ MessageId?: string }> => {
        // Firebase Admin SDK to be wired here; logging path keeps the rest of
        // the stack runnable without GCP creds in dev.
        logger.warn(`PushChannel (stub): device=${deviceToken.slice(0, 8)}... title="${title}"`);
        return {};
    };
}
