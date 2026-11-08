import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EventSummary } from '../../../core/models/event.model';
import { extractApiErrorMessage } from '../../../core/utils/api-error';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { EventService } from '../services/event.service';

@Component({
  selector: 'app-event-detail-page',
  imports: [RouterLink, DatePipe, MoneyPipe, LoadingSpinnerComponent],
  templateUrl: './event-detail-page.component.html',
})
export class EventDetailPageComponent implements OnInit {
  private readonly eventService = inject(EventService);
  readonly auth = inject(AuthService);

  /**
   * Route parameter bound directly by `withComponentInputBinding()` — no
   * ActivatedRoute plumbing required.
   */
  readonly id = input.required<string>();

  readonly event = signal<EventSummary | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.eventService.getById(this.id()).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }
}
