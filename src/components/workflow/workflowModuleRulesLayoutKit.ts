/**
 * Visual tokens for Arbeidsflyt → Modul-regler, aligned with:
 * - `PlatformModuleTemplatesPage` (modul-maler: amber primary, rounded-xl, section labels)
 * - `platformLayoutKitDemos` cream preview wrap (rounded-xl border, white body card)
 *
 * Used on the workplace (cream) surface — not inside slate-950 platform chrome.
 */

export const WMR_SHELL = 'mx-auto max-w-[1400px]'

/** Outer white card on cream canvas — same idea as layout-hub preview inner card */
export const WMR_PAGE_CARD =
  'rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm md:p-6 space-y-6'
export const WMR_PAGE_CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

/** Section / sidebar label — matches platform `SectionH` / module picker caption */
export const WMR_SECTION_LABEL = 'text-[11px] font-bold uppercase tracking-wider text-neutral-500'

/** Info / tips strip */
export const WMR_CALLOUT =
  'flex gap-3 rounded-xl border border-sky-200/70 bg-sky-50/80 p-4 text-sm text-sky-900'

export const WMR_CALLOUT_WARN =
  'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950'

/** Primary CTA — same amber as platform `BTN_PRIMARY` on Modul-maler */
export const WMR_BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-slate-950 shadow-sm transition-colors hover:bg-amber-400 disabled:opacity-50'

/** Secondary — platform `BTN_GHOST` adapted for light surface */
export const WMR_BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50'

/** Filter / pill group container */
export const WMR_PILL_GROUP = 'flex flex-wrap gap-1 rounded-xl border border-neutral-200/90 bg-neutral-50/80 p-1'

/** Inactive pill */
export const WMR_PILL =
  'rounded-lg px-3 py-1.5 text-xs font-semibold transition border border-transparent text-neutral-600 hover:bg-white hover:text-neutral-900'

/** Active pill (forest — matches hub “active” elsewhere on workplace) */
export const WMR_PILL_ACTIVE = `${WMR_PILL} border-transparent bg-[#1a3d32] text-white shadow-sm`

/** Active module pill — amber accent like platform module sidebar selection */
export const WMR_PILL_MODULE_ACTIVE =
  `${WMR_PILL} border-amber-400/50 bg-amber-100/90 text-amber-950 shadow-sm`

/** Per-module block header card */
export const WMR_MODULE_HEADER_CARD =
  'rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm md:p-5'

export const WMR_MODULE_HEADER_CARD_SHADOW = WMR_PAGE_CARD_SHADOW

export const WMR_RULE_CARD =
  'rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm transition hover:border-neutral-300/90'

export const WMR_RULE_CARD_MUTED = 'rounded-xl border border-neutral-100 bg-white/90 p-4 opacity-80 shadow-sm'

export const WMR_EMPTY_STATE =
  'rounded-xl border border-dashed border-neutral-200 bg-neutral-50/90 p-8 text-center text-sm text-neutral-500 sm:col-span-2 lg:col-span-3'

export const WMR_ERROR_BOX = 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
