import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../models/api.model';

/**
 * Turns an HttpErrorResponse into a message that is safe to show a user.
 *
 * The backend always answers errors with `{ error: { code, message } }`, so we
 * prefer that message; network failures have no body and need their own text.
 */
export function extractApiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Cannot reach the API. Is the backend running on port 4000?';
    }

    const payload = error.error as Partial<ApiError> | null;
    const message = payload?.error?.message;

    if (message) {
      return message;
    }

    return `Request failed with status ${error.status}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
