import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  BOOKING_STATUS_VALUES,
  BookingStatus,
  canTransition,
  isTerminal,
} from '../src/constants/booking-status.js';

/**
 * The lifecycle is pure logic, so it can be tested without PostgreSQL, Redis or
 * mocks. These tests are the executable specification of the state machine.
 */
describe('booking status lifecycle', () => {
  it('starts every booking in PROCESSING', () => {
    expect(BOOKING_STATUS_VALUES[0]).toBe(BookingStatus.PROCESSING);
  });

  it('allows the happy path PROCESSING -> RESERVED -> PAYMENT_PENDING -> CONFIRMED', () => {
    expect(canTransition(BookingStatus.PROCESSING, BookingStatus.RESERVED)).toBe(true);
    expect(canTransition(BookingStatus.RESERVED, BookingStatus.PAYMENT_PENDING)).toBe(true);
    expect(canTransition(BookingStatus.PAYMENT_PENDING, BookingStatus.CONFIRMED)).toBe(true);
  });

  it('refuses to skip the reservation step', () => {
    expect(canTransition(BookingStatus.PROCESSING, BookingStatus.CONFIRMED)).toBe(false);
    expect(canTransition(BookingStatus.PROCESSING, BookingStatus.PAYMENT_PENDING)).toBe(false);
  });

  it('refuses to confirm a booking whose reservation expired', () => {
    expect(canTransition(BookingStatus.EXPIRED, BookingStatus.CONFIRMED)).toBe(false);
  });

  it('treats CONFIRMED, FAILED and EXPIRED as absorbing states', () => {
    for (const status of [BookingStatus.CONFIRMED, BookingStatus.FAILED, BookingStatus.EXPIRED]) {
      expect(isTerminal(status)).toBe(true);
      expect(ALLOWED_TRANSITIONS[status]).toEqual([]);
    }
  });

  it('allows failure from every non-terminal state', () => {
    expect(canTransition(BookingStatus.PROCESSING, BookingStatus.FAILED)).toBe(true);
    expect(canTransition(BookingStatus.RESERVED, BookingStatus.FAILED)).toBe(true);
    expect(canTransition(BookingStatus.PAYMENT_PENDING, BookingStatus.FAILED)).toBe(true);
  });

  it('ignores unknown statuses instead of throwing', () => {
    expect(canTransition('NOT_A_STATUS', BookingStatus.RESERVED)).toBe(false);
  });
});
