import {
  Entity, PrimaryColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'user_roles' })
@Index('ix_user_roles_role', ['RoleId'])
export class UserRole {
  @PrimaryColumn({ name: 'UserId', type: 'uuid' }) UserId!: string;
  @PrimaryColumn({ name: 'RoleId', type: 'uuid' }) RoleId!: string;
  @PrimaryColumn({ name: 'TenantId', type: 'uuid' }) TenantId!: string;
  @Column({ name: 'BranchId', type: 'uuid', nullable: true }) BranchId?: string;
  @CreateDateColumn({ name: 'GrantedAt' }) GrantedAt!: Date;
  @Column({ name: 'GrantedBy', type: 'uuid', nullable: true }) GrantedBy?: string;
}
