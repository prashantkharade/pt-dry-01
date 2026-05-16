import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'users' })
@Index('ix_users_tenant_branch', ['TenantId', 'BranchId'])
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'TenantId', type: 'uuid' }) TenantId!: string;
  @Column({ name: 'BranchId', type: 'uuid' }) BranchId!: string;
  @Column({ name: 'FirstName', type: 'varchar', length: 128 }) FirstName!: string;
  @Column({ name: 'LastName', type: 'varchar', length: 128, nullable: true }) LastName?: string;
  @Index({ unique: false }) @Column({ name: 'Email', type: 'varchar', length: 255, nullable: true }) Email?: string;
  @Index({ unique: false }) @Column({ name: 'Phone', type: 'varchar', length: 20, nullable: true }) Phone?: string;
  @Column({ name: 'EmailVerifiedAt', type: 'timestamptz', nullable: true }) EmailVerifiedAt?: Date;
  @Column({ name: 'PhoneVerifiedAt', type: 'timestamptz', nullable: true }) PhoneVerifiedAt?: Date;
  @Column({ name: 'PasswordHash', type: 'varchar', length: 255, nullable: true }) PasswordHash?: string;
  @Column({ name: 'PasswordChangedAt', type: 'timestamptz', nullable: true }) PasswordChangedAt?: Date;
  @Column({ name: 'PreferredLanguage', type: 'char', length: 2, default: 'en' }) PreferredLanguage!: string;
  @Column({ name: 'ProfileImageUrl', type: 'varchar', length: 512, nullable: true }) ProfileImageUrl?: string;
  @Column({ name: 'ThemePrefs', type: 'jsonb', nullable: true }) ThemePrefs?: Record<string, unknown>;
  @Column({ name: 'IsActive', type: 'boolean', default: true }) IsActive!: boolean;
  @Column({ name: 'LastLoginAt', type: 'timestamptz', nullable: true }) LastLoginAt?: Date;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
  @DeleteDateColumn({ name: 'DeletedAt' }) DeletedAt?: Date;
}
