import { AppError } from '../utils/errors.js';

/**
 * PAYMENT SEAM.
 *
 * Intentionally unimplemented. The booking lifecycle is already shaped for it:
 *
 *   RESERVED --(create payment intent)--> PAYMENT_PENDING
 *   PAYMENT_PENDING --(provider webhook: succeeded)--> CONFIRMED
 *   PAYMENT_PENDING --(provider webhook: failed)--> FAILED
 *
 * A payment must never be started unless the inventory reservation succeeded,
 * otherwise a user could pay for tickets that do not exist. That ordering is the
 * whole reason the lifecycle has a separate RESERVED state.
 */
export async function createPaymentIntent() {
  throw AppError.notImplemented('Payment gateway integration is not implemented yet');
}

export async function handlePaymentWebhook() {
  throw AppError.notImplemented('Payment webhook handling is not implemented yet');
}
