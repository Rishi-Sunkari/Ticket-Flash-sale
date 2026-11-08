import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/**
 * Tiny signal-based toast store. Signals are a good fit here: any component can
 * read `toasts()` without subscribing manually, and the template re-renders when
 * the array changes.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.toastsSignal.asReadonly();

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this.toastsSignal.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private push(kind: ToastKind, message: string): void {
    const id = this.nextId++;
    this.toastsSignal.update((toasts) => [...toasts, { id, kind, message }]);

    // Toasts are transient: remove them automatically so the list cannot grow
    // unbounded during a long session.
    setTimeout(() => this.dismiss(id), 5000);
  }
}
