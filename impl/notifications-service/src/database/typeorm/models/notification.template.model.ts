import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity({ name: 'notification_templates' })
@Unique('ux_templates_tenant_code', ['TenantId', 'Code'])
export class NotificationTemplate {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'Code', type: 'varchar', length: 64 })
    Code: string;

    @Column({ name: 'Channel', type: 'varchar', length: 16 }) // SMS | Email | WhatsApp | Push | InApp
    Channel: string;

    @Column({ name: 'Language', type: 'char', length: 2, default: 'en' })
    Language: string;

    @Column({ name: 'Subject', type: 'varchar', length: 255, nullable: true })
    Subject: string;

    @Column({ name: 'Body', type: 'text' })
    Body: string;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
