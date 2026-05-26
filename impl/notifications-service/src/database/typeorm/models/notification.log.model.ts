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

    @Column({ name: 'Status', type: 'varchar', length: 32, default: 'Queued' }) // Queued | Sent | Delivered | Failed
    Status: string;

    @Column({ name: 'ProviderMessageId', type: 'varchar', length: 128, nullable: true })
    ProviderMessageId: string;

    @Column({ name: 'FailureReason', type: 'varchar', length: 512, nullable: true })
    FailureReason: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;
}
