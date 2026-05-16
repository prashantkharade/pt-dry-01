import Redis from 'ioredis';
import { ConfigurationManager, Logger } from '@ptk/shared';

let _redis: Redis | null = null;

export function redis(): Redis {
  if (_redis) return _redis;
  const url = ConfigurationManager.getOptional('REDIS_URL') ?? 'redis://localhost:6379';
  _redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
  _redis.on('error', (e) => Logger.warn('redis.error', { msg: e.message }));
  return _redis;
}
