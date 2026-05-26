import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'RateCard';

export class RateCardAuth {
    static readonly list: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.List`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    static readonly create: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Create`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: ['SystemAdmin'],
    };
}
