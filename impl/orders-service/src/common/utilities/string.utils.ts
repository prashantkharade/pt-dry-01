export class StringUtils {

    public static generateOrderCode = (tenantPrefix = 'PTK'): string => {
        const d   = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const rand = Math.floor(Math.random() * 9000 + 1000);
        return `${tenantPrefix}-${ymd}-${rand}`;
    };
}
