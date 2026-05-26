/////////////////////////////////////////////////////////////////////////
//  Misc string helpers used across the service.
/////////////////////////////////////////////////////////////////////////

export class StringUtils {

    public static generateCustomerCode = (): string => {
        return `PTK-CUST-${String(Date.now()).slice(-6)}`;
    };

    public static generateOrderCode = (tenantPrefix = 'PTK'): string => {
        const d   = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const rand = Math.floor(Math.random() * 9000 + 1000);
        return `${tenantPrefix}-${ymd}-${rand}`;
    };

    public static isEmail = (value: string): boolean => {
        return typeof value === 'string' && value.includes('@') && /.+@.+\..+/.test(value);
    };

    public static isPhone = (value: string): boolean => {
        return typeof value === 'string' && /^\+91[6-9]\d{9}$/.test(value);
    };

    public static normalizeEmail = (value: string): string => {
        return (value ?? '').trim().toLowerCase();
    };
}
