import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { AdminOverview } from '../../../core/models/booking.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/bookings/admin/overview`;

  /** One round-trip for counters, revenue, inventory and recent bookings. */
  overview(): Observable<AdminOverview> {
    return this.http
      .get<ApiResponse<{ overview: AdminOverview }>>(this.baseUrl)
      .pipe(map((response) => response.data.overview));
  }
}
