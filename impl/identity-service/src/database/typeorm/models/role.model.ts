import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'roles' })
export class Role {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid', nullable: true })
    TenantId: string;

    @Column({ name: 'Code', type: 'varchar', length: 64 })
    Code: string;

    @Column({ name: 'Name', type: 'varchar', length: 128 })
    Name: string;

    @Column({ name: 'Description', type: 'text', nullable: true })
    Description: string;

    @Column({ name: 'IsSystem', type: 'boolean', default: true })
    IsSystem: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
