import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Device';

export class DeviceAuth {

    //  A device belongs to the user holding the token. No AllowedRoles: every
    //  authenticated user — customer, receptionist, delivery partner — needs
    //  to register their own device to receive push.

    static readonly register: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Register`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.CreateOne,
    };

    static readonly listMine: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListMine`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.Search,
    };

    static readonly revoke: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Revoke`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.DeleteOne,
    };

    //  Service-to-service: notifications-service resolves push targets before
    //  a send. Push is usually triggered by a domain event (order status
    //  changed) with no user in scope, so this cannot require a user token —
    //  hence AllowAnonymous. AllowedClients is what keeps it safe: without it,
    //  AllowAnonymous would let anyone holding the customer-app key dump every
    //  push token we have.
    static readonly pushTargets: AuthOptions = {
        ...DefaultAuthOptions,
        Context       : `${_baseContext}.PushTargets`,
        Ownership     : ResourceOwnership.System,
        ActionScope   : ActionScope.System,
        RequestType   : RequestType.Search,
        AllowAnonymous: true,
        AllowedClients: ['NOTIFICATIONS-SERVICE'],
    };

    static readonly purgeToken: AuthOptions = {
        ...DefaultAuthOptions,
        Context       : `${_baseContext}.PurgeToken`,
        Ownership     : ResourceOwnership.System,
        ActionScope   : ActionScope.System,
        RequestType   : RequestType.Custom,
        AllowAnonymous: true,
        AllowedClients: ['NOTIFICATIONS-SERVICE'],
    };
}
