import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity({ name: 'webhook_events' })
@Index('ix_webhook_events_provider', ['Provider'])
//Providers retry on any non-2xx, so the same event arrives more than once.
//Without this the retry re-runs capture/refund side effects. The DB unique
//constraint — not an application-level "check then insert" — is what makes
//dedupe correct when two retries land on two instances at the same moment.
@Unique('uq_webhook_events_provider_event', ['Provider', 'ProviderEventId'])
export class WebhookEvent {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'Provider', type: 'varchar', length: 32 })
    Provider: string;

    //The provider's own id for this event. Nullable because not every provider
    //sends one; when absent we cannot dedupe and fall back to at-least-once.
    @Column({ name: 'ProviderEventId', type: 'varchar', length: 128, nullable: true })
    ProviderEventId: string;

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
