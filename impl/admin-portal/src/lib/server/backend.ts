// HTTP wrappers around the PT Kharade backend microservices. Server-only.
const IDENTITY         = process.env.IDENTITY_SERVICE_URL         ?? 'http://localhost:4001';
const CATALOG_PRICING  = process.env.CATALOG_PRICING_SERVICE_URL  ?? 'http://localhost:4002';
const ORDERS           = process.env.ORDERS_SERVICE_URL           ?? 'http://localhost:4003';
const PAYMENTS         = process.env.PAYMENTS_SERVICE_URL         ?? 'http://localhost:4004';
const NOTIFICATIONS    = process.env.NOTIFICATIONS_SERVICE_URL    ?? 'http://localhost:4005';
const API_KEY          = process.env.API_KEY_ADMIN_PORTAL         ?? 'dev-admin-portal-key';

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  query?: Record<string, string | number | undefined | null>;
}

async function call<T>(baseUrl: string, path: string, opts: CallOptions = {}): Promise<T> {
  const url = new URL(`/api/v1${path}`, baseUrl);
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
    call<{ AccessToken: string; RefreshToken: string; User: Record<string, unknown> }>(
      IDENTITY, '/auth/login', { method: 'POST', body: { EmailOrPhone: emailOrPhone, Password: password } },
    ),
  me: (accessToken: string) =>
    call<Record<string, unknown>>(IDENTITY, '/users/me', { accessToken }),
  searchCustomers: (accessToken: string, q?: string) =>
    call<{ Items: Array<Record<string, unknown>>; Total: number }>(
      IDENTITY, '/customers', { accessToken, query: { Query: q } },
    ),
  createCustomer: (accessToken: string, body: Record<string, unknown>) =>
    call<Record<string, unknown>>(IDENTITY, '/customers', { method: 'POST', body, accessToken }),
  getCustomer: (accessToken: string, id: string) =>
    call<Record<string, unknown>>(IDENTITY, `/customers/${id}`, { accessToken }),
};

export const Catalog = {
  services: (accessToken: string) =>
    call<{ Items: Array<{ Code: string; Name: string; NameMr?: string }>; Total: number }>(
      CATALOG_PRICING, '/catalog/service-types', { accessToken },
    ),
  items: (accessToken: string, service?: string) =>
    call<{ Items: Array<{ id: string; Code: string; Name: string; ApplicableServices: string[]; DefaultUom: string; IsVendorOnly: boolean }>; Total: number }>(
      CATALOG_PRICING, '/catalog/items', { accessToken, query: { Service: service } },
    ),
  quote: (accessToken: string, body: unknown) =>
    call<{
      Lines: Array<{ ItemId: string; ItemCode: string; ItemName: string; Quantity: number; UnitRateInr: number; LineTotalInr: number }>;
      SubtotalInr: number; DeliveryChargeInr: number; ExpressChargeInr: number; GstInr: number; TotalInr: number;
    }>(CATALOG_PRICING, '/pricing/quote', { method: 'POST', body, accessToken }),
};

export const Orders = {
  list: (accessToken: string, q?: Record<string, string | number | undefined>) =>
    call<{ Items: Array<Record<string, unknown>>; Total: number; PageIndex: number; ItemsPerPage: number }>(
      ORDERS, '/orders', { accessToken, query: q },
    ),
  create: (accessToken: string, body: unknown) =>
    call<Record<string, unknown>>(ORDERS, '/orders', { method: 'POST', body, accessToken }),
  get: (accessToken: string, id: string) =>
    call<Record<string, unknown>>(ORDERS, `/orders/${id}`, { accessToken }),
  updateStatus: (accessToken: string, id: string, status: string, note?: string) =>
    call<Record<string, unknown>>(ORDERS, `/orders/${id}/status`, { method: 'PATCH', accessToken, body: { Status: status, Note: note } }),
};

export const Payments = {
  initiate: (accessToken: string, body: unknown) =>
    call<Record<string, unknown>>(PAYMENTS, '/payments/initiate', { method: 'POST', body, accessToken }),
  cash: (accessToken: string, body: unknown) =>
    call<Record<string, unknown>>(PAYMENTS, '/payments/cash', { method: 'POST', body, accessToken }),
};

export const Notifications = {
  send: (accessToken: string, body: unknown) =>
    call<Record<string, unknown>>(NOTIFICATIONS, '/notifications/send', { method: 'POST', body, accessToken }),
};
