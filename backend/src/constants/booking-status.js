/**
 * Booking lifecycle — the single source of truth for legal state changes.
 *
 *   PROCESSING ──► RESERVED ──► PAYMENT_PENDING ──► CONFIRMED
 *       │             │                │
 *       └──► FAILED   └──► FAILED      └──► FAILED
 *                     └──► EXPIRED     └──► EXPIRED
 *
 * Terminal states (CONFIRMED, FAILED, EXPIRED) have no outgoing edges, which is
 * what makes the lifecycle safe to replay: a retried job can never "resurrect"
 * a finished booking.
 *
 * Enforcing this in one pure module (rather than in SQL or in each service)
 * means the rules are unit-testable without a database.
 */
export const BookingStatus = Object.freeze({
  PROCESSING: 'PROCESSING',
  RESERVED: 'RESERVED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
});

export const BOOKING_STATUS_VALUES = Object.freeze(Object.values(BookingStatus));

export const TERMINAL_STATUSES = Object.freeze([
  BookingStatus.CONFIRMED,
  BookingStatus.FAILED,
  BookingStatus.EXPIRED,
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  [BookingStatus.PROCESSING]: Object.freeze([
    BookingStatus.RESERVED,
    BookingStatus.FAILED,
  ]),
  [BookingStatus.RESERVED]: Object.freeze([
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.FAILED,
    BookingStatus.EXPIRED,
  ]),
  [BookingStatus.PAYMENT_PENDING]: Object.freeze([
    BookingStatus.CONFIRMED,
    BookingStatus.FAILED,
    BookingStatus.EXPIRED,
  ]),
  [BookingStatus.CONFIRMED]: Object.freeze([]),
  [BookingStatus.FAILED]: Object.freeze([]),
  [BookingStatus.EXPIRED]: Object.freeze([]),
});

export function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}
