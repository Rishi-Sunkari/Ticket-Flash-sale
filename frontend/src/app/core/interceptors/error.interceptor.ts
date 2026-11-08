import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Session-level error handling only:
 * - 401 -> the stored token is stale, so clear it and bounce to /login;
 * - 0   -> the API is unreachable (backend down, CORS misconfiguration).
 *
 * Everything else is returned untouched so each page can render its own inline
 * message next to the form that failed.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const notifications = inject(NotificationService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401 && auth.isAuthenticated()) {
          notifications.error('Your session expired. Please sign in again.');
          auth.logout();
        } else if (error.status === 0) {
          notifications.error('Cannot reach the API. Is the backend running?');
        }
      }

      return throwError(() => error);
    }),
  );
};
