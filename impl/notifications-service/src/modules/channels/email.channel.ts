import { injectable } from 'tsyringe';
import * as nodemailer from 'nodemailer';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  SMTP email via nodemailer.
//
//  Two things the reference implementations got wrong and this does not:
//
//  1) `tls: { rejectUnauthorized: false }`. Every reference SMTP provider
//     sets it, which disables certificate validation and leaves the
//     connection open to a man-in-the-middle while still looking encrypted.
//     We validate certs, and only allow opting out explicitly via
//     SMTP_ALLOW_INVALID_CERTS for a self-signed dev relay.
//  2) `secure: false` hardcoded, so port 465 (implicit TLS) could not be
//     used at all, and a server without STARTTLS would silently receive the
//     credentials in plaintext. Here `secure` follows the port and
//     requireTLS forces STARTTLS on 587.
/////////////////////////////////////////////////////////////////////////

export interface EmailAttachment {
    Filename    : string;
    Content?    : Buffer | string;
    Path?       : string;
    ContentType?: string;
}

export interface SendEmailInput {
    To          : string;
    Subject     : string;
    //HtmlBody is the rich part; TextBody is the plaintext alternative.
    //Sending both keeps us out of spam folders and readable in text clients.
    HtmlBody    : string;
    TextBody?   : string;
    Cc?         : string;
    ReplyTo?    : string;
    Attachments?: EmailAttachment[];
}

@injectable()
export class EmailChannel {

    private transporter: nodemailer.Transporter | null = null;

    public get isConfigured(): boolean {
        return Boolean(ConfigurationManager.getEnvOptional('SMTP_HOST'));
    }

    private getTransport(): nodemailer.Transporter | null {
        if (this.transporter) return this.transporter;
        const host = ConfigurationManager.getEnvOptional('SMTP_HOST');
        if (!host) return null;

        const port = Number(ConfigurationManager.getEnvOptional('SMTP_PORT') ?? '587');
        //465 is implicit TLS; 587/25 negotiate via STARTTLS. Deriving this from
        //the port avoids the "secure:false on 465" hang that looks like a
        //network fault.
        const secure = ConfigurationManager.getEnvBool('SMTP_SECURE', port === 465);

        //Escape hatch for a self-signed dev relay only.
        const allowInvalidCerts = ConfigurationManager.getEnvBool('SMTP_ALLOW_INVALID_CERTS', false);
        if (allowInvalidCerts) {
            logger.warn('SMTP_ALLOW_INVALID_CERTS is on — TLS certificates are NOT validated. Never use this in production.');
        }

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            //Force STARTTLS when not already implicit-TLS, so credentials can
            //never go out in plaintext to a server that doesn't offer it.
            requireTLS : !secure,
            auth : {
                user : ConfigurationManager.getEnv('SMTP_USER'),
                pass : ConfigurationManager.getEnv('SMTP_PASS'),
            },
            tls : { rejectUnauthorized: !allowInvalidCerts },
            //Reuse one connection across a burst of sends rather than doing a
            //TCP+TLS handshake per message.
            pool             : true,
            maxConnections   : 3,
            connectionTimeout: 10_000,
        });
        return this.transporter;
    }

    /**
     * Check SMTP credentials at startup rather than discovering they are wrong
     * on the first real order confirmation.
     */
    public verifyConnection = async (): Promise<boolean> => {
        const transport = this.getTransport();
        if (!transport) return false;
        try {
            await transport.verify();
            logger.info('SMTP connection verified');
            return true;
        } catch (error: any) {
            logger.error(`SMTP verification failed: ${error?.message}`);
            return false;
        }
    };

    public send = async (input: SendEmailInput): Promise<{ MessageId?: string; Skipped?: boolean }> => {
        const transport = this.getTransport();
        if (!transport) {
            //Unconfigured is not an error in dev — log what WOULD have gone out
            //so the flow stays testable without a mail server.
            logger.warn(`EmailChannel not configured — would send to=${input.To} subject="${input.Subject}"`);
            return { Skipped: true };
        }

        const info = await transport.sendMail({
            from        : ConfigurationManager.getEnv('SMTP_FROM', 'PT Kharade <noreply@ptkharade.in>'),
            to          : input.To,
            cc          : input.Cc,
            replyTo     : input.ReplyTo,
            subject     : input.Subject,
            html        : input.HtmlBody,
            text        : input.TextBody ?? EmailChannel.htmlToText(input.HtmlBody),
            attachments : (input.Attachments ?? []).map((a) => ({
                filename   : a.Filename,
                content    : a.Content,
                path       : a.Path,
                contentType: a.ContentType,
            })),
        });
        logger.info(`Email sent to=${input.To} messageId=${info.messageId}`);
        return { MessageId: info.messageId };
    };

    /** Minimal HTML -> text, so a plaintext alternative always exists. */
    private static htmlToText = (html: string): string =>
        html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
}
