import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Pure CSS spinner — no images, no dependencies. */
@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center gap-3 py-10 text-slate-500">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"></span>
      <span class="text-sm">{{ label() }}</span>
    </div>
  `,
})
export class LoadingSpinnerComponent {
  readonly label = input('Loading…');
}
