/////////////////////////////////////////////////////////////////////////
//  BaseService — shared helpers for typed pagination + ordering. Every
//  domain service extends this so default search behaviour is uniform.
/////////////////////////////////////////////////////////////////////////

export class BaseService {

    public defaultPageSize = 25;
    public maxPageSize     = 100;

    protected pageSize = (input?: number): number => {
        if (!input) return this.defaultPageSize;
        return Math.min(this.maxPageSize, Math.max(1, input));
    };

    protected pageIndex = (input?: number): number => {
        if (!input || input < 0) return 0;
        return input;
    };
}
