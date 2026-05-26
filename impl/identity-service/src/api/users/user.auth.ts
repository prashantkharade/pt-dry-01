import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'User';

export class UserAuth {

    static readonly getMe: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetMe`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.GetOne,
    };

    static readonly updateMe: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.UpdateMe`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.UpdateOne,
    };

    static readonly search: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Search`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
        AllowedRoles: ['SystemAdmin'],
    };

    static readonly getById: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetById`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.GetOne,
        AllowedRoles: ['SystemAdmin'],
    };

    static readonly getLookup: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetLookup`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.Custom,
    };
}
