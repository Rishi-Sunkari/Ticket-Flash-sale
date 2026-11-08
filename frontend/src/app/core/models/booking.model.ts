import type { User } from './user.model';

/**
 * Mirrors the backend `BookingStatus` enum. Keeping the union type here means
 * the compiler catches switch statements that forget a state.
 */
export type BookingStatus =
  | 'PROCESSING'
  | 'RESERVED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED';

export interface BookingEventSummary {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  currency: string;
  reservedUntil: string | null;
  failureReason: string | null;
  event?: BookingEventSummary;
  createdAt: string;
  updatedAt: string;
}

/** 202 response of `POST /bookings`. */
export interface BookingAccepted {
  bookingId: string;
  status: BookingStatus;
  pollUrl: string;
}

export interface CreateBookingPayload {
  eventId: string;
  quantity: number;
}

/** Terminal states never change again, so the UI can stop polling. */
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'CONFIRMED',
  'FAILED',
  'EXPIRED',
];

export function isTerminalStatus(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status);
}

export interface AdminOverview {
  bookingsByStatus: Record<BookingStatus, number>;
  revenueCents: number;
  recentBookings: Array<Booking & { customer: Pick<User, 'id' | 'email' | 'name'> }>;
  inventory: Array<{
    eventId: string;
    title: string;
    startsAt: string;
    capacity: number;
    reservedTickets: number;
    availableTickets: number;
    priceCents: number;
    currency: string;
  }>;
}
