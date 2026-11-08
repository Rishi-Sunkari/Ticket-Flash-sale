import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('booking-queue');

export const BOOKING_QUEUE_NAME = 'booking';
export const BOOKING_JOB_NAME = 'reserve-tickets';

/**
 * BullMQ queue definition.
 *
 * Why a queue at all? During a flash sale the arrival rate of booking requests
 * is far above the rate at which inventory can be coordinated. A queue decouples
 * "accept" from "decide": the API stays fast and predictable and the queue
 * absorbs the burst instead of the database.
 *
 * `defaultJobOptions` documents the retry contract once, for every job:
 * - attempts/backoff: transient failures (Redis blip, deadlock) retry with
 *   exponential backoff instead of failing a paying customer immediately;
 * - removeOnComplete: keep a short history for debugging, then free memory;
 * - removeOnFail: keep failures longer because they need investigation.
 *
 * The Queue is created lazily on purpose: importing this module must not open a
 * Redis connection (unit tests and tooling import it indirectly).
 */
let queue;

export function getBookingQueue() {
  if (!queue) {
    queue = new Queue(BOOKING_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 60 * 60, count: 5_000 },
        removeOnFail: { age: 24 * 60 * 60 },
      },
    });
  }

  return queue;
}

/**
 * Enqueue a reservation job.
 *
 * @param {object} payload job data consumed by the worker
 * @param {string} jobId BullMQ deduplicates by job id while the job is waiting,
 *   so retrying the HTTP request cannot create a second job for one booking.
 */
export async function enqueueBookingJob(payload, jobId) {
  const job = await getBookingQueue().add(BOOKING_JOB_NAME, payload, { jobId });

  logger.info(
    { jobId: job.id, bookingId: payload.bookingId, quantity: payload.quantity },
    'Booking job enqueued',
  );

  return job.id;
}

export async function getQueueCounts() {
  return getBookingQueue().getJobCounts(
    'waiting',
    'active',
    'delayed',
    'completed',
    'failed',
  );
}

export async function closeBookingQueue() {
  if (!queue) return;

  const current = queue;
  queue = undefined;
  await current.close();
}
