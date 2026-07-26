import { Queue, Worker, Job, JobsOptions, ConnectionOptions } from 'bullmq';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Notification delivery queue (BullMQ over Redis).
//
//  Why a queue at all: an SMS gateway that is down for 30 seconds should
//  not lose an order confirmation, and it must not make the API request
//  that triggered it hang or fail. Enqueue is fast and durable; delivery
//  is retried with backoff behind it.
//
//  Degradation is explicit: with no Redis, enqueue() runs the job inline.
//  That keeps dev working, but it is NOT silent — see the warning in
//  connect(). Inline mode has no retry, so a provider blip loses the
//  message.
/////////////////////////////////////////////////////////////////////////

//BullMQ rejects ':' in a queue name — it uses the colon itself as the
//separator when building its Redis keys.
export const NOTIFICATION_QUEUE = 'ptk-notifications';

export interface NotificationJob {
    LogId       : string;
    TenantId    : string;
    Channel     : string;
    Recipient   : string;
    Subject?    : string;
    Body        : string;
    HtmlBody?   : string;
    TemplateCode?: string;
    UserId?     : string;
    //WhatsApp only: Meta templates take POSITIONAL {{1}},{{2}} params and are
    //looked up by language, so both must survive the hop through the queue.
    Language?   : string;
    TemplateParams?: string[];
}

export type JobHandler = (job: NotificationJob) => Promise<void>;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
    //5 attempts over ~exponential backoff: 2s, 4s, 8s, 16s. Rides out a
    //provider blip without pounding a gateway that is genuinely down.
    attempts    : 5,
    backoff     : { type: 'exponential', delay: 2000 },
    //Keep a window of history for debugging, but bound it — an unbounded
    //completed set is a slow Redis memory leak.
    removeOnComplete: { age: 3600, count: 1000 },
    //Failures are what you actually want to look at; keep them longer.
    removeOnFail    : { age: 24 * 3600 },
};

export class NotificationQueue {

    private static _queue: Queue | null = null;
    private static _worker: Worker | null = null;
    private static _connection: ConnectionOptions | null = null;
    private static _inlineHandler: JobHandler | null = null;

    public static get isBacked(): boolean { return NotificationQueue._queue !== null; }

    /**
     * Hand BullMQ connection OPTIONS rather than an ioredis instance: bullmq
     * bundles its own copy of ioredis, so an instance built from ours is a
     * structurally different type and gets rejected. Options let bullmq build
     * (and correctly configure) its own client.
     */
    private static parseRedisUrl = (url: string): ConnectionOptions => {
        const u = new URL(url);
        return {
            host     : u.hostname,
            port     : Number(u.port || 6379),
            username : u.username || undefined,
            password : u.password || undefined,
            db       : u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : 0,
            //BullMQ requires null here: its worker blocks on Redis waiting for
            //jobs, and a retry cap would tear that blocking connection down.
            maxRetriesPerRequest: null,
        };
    };

    public static connect = (): void => {
        const url = ConfigurationManager.getEnvOptional('REDIS_URL');
        if (!url) {
            logger.warn('REDIS_URL not set — notifications will be delivered INLINE with no retry. Do not run production this way.');
            return;
        }
        NotificationQueue._connection = NotificationQueue.parseRedisUrl(url);
        NotificationQueue._queue = new Queue(NOTIFICATION_QUEUE, { connection: NotificationQueue._connection });
        NotificationQueue._queue.on('error', (e) => logger.error(`Notification queue Redis error: ${e.message}`));
        logger.info('Notification queue connected to Redis');
    };

    /**
     * Hand a notification to the queue.
     *
     * `jobId` makes the enqueue idempotent: BullMQ drops a job whose id it has
     * already seen, so a retried API call cannot send the same SMS twice.
     */
    public static enqueue = async (job: NotificationJob, jobId?: string): Promise<void> => {
        if (!NotificationQueue._queue) {
            if (!NotificationQueue._inlineHandler) {
                logger.error('Notification dropped: no queue and no inline handler registered');
                return;
            }
            await NotificationQueue._inlineHandler(job);
            return;
        }
        await NotificationQueue._queue.add('send', job, { ...DEFAULT_JOB_OPTIONS, jobId });
    };

    public static startWorker = (handler: JobHandler): void => {
        //Used when Redis is absent, so enqueue() still delivers.
        NotificationQueue._inlineHandler = handler;

        if (!NotificationQueue._queue || !NotificationQueue._connection) return;

        NotificationQueue._worker = new Worker(
            NOTIFICATION_QUEUE,
            async (job: Job<NotificationJob>) => handler(job.data),
            {
                connection : NotificationQueue._connection,
                //Modest: SMS/SMTP providers rate-limit, and this is not a
                //throughput-bound workload.
                concurrency: 5,
            },
        );

        NotificationQueue._worker.on('failed', (job, err) => {
            const attempts = job?.attemptsMade ?? 0;
            const max      = job?.opts?.attempts ?? 0;
            if (attempts >= max) {
                //Exhausted. The job stays in the failed set for inspection, and
                //the log row keeps Status=Failed with this reason.
                logger.error(`Notification job ${job?.id} FAILED permanently after ${attempts} attempts: ${err.message}`);
            } else {
                logger.warn(`Notification job ${job?.id} attempt ${attempts}/${max} failed, will retry: ${err.message}`);
            }
        });
        NotificationQueue._worker.on('completed', (job) => logger.info(`Notification job ${job.id} delivered`));

        logger.info('Notification worker started');
    };

    public static shutdown = async (): Promise<void> => {
        //Close the worker first so it stops claiming jobs, then the queue.
        await NotificationQueue._worker?.close();
        await NotificationQueue._queue?.close();
    };

    /** Queue depth — for the health endpoint and ops dashboards. */
    public static stats = async (): Promise<Record<string, number>> => {
        if (!NotificationQueue._queue) return { waiting: 0, active: 0, failed: 0, completed: 0 };
        const [waiting, active, failed, completed] = await Promise.all([
            NotificationQueue._queue.getWaitingCount(),
            NotificationQueue._queue.getActiveCount(),
            NotificationQueue._queue.getFailedCount(),
            NotificationQueue._queue.getCompletedCount(),
        ]);
        return { waiting, active, failed, completed };
    };
}
