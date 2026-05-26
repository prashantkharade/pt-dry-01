import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Notification';

export class NotificationAuth {

    static readonly send: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Send`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };
}
