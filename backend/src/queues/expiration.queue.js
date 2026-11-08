import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { env } from '../config/env.js';

export const EXPIRATION_QUEUE_NAME = 'expiration';
export const EXPIRATION_SWEEP_JOB_NAME = 'expire-reservations';
const SWEEP_JOB_ID = 'expiration-sweep';

/**
 * Expiration queue.
 *
 * Reserved inventory must not stay locked forever when a user abandons payment.
 * Two common designs:
 *   a) one delayed job per reservation (precise, many jobs), or
 *   b) a periodic sweep that fails bookings whose `reservedUntil` has passed
 *      (fewer jobs, coarser resolution).
 *
 * The base project ships (b) as a skeleton because it is operationally simpler
 * to reason about; the sweep interval is configurable.
 */
let queue;

export function getExpirationQueue() {
  if (!queue) {
    queue = new Queue(EXPIRATION_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { age: 60 * 60, count: 100 },
        removeOnFail: { age: 24 * 60 * 60 },
      },
    });
  }

  return queue;
}

/** Idempotent: re-adding the same repeatable job id updates its schedule. */
export async function ensureExpirationSweepScheduled() {
  await getExpirationQueue().add(
    EXPIRATION_SWEEP_JOB_NAME,
    {},
    {
      jobId: SWEEP_JOB_ID,
      repeat: { every: env.EXPIRATION_SWEEP_INTERVAL_MS },
    },
  );
}

export async function closeExpirationQueue() {
  if (!queue) return;

  const current = queue;
  queue = undefined;
  await current.close();
}
