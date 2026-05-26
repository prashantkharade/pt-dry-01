import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity({ name: 'items' })
@Index('ix_items_tenant_category', ['TenantId', 'CategoryId'])
@Unique('ux_items_tenant_code', ['TenantId', 'Code'])
export class Item {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'CategoryId', type: 'uuid' })
    CategoryId: string;

    @Column({ name: 'Code', type: 'varchar', length: 64 })
    Code: string;

    @Column({ name: 'Name', type: 'varchar', length: 128 })
    Name: string;

    @Column({ name: 'NameMr', type: 'varchar', length: 128, nullable: true })
    NameMr: string;

    @Column({ name: 'Description', type: 'text', nullable: true })
    Description: string;

    @Column({ name: 'ApplicableServices', type: 'text', array: true })
    ApplicableServices: string[];

    @Column({ name: 'DefaultUom', type: 'varchar', length: 16, default: 'piece' })
    DefaultUom: string;

    @Column({ name: 'IsVendorOnly', type: 'boolean', default: false })
    IsVendorOnly: boolean;

    @Column({ name: 'SortOrder', type: 'int', default: 0 })
    SortOrder: number;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
