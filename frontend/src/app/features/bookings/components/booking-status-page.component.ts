import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { Subscription, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Booking, isTerminalStatus } from '../../../core/models/booking.model';
import { extractApiErrorMessage } from '../../../core/utils/api-error';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { BookingService } from '../services/booking.service';

const POLL_INTERVAL_MS = 3000;

@Component({
  selector: 'app-booking-status-page',
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './booking-status-page.component.html',
})
export class BookingStatusPageComponent implements OnInit {
  private readonly bookingService = inject(BookingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();

  readonly booking = signal<Booking | null>(null);
  readonly loading = signal(true);
  readonly polling = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private pollingSubscription?: Subscription;

  ngOnInit(): void {
    this.bookingService.getById(this.id()).subscribe({
      next: (booking) => {
        this.loading.set(false);
        this.applyBooking(booking);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /**
   * Polling is the simplest correct transport for "tell me when the worker is
   * done". The next iteration can replace this with server-sent events without
   * changing the template.
   */
  private applyBooking(booking: Booking): void {
    this.booking.set(booking);

    if (isTerminalStatus(booking.status)) {
      this.stopPolling();
    } else {
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollingSubscription) return;

    this.polling.set(true);

    this.pollingSubscription = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => this.bookingService.getById(this.id())),
      )
      .subscribe({
        next: (booking) => {
          this.booking.set(booking);

          if (isTerminalStatus(booking.status)) {
            this.stopPolling();
          }
        },
        error: () => this.stopPolling(),
      });
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
    this.polling.set(false);
  }
}
