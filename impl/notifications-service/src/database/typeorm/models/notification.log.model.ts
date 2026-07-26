import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'notification_logs' })
@Index('ix_notification_logs_tenant', ['TenantId'])
@Index('ix_notification_logs_status', ['Status'])
export class NotificationLog {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'Channel', type: 'varchar', length: 16 })
    Channel: string;

    @Column({ name: 'TemplateCode', type: 'varchar', length: 64, nullable: true })
    TemplateCode: string;

    @Column({ name: 'Recipient', type: 'varchar', length: 255 })
    Recipient: string;

    @Column({ name: 'Subject', type: 'varchar', length: 255, nullable: true })
    Subject: string;

    @Column({ name: 'Body', type: 'text' })
    Body: string;

    //Queued | Sent | Skipped | Delivered | Failed
    //'Skipped' is distinct from 'Sent' on purpose: it means the channel was not
    //configured and nothing left the building. Collapsing the two would hide a
    //misconfigured production deploy behind a wall of green rows.
    @Column({ name: 'Status', type: 'varchar', length: 32, default: 'Queued' })
    Status: string;

    //The user this was for, when known. Push resolves device tokens from it,
    //and it backs the in-app inbox.
    @Column({ name: 'UserId', type: 'uuid', nullable: true })
    UserId: string;

    @Column({ name: 'ProviderMessageId', type: 'varchar', length: 128, nullable: true })
    ProviderMessageId: string;

    @Column({ name: 'FailureReason', type: 'varchar', length: 512, nullable: true })
    FailureReason: string;

    //How many delivery attempts the queue has burned on this one.
    @Column({ name: 'AttemptCount', type: 'int', default: 0 })
    AttemptCount: number;

    @Column({ name: 'SentAt', type: 'timestamptz', nullable: true })
    SentAt: Date;

    //In-app inbox: null = unread.
    @Column({ name: 'ReadAt', type: 'timestamptz', nullable: true })
    ReadAt: Date;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;
}
