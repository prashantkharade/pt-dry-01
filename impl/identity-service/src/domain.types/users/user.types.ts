/////////////////////////////////////////////////////////////////////////
//  Users domain DTOs: Create / Update models + the response DTO returned
//  to controllers.
/////////////////////////////////////////////////////////////////////////

export interface UserCreateModel {
    TenantId           : string;
    BranchId           : string;
    FirstName          : string;
    LastName?          : string;
    Email?             : string;
    Phone?             : string;
    PasswordHash?      : string;
    PreferredLanguage? : string;
    RoleCode?          : string;
}

export interface UserUpdateModel {
    FirstName?         : string;
    LastName?          : string;
    Email?             : string;
    PreferredLanguage? : string;
    ProfileImageUrl?   : string;
    ThemePrefs?        : Record<string, unknown>;
}

export interface UserDto {
    id                : string;
    TenantId          : string;
    BranchId          : string;
    FirstName         : string;
    LastName?         : string;
    Email?            : string;
    Phone?            : string;
    PreferredLanguage : string;
    ProfileImageUrl?  : string;
    ThemePrefs?       : Record<string, unknown>;
    IsActive          : boolean;
    LastLoginAt?      : Date;
    Roles?            : string[];
    CreatedAt         : Date;
    UpdatedAt         : Date;
}

export interface UserSearchFilters {
    TenantId?    : string;
    BranchId?    : string;
    Phone?       : string;
    Email?       : string;
    NameLike?    : string;
    RoleCode?    : string;
    PageIndex?   : number;
    ItemsPerPage?: number;
}
