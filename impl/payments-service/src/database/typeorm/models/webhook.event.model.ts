import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'webhook_events' })
@Index('ix_webhook_events_provider', ['Provider'])
export class WebhookEvent {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'Provider', type: 'varchar', length: 32 })
    Provider: string;

    @Column({ name: 'EventType', type: 'varchar', length: 128 })
    EventType: string;

    @Column({ name: 'PaymentId', type: 'uuid', nullable: true })
    PaymentId: string;

    @Column({ name: 'Payload', type: 'jsonb' })
    Payload: Record<string, unknown>;

    @Column({ name: 'Processed', type: 'boolean', default: false })
    Processed: boolean;

    @Column({ name: 'ProcessingError', type: 'text', nullable: true })
    ProcessingError: string;

    @CreateDateColumn({ name: 'ReceivedAt' })
    ReceivedAt: Date;
}
