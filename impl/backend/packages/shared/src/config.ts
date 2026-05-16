export class ConfigurationManager {
  private static cache = new Map<string, string>();

  static get(key: string, fallback?: string): string {
    if (this.cache.has(key)) return this.cache.get(key) as string;
    const value = process.env[key] ?? fallback;
    if (value === undefined) {
      throw new Error(`Missing required env var: ${key}`);
    }
    this.cache.set(key, value);
    return value;
  }

  static getOptional(key: string): string | undefined {
    return process.env[key];
  }

  static getNumber(key: string, fallback?: number): number {
    const raw = process.env[key];
    if (raw === undefined) {
      if (fallback === undefined) throw new Error(`Missing required env var: ${key}`);
      return fallback;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error(`env ${key} is not a number: ${raw}`);
    return n;
  }

  static getBool(key: string, fallback = false): boolean {
    const v = process.env[key];
    if (v === undefined) return fallback;
    return v === '1' || v.toLowerCase() === 'true';
  }
}
