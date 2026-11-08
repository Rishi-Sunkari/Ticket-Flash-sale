import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import * as eventController from './event.controller.js';
import {
  createEventSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
} from './event.validation.js';

const router = Router();

// Public browsing — no authentication required.
router.get('/', validate({ query: listEventsQuerySchema }), eventController.listEvents);
router.get('/:id', validate({ params: eventIdParamSchema }), eventController.getEvent);

// Admin-only operations.
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate({ body: createEventSchema }),
  eventController.createEvent,
);

router.get(
  '/:id/inventory',
  authenticate,
  requireRole('ADMIN'),
  validate({ params: eventIdParamSchema }),
  eventController.getEventInventory,
);

export default router;
