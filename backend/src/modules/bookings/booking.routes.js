import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import * as bookingController from './booking.controller.js';
import {
  bookingIdParamSchema,
  createBookingSchema,
  listBookingsQuerySchema,
} from './booking.validation.js';

const router = Router();

// Every booking endpoint requires a logged-in user.
router.use(authenticate);

// Static paths must be declared before the `/:id` wildcard.
router.get(
  '/admin/overview',
  requireRole('ADMIN'),
  bookingController.getAdminOverview,
);

router.post(
  '/',
  validate({ body: createBookingSchema }),
  bookingController.createBooking,
);

router.get(
  '/',
  validate({ query: listBookingsQuerySchema }),
  bookingController.listMyBookings,
);

router.get(
  '/:id',
  validate({ params: bookingIdParamSchema }),
  bookingController.getBooking,
);

export default router;
