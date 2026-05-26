/////////////////////////////////////////////////////////////////////////
//  Auth-related enums used by route auth options + the central
//  authenticator middleware.
/////////////////////////////////////////////////////////////////////////

export enum RequestType {
    CreateOne = 'create-one',
    UpdateOne = 'update-one',
    DeleteOne = 'delete-one',
    GetOne    = 'get-one',
    Search    = 'search',
    Custom    = 'custom',
}

export enum ResourceOwnership {
    Owner  = 'owner',
    Tenant = 'tenant',
    System = 'system',
}

export enum ActionScope {
    Public = 'public',
    Tenant = 'tenant',
    Owner  = 'owner',
    System = 'system',
}

export enum RoleType {
    SystemAdmin  = 'SystemAdmin',
    Receptionist = 'Receptionist',
    Customer     = 'Customer',
    Vendor       = 'Vendor',
}

export interface AuthOptions {
    Context           : string;
    Ownership         : ResourceOwnership;
    ActionScope       : ActionScope;
    RequestType       : RequestType;
    AllowAnonymous?   : boolean;
    AllowedRoles?     : string[];
    CustomAuthFn?     : string;
}

export const DefaultAuthOptions: Omit<AuthOptions, 'Context'> = {
    Ownership      : ResourceOwnership.Tenant,
    ActionScope    : ActionScope.Tenant,
    RequestType    : RequestType.Custom,
    AllowAnonymous : false,
};
