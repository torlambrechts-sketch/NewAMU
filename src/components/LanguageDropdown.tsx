// Language switcher — dropdown of every locale in the app_locales registry.
//
// Three trigger variants for the three surfaces it mounts on:
//  - `topbar`  — dark forest app header (light trigger text)
//  - `sidebar` — light utilities row in sidebar nav mode (dark trigger text)
//  - `page`    — light card on the profile page (bordered, full width)
// The dropdown PANEL is always a light card with black text, readable from
// any trigger surface. Replaces the old two-flag radio switcher and the
// profile-page locale <SearchableSelect>.
//
// Selecting a language applies it immediately via i18next and — for a
// logged-in user — persists it to `profiles.locale` through the
// `set_profile_locale` RPC, so the choice follows the account across devices.

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { useT } from '../hooks/useT'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '../lib/i18n/locales'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { Button } from './ui/Button'

type Variant = 'topbar' | 'sidebar' | 'page'

export function LanguageDropdown({ variant = 'page' }: { variant?: Variant }) {
  const { locale, setLocale, t } = useT()
  const { supabase, user } = useOrgSetupContext()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (next: AppLocale) => {
    setOpen(false)
    if (next === locale) return
    void setLocale(next)
    if (supabase && user) {
      void supabase.rpc('set_profile_locale', { p_locale: next })
    }
  }

  const onDark = variant === 'topbar'

  // Trigger styling — matches the surface it sits on.
  const triggerClass =
    variant === 'topbar'
      ? `h-auto w-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-white/10 ${
          open ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'
        }`
      : variant === 'sidebar'
        ? `h-auto w-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 ${
            open ? 'bg-black/5 text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
          }`
        : `h-auto w-auto inline-flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-normal transition-colors ${
            open
              ? 'border-[color:var(--ui-accent)] bg-white text-neutral-900'
              : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
          }`

  // The dropdown panel is always a light card with dark text — readable
  // regardless of which surface the trigger sits on.
  const panelClass =
    variant === 'page'
      ? 'absolute left-0 top-full z-50 mt-1 w-full min-w-44 rounded-lg border border-neutral-200 bg-white py-1 text-neutral-800 shadow-lg'
      : 'absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-neutral-200 bg-white py-1 text-neutral-800 shadow-xl'

  const itemBase =
    'h-auto w-auto flex w-full items-center justify-between gap-2 rounded-none px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50'

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('shell.language')}
      >
        <Globe
          className={variant === 'page' ? 'size-4 text-neutral-500' : onDark ? 'size-3.5' : 'size-3.5 text-neutral-500'}
          aria-hidden
        />
        <span className={variant === 'page' ? 'flex-1 text-left' : ''}>{LOCALE_LABELS[locale]}</span>
        <ChevronDown className={`size-3.5 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </Button>
      {open ? (
        <div className={panelClass} role="listbox" aria-label={t('shell.language')}>
          {APP_LOCALES.map((code) => {
            const selected = code === locale
            return (
              <Button
                key={code}
                variant="ghost"
                role="option"
                aria-selected={selected}
                onClick={() => choose(code)}
                className={`${itemBase} ${selected ? 'font-semibold' : 'font-normal'}`}
              >
                <span>{LOCALE_LABELS[code]}</span>
                {selected ? (
                  <Check className="size-4 text-[color:var(--ui-accent)]" aria-hidden />
                ) : null}
              </Button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
