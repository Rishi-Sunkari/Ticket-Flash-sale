import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Redis access layer.
 *
 * Two different client shapes are needed:
 *
 * 1. `redisConnection` — plain connection *options* handed to BullMQ. BullMQ
 *    creates (and pools) its own clients from these options. It requires
 *    `maxRetriesPerRequest: null`, otherwise blocking commands used by workers
 *    throw "Reached the max retries per request limit".
 *
 * 2. `redis` — a shared IORedis client for direct commands (health checks now,
 *    atomic Lua reservations later).
 */
function parseRedisUrl(rawUrl) {
  const url = new URL(rawUrl);

  const dbPath = url.pathname.replace(/^\//, '');
  const db = Number(dbPath || 0);

  return {
    host: url.hostname || '127.0.0.1',
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isInteger(db) ? db : 0,
  };
}

const baseOptions = parseRedisUrl(env.REDIS_URL);

/** Connection options for BullMQ (Queue/Worker/QueueEvents). */
export const redisConnection = Object.freeze({
  ...baseOptions,
  maxRetriesPerRequest: null,
});

/** Shared client for direct Redis commands. */
export const redis = new IORedis({
  ...baseOptions,
  lazyConnect: true,
  connectTimeout: 3000,
  maxRetriesPerRequest: 2,
  retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
});

redis.on('error', (error) => {
  // Log and let IORedis retry; an unreachable Redis must not crash the API.
  logger.warn({ err: error.message }, 'Redis client error');
});

export async function connectRedis() {
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
  }
  await redis.ping();
  logger.info('Redis connection established');
}

export async function disconnectRedis() {
  await redis.quit().catch(() => redis.disconnect());
}

/** Returns 'PONG' when Redis answers. */
export async function checkRedis() {
  const pong = await redis.ping();
  return pong === 'PONG';
}
