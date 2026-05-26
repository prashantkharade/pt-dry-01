import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Pricing';

export class PricingAuth {

    static readonly quote: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Quote`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
    };

    static readonly listSurcharges: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListSurcharges`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };
}
