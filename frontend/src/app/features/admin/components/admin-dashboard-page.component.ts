import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AdminOverview } from '../../../core/models/booking.model';
import { NotificationService } from '../../../core/services/notification.service';
import { extractApiErrorMessage } from '../../../core/utils/api-error';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { EventService } from '../../events/services/event.service';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MoneyPipe,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './admin-dashboard-page.component.html',
})
export class AdminDashboardPageComponent {
  private readonly adminService = inject(AdminService);
  private readonly eventService = inject(EventService);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly overview = signal<AdminOverview | null>(null);
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly totalBookings = computed(() => {
    const overview = this.overview();
    if (!overview) return 0;

    return Object.values(overview.bookingsByStatus).reduce(
      (total, count) => total + count,
      0,
    );
  });

  readonly createEventForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(140)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    venue: ['', [Validators.required, Validators.minLength(3)]],
    // `datetime-local` yields "YYYY-MM-DDTHH:mm".
    startsAt: ['', [Validators.required]],
    capacity: [500, [Validators.required, Validators.min(1), Validators.max(100_000)]],
    priceRupees: [2500, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.adminService.overview().subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  createEvent(): void {
    if (this.createEventForm.invalid) {
      this.createEventForm.markAllAsTouched();
      return;
    }

    const values = this.createEventForm.getRawValue();
    this.creating.set(true);

    this.eventService
      .create({
        title: values.title.trim(),
        description: values.description.trim(),
        venue: values.venue.trim(),
        startsAt: new Date(values.startsAt).toISOString(),
        capacity: Number(values.capacity),
        // The form is in rupees for humans; the API wants integer minor units.
        priceCents: Math.round(Number(values.priceRupees) * 100),
        currency: 'INR',
      })
      .subscribe({
        next: (event) => {
          this.notifications.success(`Event "${event.title}" created`);
          this.createEventForm.reset({
            title: '',
            description: '',
            venue: '',
            startsAt: '',
            capacity: 500,
            priceRupees: 2500,
          });
          this.creating.set(false);
          this.load();
        },
        error: (error: unknown) => {
          this.notifications.error(extractApiErrorMessage(error));
          this.creating.set(false);
        },
      });
  }
}
