import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BookingStatus } from '../../core/models/booking.model';

const STATUS_STYLES: Record<BookingStatus, string> = {
  PROCESSING: 'bg-amber-50 text-amber-700 ring-amber-200',
  RESERVED: 'bg-sky-50 text-sky-700 ring-sky-200',
  PAYMENT_PENDING: 'bg-violet-50 text-violet-700 ring-violet-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PROCESSING: 'Processing',
  RESERVED: 'Reserved',
  PAYMENT_PENDING: 'Payment pending',
  CONFIRMED: 'Confirmed',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
      [class]="style()"
    >
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<BookingStatus>();

  readonly style = computed(() => STATUS_STYLES[this.status()]);
  readonly label = computed(() => STATUS_LABELS[this.status()]);
}
