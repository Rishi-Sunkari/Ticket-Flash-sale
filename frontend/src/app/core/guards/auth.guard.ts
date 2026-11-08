import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Functional guards. Returning a UrlTree (instead of calling navigate()) lets
 * Angular complete the redirect in the same navigation cycle.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Remember where the user wanted to go so login can send them back.
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
