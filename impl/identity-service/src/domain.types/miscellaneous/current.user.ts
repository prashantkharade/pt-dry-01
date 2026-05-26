/////////////////////////////////////////////////////////////////////////
//  Caller context attached to req.currentUser after auth succeeds.
/////////////////////////////////////////////////////////////////////////

export interface CurrentUser {
    UserId       : string;
    TenantId     : string;
    BranchId?    : string;
    SessionId    : string;
    Roles        : string[];
    FirstName?   : string;
    LastName?    : string;
    Email?       : string;
    Phone?       : string;
    DisplayName? : string;
}
