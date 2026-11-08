import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ToastContainerComponent } from './shared/components/toast-container.component';

/**
 * Application shell: header + navigation + `<router-outlet>`.
 *
 * Every feature page is lazy-loaded, so this component (plus the core services it
 * imports) is almost everything that ships in the initial bundle.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly currentYear = new Date().getFullYear();
}
