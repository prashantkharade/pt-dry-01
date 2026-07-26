import { container } from 'tsyringe';
import { logger } from '../logger/logger';
import { NotificationQueue } from '../modules/queue/notification.queue';
import { NotificationService } from '../database/typeorm/services/notification.service';
import { EmailChannel } from '../modules/channels/email.channel';

export class Loader {
    public static init = async (): Promise<boolean> => {
        //Connect the queue, then start the worker that drains it. The worker
        //delegates back to NotificationService.deliver, which owns the channel
        //dispatch and the log row.
        NotificationQueue.connect();
        const notifications = container.resolve(NotificationService);
        NotificationQueue.startWorker((job) => notifications.deliver(job));

        //Prove the SMTP credentials at boot rather than on the first real order
        //confirmation. Non-fatal: mail being down should not stop the service
        //answering, and the queue retries.
        const email = container.resolve(EmailChannel);
        if (email.isConfigured) {
            await email.verifyConnection();
        } else {
            logger.warn('SMTP is not configured — email notifications will be Skipped, not sent');
        }

        logger.info('Loader: warm-up complete');
        return true;
    };
}
