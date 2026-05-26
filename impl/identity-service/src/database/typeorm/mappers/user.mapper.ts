import { User } from '../models/user.model';
import { UserDto } from '../../../domain.types/users/user.types';

/////////////////////////////////////////////////////////////////////////
//  Entity → DTO mapping for User. Mappers stay static + pure: never run
//  queries, never throw — that belongs in services.
/////////////////////////////////////////////////////////////////////////

export class UserMapper {

    static toDto = (user: User, roles: string[] = []): UserDto => {
        if (!user) return null;
        return {
            id               : user.id,
            TenantId         : user.TenantId,
            BranchId         : user.BranchId,
            FirstName        : user.FirstName,
            LastName         : user.LastName,
            Email            : user.Email,
            Phone            : user.Phone,
            PreferredLanguage: user.PreferredLanguage,
            ProfileImageUrl  : user.ProfileImageUrl,
            ThemePrefs       : user.ThemePrefs,
            IsActive         : user.IsActive,
            LastLoginAt      : user.LastLoginAt,
            Roles            : roles,
            CreatedAt        : user.CreatedAt,
            UpdatedAt        : user.UpdatedAt,
        };
    };
}
