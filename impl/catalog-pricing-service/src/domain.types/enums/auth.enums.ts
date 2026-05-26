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

export interface AuthOptions {
    Context        : string;
    Ownership      : ResourceOwnership;
    ActionScope    : ActionScope;
    RequestType    : RequestType;
    AllowAnonymous?: boolean;
    AllowedRoles?  : string[];
}

export const DefaultAuthOptions: Omit<AuthOptions, 'Context'> = {
    Ownership      : ResourceOwnership.Tenant,
    ActionScope    : ActionScope.Tenant,
    RequestType    : RequestType.Custom,
    AllowAnonymous : false,
};
