import { injectable, inject } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { NotificationTemplate } from '../models/notification.template.model';
import { NotificationLog } from '../models/notification.log.model';
import { BaseService } from './base.service';
import { SmsChannel } from '../../../modules/channels/sms.channel';
import { EmailChannel } from '../../../modules/channels/email.channel';
import { PushChannel } from '../../../modules/channels/push.channel';
import { WhatsAppChannel } from '../../../modules/channels/whatsapp.channel';
import { ErrorHandler } from '../../../common/api.error';
import { logger } from '../../../logger/logger';
import { NotificationQueue, NotificationJob } from '../../../modules/queue/notification.queue';

/////////////////////////////////////////////////////////////////////////
//  NotificationService — single entrypoint to dispatch a notification
//  through any channel, persist the log row, and surface the
//  send/failure outcome.
/////////////////////////////////////////////////////////////////////////

export type Channel = 'SMS' | 'Email' | 'WhatsApp' | 'Push' | 'InApp';

export interface SendNotificationInput {
    TenantId      : string;
    Channel       : Channel;
    Recipient     : string;
    Subject?      : string;
    //Plain text. For email this becomes the text alternative.
    Body          : string;
    //Optional rich part — email only.
    HtmlBody?     : string;
    TemplateCode? : string;
    //Push targets a user, not an address: notifications-service resolves the
    //user's device tokens from identity-service at send time.
    UserId?       : string;
    Language?     : string;
    //WhatsApp only — see NotificationJob.
    TemplateParams?: string[];
}

@injectable()
export class NotificationService extends BaseService {

    constructor(
        @inject(SmsChannel)      private _sms:    SmsChannel,
        @inject(EmailChannel)    private _email:  EmailChannel,
        @inject(PushChannel)     private _push:   PushChannel,
        @inject(WhatsAppChannel) private _wa:     WhatsAppChannel,
    ) {
        super();
    }

    private _logRepo      = Source.getRepository(NotificationLog);
    private _templateRepo = Source.getRepository(NotificationTemplate);

    /**
     * Render a template for ONE channel.
     *
     * `channel` is not optional, and that matters: the same Code exists once
     * per channel (the unique key is Code+Channel+Language), and each is a
     * different medium. Looking up without it returns whichever row the DB
     * happens to hand back first — which sent a WhatsApp customer the Email
     * template's raw HTML markup.
     */
    public renderTemplate = async (
        tenantId: string,
        code    : string,
        channel : Channel,
        vars    : Record<string, string | number>,
        language: string = 'en',
    ): Promise<{ Subject?: string; Body: string }> => {
        const tpl = await this._templateRepo.findOne({
            where: { TenantId: tenantId, Code: code, Channel: channel, Language: language, IsActive: true },
        });
        if (!tpl) ErrorHandler.throwNotFoundError(`Template not found: ${code}/${channel}/${language}`);

        //Unreplaced variables would ship '{{OrderCode}}' to a customer. Catch
        //them here rather than in a screenshot from an unhappy shop owner.
        const apply = (raw: string) =>
            Object.entries(vars).reduce(
                (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v)),
                raw,
            );
        const Subject = tpl.Subject ? apply(tpl.Subject) : undefined;
        const Body    = apply(tpl.Body);

        const leftover = [...`${Subject ?? ''} ${Body}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
        if (leftover.length) {
            logger.warn(`Template ${code}/${channel}/${language} has unfilled variables: ${[...new Set(leftover)].join(', ')}`);
        }
        return { Subject, Body };
    };

    /**
     * Accept a notification and hand it to the queue.
     *
     * Returns as soon as the log row is written — delivery happens behind the
     * queue. The caller (an order status change, say) must not wait on an SMS
     * gateway, and must not fail because one is briefly down.
     */
    public send = async (input: SendNotificationInput): Promise<NotificationLog> => {
        const log = await this._logRepo.save(this._logRepo.create({
            TenantId    : input.TenantId,
            Channel     : input.Channel,
            TemplateCode: input.TemplateCode,
            Recipient   : input.Recipient,
            Subject     : input.Subject,
            Body        : input.Body,
            Status      : 'Queued',
        }));

        await NotificationQueue.enqueue({
            LogId        : log.id,
            TenantId     : input.TenantId,
            Channel      : input.Channel,
            Recipient    : input.Recipient,
            Subject      : input.Subject,
            Body         : input.Body,
            HtmlBody     : input.HtmlBody,
            TemplateCode : input.TemplateCode,
            UserId       : input.UserId,
            Language     : input.Language,
            TemplateParams: input.TemplateParams,
        //The log row id doubles as the job id, so a retried API call cannot
        //enqueue the same notification twice.
        }, log.id);

        return log;
    };

    /**
     * Deliver one queued notification. Called by the queue worker, once per
     * attempt.
     *
     * Throwing is meaningful here: it tells BullMQ to retry with backoff. So a
     * transient gateway failure must throw, and a permanent one (bad number)
     * should not — see the channel implementations.
     */
    public deliver = async (job: NotificationJob): Promise<void> => {
        const log = await this._logRepo.findOne({ where: { id: job.LogId } });
        try {
            let result: { MessageId?: string; Skipped?: boolean } = {};
            switch (job.Channel) {
                case 'SMS':
                    result = await this._sms.send(job.Recipient, job.Body);
                    break;
                case 'Email':
                    result = await this._email.send({
                        To       : job.Recipient,
                        Subject  : job.Subject ?? '',
                        //Templates render HTML; Body is the text alternative.
                        HtmlBody : job.HtmlBody ?? job.Body,
                        TextBody : job.HtmlBody ? job.Body : undefined,
                    });
                    break;
                case 'Push':
                    result = await this._push.send(job.UserId ?? job.Recipient, job.Subject ?? '', job.Body);
                    break;
                case 'WhatsApp':
                    //Pass the event code and variables through: outside the 24h
                    //window Meta only accepts an approved template, and the
                    //channel needs the code to look up which one.
                    result = await this._wa.send(job.Recipient, job.Body, {
                        TemplateCode: job.TemplateCode,
                        Language    : job.Language,
                        Params      : job.TemplateParams,
                    });
                    break;
                case 'InApp':
                    //Nothing to send: the log row IS the inbox entry.
                    break;
            }
            if (!log) return;
            //A skipped send (channel not configured) is not a success. Marking
            //it Sent would hide a misconfigured production deploy behind a
            //wall of green log rows.
            log.Status            = result.Skipped ? 'Skipped' : 'Sent';
            log.ProviderMessageId = result.MessageId;
            log.SentAt            = new Date();
            await this._logRepo.save(log);
        } catch (error: any) {
            if (log) {
                log.Status        = 'Failed';
                log.FailureReason = String(error?.message ?? 'Unknown error').slice(0, 512);
                log.AttemptCount  = (log.AttemptCount ?? 0) + 1;
                await this._logRepo.save(log);
            }
            //Rethrow so the queue retries this attempt.
            throw error;
        }
    };

    public listLogs = async (tenantId: string, limit = 100): Promise<NotificationLog[]> =>
        this._logRepo.find({ where: { TenantId: tenantId }, order: { CreatedAt: 'DESC' }, take: limit });
}
