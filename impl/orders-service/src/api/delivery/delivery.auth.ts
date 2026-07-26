import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _base = 'Delivery';

//  Role split for this domain:
//    SystemAdmin     — full control incl. master data (zones, slots, partners)
//    Receptionist    — day-to-day ops: assign, reassign, view boards
//    DeliveryPartner — their own runs only, and only status transitions
//    Customer        — read slot availability so they can pick one
const OPS   = ['SystemAdmin', 'Receptionist'];
const ADMIN = ['SystemAdmin'];

export class DeliveryAuth {

    //  --- Slot availability: any authenticated user. The customer app needs
    //  this to render the booking picker.
    static readonly slotAvailability: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.SlotAvailability`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    static readonly reserveSlot: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.ReserveSlot`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
    };

    static readonly releaseSlot: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.ReleaseSlot`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.DeleteOne,
        AllowedRoles: OPS,
    };

    //  --- Master data: admin only.
    static readonly manageSlots: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.ManageSlots`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
        AllowedRoles: ADMIN,
    };

    static readonly manageZones: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.ManageZones`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
        AllowedRoles: ADMIN,
    };

    static readonly managePartners: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.ManagePartners`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
        AllowedRoles: ADMIN,
    };

    //  --- Reference data readable by ops + the app (zones/societies drive the
    //  address picker).
    static readonly readGeography: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.ReadGeography`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    //  --- Ops boards.
    static readonly assign: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.Assign`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: OPS,
    };

    static readonly viewBoard: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.ViewBoard`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
        AllowedRoles: OPS,
    };

    //  --- Partner-facing.
    //  No 'my runs' role restriction beyond DeliveryPartner: the service scopes
    //  the query to the caller's own partner profile, so there is nothing to
    //  leak. Ops roles are included so staff can see the same view when helping.
    static readonly myRuns: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.MyRuns`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.Search,
        AllowedRoles: ['DeliveryPartner'],
    };

    static readonly transitionRun: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.TransitionRun`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.UpdateOne,
        AllowedRoles: ['DeliveryPartner', 'SystemAdmin', 'Receptionist'],
    };

    static readonly quoteCharge: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_base}.QuoteCharge`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
    };
}
