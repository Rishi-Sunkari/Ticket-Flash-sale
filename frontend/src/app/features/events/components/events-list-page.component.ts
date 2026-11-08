import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventSummary } from '../../../core/models/event.model';
import { EventService } from '../services/event.service';
import { extractApiErrorMessage } from '../../../core/utils/api-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

@Component({
  selector: 'app-events-list-page',
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  templateUrl: './events-list-page.component.html',
})
export class EventsListPageComponent {
  private readonly eventService = inject(EventService);

  readonly events = signal<EventSummary[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.eventService.list().subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /** Percentage of seats still available — drives the availability bar. */
  availabilityPercent(event: EventSummary): number {
    if (event.capacity === 0) return 0;
    return Math.round((event.availableTickets / event.capacity) * 100);
  }
}
