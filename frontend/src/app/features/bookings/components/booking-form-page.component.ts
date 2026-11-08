import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EventSummary } from '../../../core/models/event.model';
import { extractApiErrorMessage } from '../../../core/utils/api-error';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { EventService } from '../../events/services/event.service';
import { BookingService } from '../services/booking.service';

const MAX_TICKETS_PER_BOOKING = 10;

@Component({
  selector: 'app-booking-form-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, MoneyPipe, LoadingSpinnerComponent],
  templateUrl: './booking-form-page.component.html',
})
export class BookingFormPageComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly bookingService = inject(BookingService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  readonly event = signal<EventSummary | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    quantity: [
      1,
      [
        Validators.required,
        Validators.min(1),
        Validators.max(MAX_TICKETS_PER_BOOKING),
      ],
    ],
  });

  private readonly selectedQuantity = signal(1);

  /** Never offer more seats than remain in the pool. */
  readonly maxSelectable = computed(() =>
    Math.min(MAX_TICKETS_PER_BOOKING, this.event()?.availableTickets ?? 0),
  );

  readonly quantityOptions = computed(() =>
    Array.from({ length: this.maxSelectable() }, (_, index) => index + 1),
  );

  readonly totalCents = computed(
    () => (this.event()?.priceCents ?? 0) * this.selectedQuantity(),
  );

  constructor() {
    this.form.controls.quantity.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.selectedQuantity.set(Number(value) || 0));
  }

  ngOnInit(): void {
    this.eventService.getById(this.id()).subscribe({
      next: (event) => {
        this.event.set(event);
        this.form.controls.quantity.setValue(event.availableTickets > 0 ? 1 : 0);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { quantity } = this.form.getRawValue();

    if (quantity > this.maxSelectable()) {
      this.errorMessage.set(`Only ${this.maxSelectable()} tickets are left for this event.`);
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    // A fresh key per submission: a double-click or a proxy retry is recognised
    // by the backend instead of creating a second booking.
    const idempotencyKey = crypto.randomUUID();

    this.bookingService.create({ eventId: this.id(), quantity }, idempotencyKey).subscribe({
      next: (accepted) => {
        void this.router.navigate(['/bookings', accepted.bookingId]);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error));
        this.submitting.set(false);
      },
    });
  }
}
