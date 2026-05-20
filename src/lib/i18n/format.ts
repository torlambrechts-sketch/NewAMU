// Locale-aware formatting helpers.
//
// Every date/number/currency render must go through here instead of
// hardcoding `nb-NO` (the codebase had ~68 such call sites). The active
// locale is read from the live i18next instance, so output follows the
// user's chosen language with no prop-drilling.

import i18next from 'i18next'
import { LOCALE_BCP47, normalizeLocale } from './locales'

function activeBcp47(): string {
  return LOCALE_BCP47[normalizeLocale(i18next.language)]
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(activeBcp47(), options).format(toDate(value))
}

export function formatDateTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  return new Intl.DateTimeFormat(activeBcp47(), options).format(toDate(value))
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(activeBcp47(), options).format(value)
}

export function formatCurrency(value: number, currency = 'NOK'): string {
  return new Intl.NumberFormat(activeBcp47(), { style: 'currency', currency }).format(value)
}

// Locale-aware string comparison for sorts (replaces `localeCompare(b, 'nb')`).
export function compareLocale(a: string, b: string): number {
  return a.localeCompare(b, activeBcp47())
}
