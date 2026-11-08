import { prisma } from '../../config/database.js';
import { AppError, InvalidStatusTransitionError } from '../../utils/errors.js';
import { BookingStatus, canTransition } from '../../constants/booking-status.js';
import { enqueueBookingJob } from '../../queues/booking.queue.js';
import { logger } from '../../utils/logger.js';

const bookingInclude = {
  event: {
    select: {
      id: true,
      title: true,
      venue: true,
      startsAt: true,
      currency: true,
      priceCents: true,
    },
  },
};

function toPublicBooking(booking) {
  return {
    id: booking.id,
    status: booking.status,
    quantity: booking.quantity,
    unitPriceCents: booking.unitPriceCents,
    totalPriceCents: booking.totalPriceCents,
    currency: booking.event?.currency ?? 'INR',
    /********************************************************************
     * Extension point — Phase 2 sets `reservedUntil` when Redis reserves
     * the tickets, so the UI can show a countdown.
     ********************************************************************/
    reservedUntil: booking.reservedUntil,
    failureReason: booking.failureReason,
    event: booking.event
      ? {
          id: booking.event.id,
          title: booking.event.title,
          venue: booking.event.venue,
          startsAt: booking.event.startsAt,
        }
      : undefined,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

/**
 * Accept a booking request.
 *
 * This is deliberately *not* the place where inventory is touched. The API
 * process only:
 *   1. writes a durable booking row (status PROCESSING),
 *   2. enqueues a job,
 *   3. returns immediately with 202 + booking id.
 *
 * Keeping the hot path this short is what lets one API node absorb thousands of
 * concurrent requests; the expensive/expensive-to-coordinate work happens in
 * workers.
 */
export async function createBooking({ userId, eventId, quantity, idempotencyKey }) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, priceCents: true, capacity: true, reservedCount: true },
  });

  if (!event) {
    throw AppError.notFound('Event not found');
  }

  // Cheap early rejection for an obviously sold-out event. The *authoritative*
  // check is the atomic reservation in the worker: this read can be stale by the
  // time the job runs, which is exactly why it cannot be trusted.
  if (event.capacity - event.reservedCount <= 0) {
    throw AppError.conflict('This event is sold out', 'EVENT_SOLD_OUT');
  }

  let booking;

  try {
    booking = await prisma.booking.create({
      data: {
        userId,
        eventId,
        quantity,
        unitPriceCents: event.priceCents,
        totalPriceCents: event.priceCents * quantity,
        status: BookingStatus.PROCESSING,
        idempotencyKey: idempotencyKey ?? null,
      },
      include: bookingInclude,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw AppError.conflict(
        'This Idempotency-Key was already used for another booking request',
        'IDEMPOTENCY_KEY_REUSED',
      );
    }
    throw error;
  }

  try {
    const jobId = await enqueueBookingJob(
      { bookingId: booking.id, userId, eventId, quantity },
      /** BullMQ job id = booking id => enqueueing twice cannot create two jobs. */
      booking.id,
    );

    const withJob = await prisma.booking.update({
      where: { id: booking.id },
      data: { jobId },
      include: bookingInclude,
    });

    return toPublicBooking(withJob);
  } catch (error) {
    // PostgreSQL and Redis are not transactional together. If the enqueue
    // fails we must not leave a booking stuck in PROCESSING forever: mark it
    // FAILED and let the client retry with the same Idempotency-Key.
    logger.error(
      { err: error.message, bookingId: booking.id },
      'Failed to enqueue booking job',
    );

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.FAILED, failureReason: 'QUEUE_UNAVAILABLE' },
    });

    throw AppError.serviceUnavailable(
      'The booking queue is temporarily unavailable. Please retry.',
      'QUEUE_UNAVAILABLE',
    );
  }
}

export async function getBookingById(id, requester) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  if (booking.userId !== requester.id && requester.role !== 'ADMIN') {
    // 404 rather than 403: do not confirm that a booking id exists.
    throw AppError.notFound('Booking not found');
  }

  return toPublicBooking(booking);
}

export async function listBookingsForUser(userId, { take = 20 } = {}) {
  const bookings = await prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    include: bookingInclude,
  });

  return bookings.map(toPublicBooking);
}

/**
 * Compare-and-set status transition.
 *
 * `updateMany` with the *expected* status in the WHERE clause makes the change
 * conditional in a single SQL statement: if two workers race, exactly one wins
 * and the other gets `count: 0`. This is optimistic concurrency control without
 * holding a row lock across multiple round-trips.
 */
export async function transitionBookingStatus(bookingId, from, to, extraData = {}) {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }

  const result = await prisma.booking.updateMany({
    where: { id: bookingId, status: from },
    data: { status: to, ...extraData },
  });

  if (result.count === 0) {
    throw new InvalidStatusTransitionError(from, to);
  }

  return getBookingById(bookingId, { id: 'system', role: 'ADMIN' });
}

/** Everything the admin dashboard needs in one round-trip. */
export async function getAdminOverview() {
  const [statusGroups, recentBookings, upcomingEvents] = await Promise.all([
    prisma.booking.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { totalPriceCents: true },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        ...bookingInclude,
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.event.findMany({
      orderBy: { startsAt: 'asc' },
      take: 20,
      select: {
        id: true,
        title: true,
        startsAt: true,
        capacity: true,
        reservedCount: true,
        priceCents: true,
        currency: true,
      },
    }),
  ]);

  const byStatus = Object.fromEntries(
    Object.values(BookingStatus).map((status) => [status, 0]),
  );

  let revenueCents = 0;

  for (const group of statusGroups) {
    byStatus[group.status] = group._count._all;

    if (group.status === BookingStatus.CONFIRMED) {
      revenueCents = group._sum.totalPriceCents ?? 0;
    }
  }

  return {
    bookingsByStatus: byStatus,
    revenueCents,
    recentBookings: recentBookings.map((booking) => ({
      ...toPublicBooking(booking),
      customer: booking.user,
    })),
    inventory: upcomingEvents.map((event) => ({
      eventId: event.id,
      title: event.title,
      startsAt: event.startsAt,
      capacity: event.capacity,
      reservedTickets: event.reservedCount,
      availableTickets: Math.max(event.capacity - event.reservedCount, 0),
      priceCents: event.priceCents,
      currency: event.currency,
    })),
  };
}
