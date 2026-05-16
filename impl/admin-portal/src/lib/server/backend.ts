// HTTP wrappers around the two backend services. Server-only.
const IDENTITY = process.env.IDENTITY_API_URL ?? 'http://localhost:4001';
const ORDERS = process.env.ORDERS_API_URL ?? 'http://localhost:4002';
const API_KEY = process.env.API_KEY_ADMIN_PORTAL ?? 'admin-portal-dev-key';

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  query?: Record<string, string | number | undefined | null>;
}

async function call<T>(baseUrl: string, path: string, opts: CallOptions = {}): Promise<T> {
  const url = new URL(path, baseUrl);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': API_KEY,
  };
  if (opts.accessToken) headers.authorization = `Bearer ${opts.accessToken}`;

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const body = parsed as { Message?: string; Errors?: unknown } | null;
    const msg = body?.Message ?? `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; details?: unknown };
    err.status = res.status;
    err.details = body?.Errors;
    throw err;
  }
  return (parsed as { Data: T }).Data;
}

export const Identity = {
  login: (emailOrPhone: string, password: string) =>
    call<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>(IDENTITY, '/auth/login', {
      method: 'POST',
      body: { emailOrPhone, password },
    }),
  me: (accessToken: string) => call<Record<string, unknown>>(IDENTITY, '/users/me', { accessToken }),
  searchCustomers: (accessToken: string, q?: string) =>
    call<{ items: Array<Record<string, unknown>> }>(IDENTITY, '/customers', { accessToken, query: { q } }),
  createCustomer: (accessToken: string, body: Record<string, unknown>) =>
    call<Record<string, unknown>>(IDENTITY, '/customers', { method: 'POST', body, accessToken }),
  getCustomer: (accessToken: string, id: string) =>
    call<Record<string, unknown>>(IDENTITY, `/customers/${id}`, { accessToken }),
};

export const Orders = {
  catalog: (accessToken: string, service?: string) =>
    call<{ items: Array<{ id: string; Code: string; Name: string; ApplicableServices: string[]; DefaultUom: string; IsVendorOnly: boolean }> }>(
      ORDERS, '/catalog/items', { accessToken, query: { service } },
    ),
  services: (accessToken: string) =>
    call<{ items: Array<{ Code: string; Name: string; NameMr?: string }> }>(ORDERS, '/catalog/service-types', { accessToken }),
  quote: (accessToken: string, body: unknown) =>
    call<{ lines: Array<{ itemId: string; itemCode: string; itemName: string; quantity: number; unitRateInr: number; lineTotalInr: number }>;
      subtotalInr: number; deliveryChargeInr: number; expressChargeInr: number; gstInr: number; totalInr: number; }>(
      ORDERS, '/pricing/quote', { method: 'POST', body, accessToken },
    ),
  listOrders: (accessToken: string, q?: Record<string, string | number | undefined>) =>
    call<{ items: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>(
      ORDERS, '/orders', { accessToken, query: q },
    ),
  createOrder: (accessToken: string, body: unknown) =>
    call<Record<string, unknown>>(ORDERS, '/orders', { method: 'POST', body, accessToken }),
  getOrder: (accessToken: string, id: string) =>
    call<{ order: Record<string, unknown>; lines: Array<Record<string, unknown>>; history: Array<Record<string, unknown>> }>(
      ORDERS, `/orders/${id}`, { accessToken },
    ),
  updateStatus: (accessToken: string, id: string, status: string, note?: string) =>
    call<Record<string, unknown>>(ORDERS, `/orders/${id}/status`, { method: 'PATCH', accessToken, body: { status, note } }),
};
