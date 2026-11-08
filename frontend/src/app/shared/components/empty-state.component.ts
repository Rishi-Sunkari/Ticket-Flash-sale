import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h2 class="text-lg font-semibold text-slate-800">{{ heading() }}</h2>
      <p class="max-w-md text-sm text-slate-500">{{ message() }}</p>

      @if (actionLabel() && actionLink()) {
        <a class="btn-primary mt-2" [routerLink]="actionLink()">{{ actionLabel() }}</a>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly heading = input('Nothing here yet');
  readonly message = input('Once something is available it will appear here.');
  readonly actionLabel = input<string | null>(null);
  readonly actionLink = input<string | null>(null);
}
