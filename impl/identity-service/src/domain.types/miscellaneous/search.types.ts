/////////////////////////////////////////////////////////////////////////
//  Search input/output primitives reused across domain search APIs.
/////////////////////////////////////////////////////////////////////////

export interface BaseSearchFilters {
    PageIndex?    : number;
    ItemsPerPage? : number;
    OrderBy?      : string;
    Order?        : 'ASC' | 'DESC';
}

export interface BaseSearchResults<T> {
    Items        : T[];
    Total        : number;
    PageIndex    : number;
    ItemsPerPage : number;
}
