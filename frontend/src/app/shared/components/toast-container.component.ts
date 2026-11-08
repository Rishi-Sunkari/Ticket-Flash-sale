import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService, ToastKind } from '../../core/services/notification.service';

const TOAST_STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      @for (toast of notifications.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
          [class]="styleFor(toast.kind)"
          role="status"
        >
          <span>{{ toast.message }}</span>
          <button
            type="button"
            class="text-xs font-bold opacity-60 hover:opacity-100"
            (click)="notifications.dismiss(toast.id)"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly notifications = inject(NotificationService);

  styleFor(kind: ToastKind): string {
    return TOAST_STYLES[kind];
  }
}
