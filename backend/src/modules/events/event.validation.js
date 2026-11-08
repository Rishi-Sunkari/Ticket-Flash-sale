import { z } from 'zod';
import { uuidSchema } from '../../middlewares/validate.middleware.js';

export const createEventSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  venue: z.string().trim().min(3).max(200),
  startsAt: z.coerce
    .date()
    .refine((date) => date.getTime() > Date.now(), 'startsAt must be in the future'),
  capacity: z.coerce
    .number()
    .int('capacity must be a whole number')
    .min(1, 'capacity must be at least 1')
    .max(100_000, 'capacity is unrealistically large'),
  priceCents: z.coerce
    .number()
    .int('priceCents must be a whole number of minor units')
    .min(0)
    .max(100_000_000),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
});

export const eventIdParamSchema = z.object({ id: uuidSchema });

/**
 * `z.coerce.boolean()` would turn the string "false" into `true` (any non-empty
 * string is truthy), so booleans arriving as query strings are parsed explicitly.
 */
export const listEventsQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(50).default(20),
  includePast: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
