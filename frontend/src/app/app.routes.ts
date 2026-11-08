import { Routes } from '@angular/router';
import { adminGuard, guestGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';

/**
 * Route table.
 *
 * Every feature is lazy-loaded with `loadComponent`, so each page becomes its own
 * JavaScript chunk. The browser only downloads the booking pages if the user
 * actually navigates there.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'events' },

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/components/login-page.component').then(
        (m) => m.LoginPageComponent,
      ),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/components/register-page.component').then(
        (m) => m.RegisterPageComponent,
      ),
  },

  {
    path: 'events',
    loadComponent: () =>
      import('./features/events/components/events-list-page.component').then(
        (m) => m.EventsListPageComponent,
      ),
  },
  {
    path: 'events/:id',
    loadComponent: () =>
      import('./features/events/components/event-detail-page.component').then(
        (m) => m.EventDetailPageComponent,
      ),
  },
  {
    path: 'events/:id/book',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bookings/components/booking-form-page.component').then(
        (m) => m.BookingFormPageComponent,
      ),
  },

  {
    path: 'bookings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bookings/components/my-bookings-page.component').then(
        (m) => m.MyBookingsPageComponent,
      ),
  },
  {
    path: 'bookings/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bookings/components/booking-status-page.component').then(
        (m) => m.BookingStatusPageComponent,
      ),
  },

  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/components/admin-dashboard-page.component').then(
        (m) => m.AdminDashboardPageComponent,
      ),
  },

  // Unknown URLs (including stale deep links) fall back to the catalogue.
  { path: '**', redirectTo: 'events' },
];
