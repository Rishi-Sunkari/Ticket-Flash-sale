import { z } from 'zod';
import { uuidSchema } from '../../middlewares/validate.middleware.js';

/** Per-order cap. Also enforced by a CHECK constraint in the database. */
export const MAX_TICKETS_PER_BOOKING = 10;

export const createBookingSchema = z.object({
  eventId: uuidSchema,
  quantity: z.coerce
    .number()
    .int('quantity must be a whole number')
    .min(1, 'quantity must be at least 1')
    .max(MAX_TICKETS_PER_BOOKING, `quantity must be at most ${MAX_TICKETS_PER_BOOKING}`),
});

export const bookingIdParamSchema = z.object({ id: uuidSchema });

export const listBookingsQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(50).default(20),
});
