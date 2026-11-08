import { asyncHandler } from '../../utils/async-handler.js';
import * as bookingService from './booking.service.js';

/**
 * 202 Accepted, not 201 Created: the resource exists, but the *outcome*
 * (reserved / failed / expired) is decided later by a worker.
 */
export const createBooking = asyncHandler(async (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key') ?? undefined;

  const booking = await bookingService.createBooking({
    userId: req.user.id,
    eventId: req.body.eventId,
    quantity: req.body.quantity,
    idempotencyKey,
  });

  res
    .status(202)
    .location(`/api/v1/bookings/${booking.id}`)
    .json({
      data: {
        bookingId: booking.id,
        status: booking.status,
        pollUrl: `/api/v1/bookings/${booking.id}`,
      },
    });
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingById(req.params.id, req.user);
  res.status(200).json({ data: { booking } });
});

export const listMyBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.listBookingsForUser(
    req.user.id,
    req.validatedQuery ?? {},
  );
  res.status(200).json({ data: { bookings } });
});

export const getAdminOverview = asyncHandler(async (_req, res) => {
  const overview = await bookingService.getAdminOverview();
  res.status(200).json({ data: { overview } });
});
