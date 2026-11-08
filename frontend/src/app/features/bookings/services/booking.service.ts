import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import {
  Booking,
  BookingAccepted,
  CreateBookingPayload,
} from '../../../core/models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/bookings`;

  /**
   * Submits a booking request. The API answers 202 with a booking id and the
   * final status is decided asynchronously, so callers must poll `getById`.
   *
   * An Idempotency-Key is sent per submission: if the user double-clicks or the
   * network retries, the backend can recognise the duplicate request.
   */
  create(payload: CreateBookingPayload, idempotencyKey: string): Observable<BookingAccepted> {
    return this.http
      .post<ApiResponse<BookingAccepted>>(this.baseUrl, payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(map((response) => response.data));
  }

  getById(id: string): Observable<Booking> {
    return this.http
      .get<ApiResponse<{ booking: Booking }>>(`${this.baseUrl}/${id}`)
      .pipe(map((response) => response.data.booking));
  }

  listMine(): Observable<Booking[]> {
    const params = new HttpParams().set('take', '50');

    return this.http
      .get<ApiResponse<{ bookings: Booking[] }>>(this.baseUrl, { params })
      .pipe(map((response) => response.data.bookings));
  }
}
