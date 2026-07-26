import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Order';

export class OrderAuth {

    static readonly create: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Create`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist', 'Customer'],
    };

    static readonly search: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Search`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    static readonly listMine: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListMine`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.Search,
    };

    static readonly getById: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetById`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.GetOne,
    };

    static readonly updateStatus: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.UpdateStatus`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.UpdateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    //  Any authenticated user: the service narrows a customer to their own
    //  orders, so there is nothing to leak.
    static readonly summary: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Summary`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    //  Ownership is enforced in the service against the caller's own
    //  CustomerId, resolved from the token — never from the request.
    static readonly tracking: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Tracking`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.GetOne,
    };

    static readonly stream: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Stream`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
    };

    //  Ownership is enforced in the controller against the caller's own
    //  CustomerId. Any authenticated user may ask; only their own is returned.
    static readonly receipt: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Receipt`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.GetOne,
    };
}
