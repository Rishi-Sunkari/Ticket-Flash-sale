import { checkDatabase } from '../../config/database.js';
import { checkRedis } from '../../config/redis.js';
import { getQueueCounts } from '../../queues/booking.queue.js';

const PROBE_TIMEOUT_MS = 1500;

/**
 * Every dependency probe is bounded. Without a timeout a hung PostgreSQL socket
 * would make the readiness endpoint hang too — and a load balancer that cannot
 * get an answer keeps sending traffic to a broken instance.
 */
function withTimeout(promise, label, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} probe timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function probe(name, fn) {
  const startedAt = Date.now();

  try {
    const detail = await withTimeout(Promise.resolve().then(fn), name);
    return { status: 'up', latencyMs: Date.now() - startedAt, detail };
  } catch (error) {
    return { status: 'down', latencyMs: Date.now() - startedAt, error: error.message };
  }
}

/**
 * Readiness = "can this instance do useful work right now?".
 * Liveness (below) only asks "is the event loop alive?".
 */
export async function checkDependencies() {
  const [database, redis, bookingQueue] = await Promise.all([
    probe('database', async () => {
      await checkDatabase();
      return 'SELECT 1';
    }),
    probe('redis', async () => {
      const pong = await checkRedis();
      return pong ? 'PONG' : 'unexpected reply';
    }),
    probe('bookingQueue', () => getQueueCounts()),
  ]);

  const isReady =
    database.status === 'up' && redis.status === 'up' && bookingQueue.status === 'up';

  return {
    status: isReady ? 'ok' : 'degraded',
    isReady,
    checks: { database, redis, bookingQueue },
  };
}
