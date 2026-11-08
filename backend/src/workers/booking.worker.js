import { Worker } from 'bullmq';
import { pathToFileURL } from 'node:url';
import { env } from '../config/env.js';
import { redisConnection } from '../config/redis.js';
import { createLogger } from '../utils/logger.js';
import { BOOKING_QUEUE_NAME } from '../queues/booking.queue.js';

const logger = createLogger('booking-worker');

/**
 * Booking job processor.
 *
 * IMPORTANT — this is a skeleton on purpose.
 *
 * The worker contract is:
 *   input : { bookingId, userId, eventId, quantity }
 *   output: a summary object BullMQ stores as the job's return value
 *
 * The next phase fills in the hot path inside `inventory.service.js`:
 *   1. atomically reserve `quantity` tickets in Redis (Lua),
 *   2. move the booking PROCESSING -> RESERVED and set `reservedUntil`,
 *   3. schedule expiration and hand off to payment.
 *
 * Because the work is not implemented yet, the job *completes* (no throw).
 * Throwing would make BullMQ retry three times and then park the job in the
 * failed set for work that is deliberately absent.
 */
export async function processBookingJob(job) {
  const { bookingId, eventId, quantity } = job.data ?? {};

  if (!bookingId || !eventId || !Number.isInteger(quantity)) {
    // A malformed payload is permanent: failing fast prevents pointless retries.
    throw new Error('Malformed booking job payload');
  }

  logger.info(
    {
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      bookingId,
      eventId,
      quantity,
    },
    'Booking job received (inventory reservation not implemented yet)',
  );

  return {
    status: 'SKIPPED',
    reason: 'INVENTORY_RESERVATION_NOT_IMPLEMENTED',
    bookingId,
  };
}

export function createBookingWorker({ concurrency = env.QUEUE_CONCURRENCY } = {}) {
  const worker = new Worker(BOOKING_QUEUE_NAME, processBookingJob, {
    connection: redisConnection,
    concurrency,
  });

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Booking job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, err: error.message },
      'Booking job failed',
    );
  });

  worker.on('error', (error) => {
    logger.error({ err: error.message }, 'Booking worker error');
  });

  return worker;
}

async function main() {
  const worker = createBookingWorker();

  logger.info(
    { pid: process.pid, concurrency: env.QUEUE_CONCURRENCY },
    'Booking worker started - scale out by starting more of these processes',
  );

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down booking worker');
    // close() waits for in-flight jobs to finish instead of dropping them.
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
    logger.fatal({ err: error.message }, 'Booking worker crashed');
    process.exit(1);
  });
}
