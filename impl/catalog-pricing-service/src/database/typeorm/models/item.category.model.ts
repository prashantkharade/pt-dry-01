import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'item_categories' })
@Index('ix_item_categories_tenant', ['TenantId'])
export class ItemCategory {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'Code', type: 'varchar', length: 64 })
    Code: string;

    @Column({ name: 'Name', type: 'varchar', length: 128 })
    Name: string;

    @Column({ name: 'NameMr', type: 'varchar', length: 128, nullable: true })
    NameMr: string;

    @Column({ name: 'SortOrder', type: 'int', default: 0 })
    SortOrder: number;

    @Column({ name: 'Icon', type: 'varchar', length: 64, nullable: true })
    Icon: string;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
