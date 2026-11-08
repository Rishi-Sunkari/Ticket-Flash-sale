import { Worker } from 'bullmq';
import { pathToFileURL } from 'node:url';
import { env } from '../config/env.js';
import { redisConnection } from '../config/redis.js';
import { createLogger } from '../utils/logger.js';
import {
  EXPIRATION_QUEUE_NAME,
  EXPIRATION_SWEEP_JOB_NAME,
  ensureExpirationSweepScheduled,
} from '../queues/expiration.queue.js';

const logger = createLogger('expiration-worker');

/**
 * Reservation expiration worker (skeleton).
 *
 * The sweeper is the safety net that makes "reserved but never paid" self
 * healing. It will query bookings that are RESERVED/PAYMENT_PENDING AND whose
 * `reservedUntil` is in the past, then:
 *   1. release the tickets back to the pool (Redis + PostgreSQL),
 *   2. transition the booking to EXPIRED (only from a non-terminal status).
 *
 * Both steps must be idempotent, because a sweep can run concurrently with a
 * payment webhook. `transitionBookingStatus` (compare-and-set) already makes
 * step 2 safe to replay.
 */
export async function processExpirationSweep(job) {
  logger.debug({ jobId: job.id }, 'Expiration sweep tick (not implemented yet)');

  return { status: 'SKIPPED', reason: 'EXPIRATION_NOT_IMPLEMENTED' };
}

export function createExpirationWorker() {
  const worker = new Worker(EXPIRATION_QUEUE_NAME, processExpirationSweep, {
    connection: redisConnection,
    concurrency: 1,
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error.message }, 'Expiration sweep failed');
  });

  worker.on('error', (error) => {
    logger.error({ err: error.message }, 'Expiration worker error');
  });

  return worker;
}

async function main() {
  await ensureExpirationSweepScheduled();

  const worker = createExpirationWorker();

  logger.info(
    {
      pid: process.pid,
      jobName: EXPIRATION_SWEEP_JOB_NAME,
      everyMs: env.EXPIRATION_SWEEP_INTERVAL_MS,
    },
    'Expiration worker started',
  );

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down expiration worker');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    logger.fatal({ err: error.message }, 'Expiration worker crashed');
    process.exit(1);
  });
}
