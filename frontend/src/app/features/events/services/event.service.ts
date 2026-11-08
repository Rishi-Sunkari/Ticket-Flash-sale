import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { CreateEventPayload, EventSummary } from '../../../core/models/event.model';

/**
 * Everything the UI needs to know about events.
 *
 * Services return typed observables and unwrap the `{ data }` envelope exactly
 * once, so components deal with domain objects rather than transport shapes.
 */
@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/events`;

  list(includePast = false): Observable<EventSummary[]> {
    const params = new HttpParams()
      .set('take', '50')
      .set('includePast', includePast ? 'true' : 'false');

    return this.http
      .get<ApiResponse<{ events: EventSummary[] }>>(this.baseUrl, { params })
      .pipe(map((response) => response.data.events));
  }

  getById(id: string): Observable<EventSummary> {
    return this.http
      .get<ApiResponse<{ event: EventSummary }>>(`${this.baseUrl}/${id}`)
      .pipe(map((response) => response.data.event));
  }

  /** Admin only — the backend enforces the role. */
  create(payload: CreateEventPayload): Observable<EventSummary> {
    return this.http
      .post<ApiResponse<{ event: EventSummary }>>(this.baseUrl, payload)
      .pipe(map((response) => response.data.event));
  }
}
