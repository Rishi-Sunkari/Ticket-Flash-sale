import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/**
 * Focuses the host element once it is rendered.
 *
 * Used on the first field of the auth forms: a user who lands on /login should
 * be able to start typing immediately.
 */
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;
    element.focus?.();
  }
}
