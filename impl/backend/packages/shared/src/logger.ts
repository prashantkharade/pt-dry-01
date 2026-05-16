import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  service?: string;
}

const als = new AsyncLocalStorage<LogContext>();

export const LoggerContext = {
  run<T>(ctx: LogContext, fn: () => T): T {
    return als.run(ctx, fn);
  },
  get(): LogContext {
    return als.getStore() ?? {};
  },
};

const ISO = () => new Date().toISOString();
const fmt = (level: string, msg: string, extra?: unknown) => {
  const ctx = LoggerContext.get();
  const base = {
    ts: ISO(),
    level,
    service: ctx.service,
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    msg,
  };
  if (extra !== undefined) (base as Record<string, unknown>).extra = extra;
  return JSON.stringify(base);
};

export const Logger = {
  info: (msg: string, extra?: unknown) => console.log(fmt('INFO', msg, extra)),
  warn: (msg: string, extra?: unknown) => console.warn(fmt('WARN', msg, extra)),
  error: (msg: string, extra?: unknown) => console.error(fmt('ERROR', msg, extra)),
  debug: (msg: string, extra?: unknown) => {
    if (process.env.LOG_LEVEL === 'debug') console.log(fmt('DEBUG', msg, extra));
  },
};
