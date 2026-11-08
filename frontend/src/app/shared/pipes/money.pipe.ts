import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats integer minor units (the only money representation the API sends)
 * into a localised currency string: 250000 -> "₹2,500.00".
 *
 * Formatting in the presentation layer keeps the API unambiguous — it never has
 * to guess a locale, and no floating point arithmetic happens anywhere.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amountInMinorUnits: number | null | undefined, currency = 'INR'): string {
    if (amountInMinorUnits === null || amountInMinorUnits === undefined) {
      return '—';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountInMinorUnits / 100);
  }
}
