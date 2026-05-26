export class BaseService {
    public defaultPageSize = 25;
    public maxPageSize     = 100;
    protected pageSize  = (input?: number): number => input ? Math.min(this.maxPageSize, Math.max(1, input)) : this.defaultPageSize;
    protected pageIndex = (input?: number): number => (!input || input < 0) ? 0 : input;
}
