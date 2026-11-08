import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import * as inventoryService from '../../services/inventory.service.js';

/**
 * Event projection sent to clients.
 *
 * `availableTickets` is derived from the durable counters. Once Redis owns the
 * hot-path counter this field will be read from Redis instead — the response
 * shape stays identical, which is why it is centralised here.
 */
function toPublicEvent(event) {
  const availableTickets = Math.max(event.capacity - event.reservedCount, 0);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    startsAt: event.startsAt,
    currency: event.currency,
    capacity: event.capacity,
    reservedTickets: event.reservedCount,
    availableTickets,
    priceCents: event.priceCents,
    isSoldOut: availableTickets === 0,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export async function createEvent(payload, createdById) {
  const event = await prisma.event.create({
    data: { ...payload, createdById },
  });

  return toPublicEvent(event);
}

export async function listEvents({ take = 20, includePast = false } = {}) {
  const events = await prisma.event.findMany({
    where: includePast ? {} : { startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    take,
  });

  return events.map(toPublicEvent);
}

export async function getEventById(id) {
  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) {
    throw AppError.notFound('Event not found');
  }

  return toPublicEvent(event);
}

/** Admin view: who owns the inventory and where the numbers come from. */
export async function getEventInventory(id) {
  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      capacity: true,
      reservedCount: true,
      priceCents: true,
      currency: true,
    },
  });

  if (!event) {
    throw AppError.notFound('Event not found');
  }

  const availability = await inventoryService.getAvailability(id);

  return {
    eventId: event.id,
    title: event.title,
    capacity: event.capacity,
    reservedTickets: event.reservedCount,
    availableTickets: availability.availableTickets,
    priceCents: event.priceCents,
    currency: event.currency,
    inventorySource: availability.source,
  };
}
