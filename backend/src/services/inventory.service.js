import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

/**
 * INVENTORY SEAM — the most important extension point of the base project.
 *
 * Today PostgreSQL is the source of truth for availability. In the next phase
 * this module becomes the *only* module that talks to Redis, using a Lua script
 * so that "check" and "decrement" happen in one atomic step:
 *
 *     local available = tonumber(redis.call('GET', KEYS[1]) or '0')
 *     local qty = tonumber(ARGV[1])
 *     if available < qty then return -1 end
 *     redis.call('DECRBY', KEYS[1], qty)
 *     return available - qty
 *
 * Nothing outside this file may decrement inventory. That single rule is what
 * keeps the concurrency reasoning small enough to be correct.
 */
export const INVENTORY_SOURCE = 'postgres';

/** Read-only availability lookup. */
export async function getAvailability(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { capacity: true, reservedCount: true },
  });

  if (!event) {
    throw AppError.notFound('Event not found');
  }

  return {
    source: INVENTORY_SOURCE,
    availableTickets: Math.max(event.capacity - event.reservedCount, 0),
  };
}

/** Phase 2: atomically reserve `quantity` tickets for a booking. */
export async function reserveTickets() {
  throw AppError.notImplemented(
    'Atomic Redis inventory reservation is implemented in the next phase',
  );
}

/** Phase 2: return tickets to the pool after a failure or expiration. */
export async function releaseTickets() {
  throw AppError.notImplemented(
    'Inventory release is implemented in the next phase',
  );
}

/** Phase 2: rebuild the Redis counter from the durable PostgreSQL numbers. */
export async function syncInventoryFromDatabase(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { capacity: true, reservedCount: true },
  });

  if (!event) {
    throw AppError.notFound('Event not found');
  }

  return Math.max(event.capacity - event.reservedCount, 0);
}
