import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  ClipboardList,
  Megaphone,
  Plus,
  ShieldAlert,
  User,
} from 'lucide-react'
import { useTaskItemsData } from '../../../modules/tasks/useTaskItemsData'
import type { NavMode } from './aticsNavMode'
import { Button } from '../ui/Button'
import { useT } from '../../hooks/useT'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '../../lib/i18n/locales'

type ProfileMenuProps = {
  variant: 'sidebar' | 'topbar'
  displayName: string
  email: string
  profileTo: string
  navMode: NavMode
  onNavModeChange: (m: NavMode) => void
  onSignOut: () => void
  logInHref: string
  logInLabel: string
  logOutLabel: string
  settingsAria: string
  showAuth: boolean
  isLoggedIn: boolean
}

function useCloseOnOutsideClick(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])
  return ref
}

// Inline language picker for the profile dropdown. Moved here from the
// shell utility row so the header stops at 6 controls; the dropdown is
// the natural home for low-frequency preferences. The standalone
// <LanguageDropdown> still ships and is used on /profile.
function LanguageInline({ darkSurface }: { darkSurface: boolean }) {
  const { locale, setLocale, t } = useT()
  const { supabase, user } = useOrgSetupContext()

  const inactive = darkSurface
    ? 'border-white/20 text-white/70 hover:border-white/35 hover:text-white'
    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
  const active = darkSurface
    ? 'border-[var(--color-atics-gold)] bg-white/10 text-white'
    : 'border-[color:var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-[color:var(--ui-accent)]'

  const choose = (next: AppLocale) => {
    if (next === locale) return
    void setLocale(next)
    if (supabase && user) {
      void supabase.rpc('set_profile_locale', { p_locale: next })
    }
  }

  return (
    <div>
      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${darkSurface ? 'text-white/70' : 'text-neutral-500'}`}
      >
        {t('shell.language')}
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label={t('shell.language')}>
        {APP_LOCALES.map((code) => {
          const selected = code === locale
          return (
            <Button
              key={code}
              variant="ghost"
              onClick={() => choose(code)}
              role="radio"
              aria-checked={selected}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-transparent ${
                selected ? active : inactive
              }`}
            >
              {LOCALE_LABELS[code]}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function LayoutModeInline({
  navMode,
  onChange,
  darkSurface,
}: {
  navMode: NavMode
  onChange: (m: NavMode) => void
  darkSurface: boolean
}) {
  const { t } = useT()
  const inactive = darkSurface
    ? 'border-white/20 text-white/70 hover:border-white/35 hover:text-white'
    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
  const active = darkSurface
    ? 'border-[var(--color-atics-gold)] bg-white/10 text-white'
    : 'border-[color:var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-[color:var(--ui-accent)]'
  return (
    <div>
      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${darkSurface ? 'text-white/55' : 'text-neutral-500'}`}
      >
        {t('shell.header.navLayout')}
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label={t('shell.header.navLayout')}>
        <Button
          variant="ghost"
          onClick={() => onChange('topbar')}
          role="radio"
          aria-checked={navMode === 'topbar'}
          className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors hover:bg-transparent ${
            navMode === 'topbar' ? active : inactive
          }`}
        >
          <span className="flex flex-col gap-0.5">
            <span className="block h-1.5 w-8 rounded-sm bg-current opacity-80" />
            <span className="block h-1 w-8 rounded-sm bg-current opacity-40" />
            <span className="block h-6 w-8 rounded-sm border border-current opacity-30" />
          </span>
          {t('shell.header.navLayoutTopbar')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => onChange('sidebar')}
          role="radio"
          aria-checked={navMode === 'sidebar'}
          className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors hover:bg-transparent ${
            navMode === 'sidebar' ? active : inactive
          }`}
        >
          <span className="flex gap-0.5">
            <span className="block h-8 w-2 rounded-sm bg-current opacity-80" />
            <span className="block h-8 w-6 rounded-sm border border-current opacity-30" />
          </span>
          {t('shell.header.navLayoutSidebar')}
        </Button>
      </div>
    </div>
  )
}

export function ShellProfileMenuButton({
  variant,
  displayName,
  email,
  profileTo,
  navMode,
  onNavModeChange,
  onSignOut,
  logInHref,
  logInLabel,
  logOutLabel,
  settingsAria,
  showAuth,
  isLoggedIn,
}: ProfileMenuProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))
  const dark = variant === 'topbar'

  const btnClass =
    variant === 'topbar'
      ? `rounded-lg p-2 transition-colors hover:bg-white/10 ${open ? 'bg-white/15' : ''}`
      : `rounded-lg p-1.5 text-neutral-600 hover:bg-black/5 hover:text-neutral-900 ${open ? 'bg-black/5 ring-1 ring-[color-mix(in_srgb,var(--color-atics-gold)_40%,transparent)]' : ''}`

  const panelClass = dark
    ? 'absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/15 bg-[var(--ui-overlay-dark)] p-4 shadow-xl'
    : 'absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl'

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className={`h-auto w-auto ${btnClass}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={displayName || email || settingsAria}
        aria-label={settingsAria}
      >
        <User className={variant === 'topbar' ? 'size-5' : 'size-4'} />
      </Button>
      {open && (
        <div className={panelClass} role="dialog" aria-label={t('shell.header.userAndSettings')}>
          {isLoggedIn ? (
            <div className={`mb-3 border-b pb-3 ${dark ? 'border-white/10' : 'border-neutral-200'}`}>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>
                {displayName || t('shell.header.userFallback')}
              </p>
              {email ? (
                <p className={`mt-0.5 truncate text-xs ${dark ? 'text-white/60' : 'text-neutral-500'}`}>{email}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4">
            <LanguageInline darkSurface={dark} />
            <LayoutModeInline navMode={navMode} onChange={onNavModeChange} darkSurface={dark} />
            <Link
              to={profileTo}
              onClick={() => setOpen(false)}
              className={`block rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
                dark
                  ? 'border-white/20 text-white hover:bg-white/10'
                  : 'border-neutral-200 text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              {t('shell.header.profileAndAccount')}
            </Link>
            {showAuth ? (
              isLoggedIn ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false)
                    void onSignOut()
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  {logOutLabel}
                </Button>
              ) : (
                <a
                  href={logInHref}
                  onClick={() => setOpen(false)}
                  className={`block w-full rounded-lg px-3 py-2 text-center text-sm font-medium ${
                    dark ? 'bg-[var(--color-atics-gold)] text-[color:var(--color-atics-green-deep)] hover:brightness-110' : 'bg-[color:var(--ui-accent)] text-white hover:opacity-95'
                  }`}
                >
                  {logInLabel}
                </a>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export function ShellCompanyBlock({
  name,
  variant,
}: {
  name: string
  variant: 'sidebar' | 'topbar'
}) {
  if (!name) return null
  const text = variant === 'topbar' ? 'text-sm font-medium text-white/90' : 'text-sm font-medium text-neutral-800'
  const icon = variant === 'topbar' ? 'text-white/80' : 'text-[color:var(--ui-accent)]'
  return (
    <div className={`flex min-w-0 max-w-[200px] items-center gap-2 sm:max-w-[260px] ${variant === 'topbar' ? '' : ''}`}>
      <Building2 className={`size-5 shrink-0 ${icon}`} aria-hidden />
      <span className={`min-w-0 truncate ${text}`} title={name}>
        {name}
      </span>
    </div>
  )
}

export function ShellQuickCreateMenu({ variant }: { variant: 'sidebar' | 'topbar' }) {
  const { t } = useT()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))

  const btnBase =
    variant === 'topbar'
      ? 'inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/20 hover:bg-white/18'
      : 'inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50'

  const panelClass =
    variant === 'topbar'
      ? 'absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/15 bg-[var(--ui-overlay-dark)] py-1 shadow-xl'
      : 'absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-neutral-200 bg-white py-1 shadow-xl'

  const itemClass =
    variant === 'topbar'
      ? 'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10'
      : 'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50'

  const go = (to: string) => {
    setOpen(false)
    nav(to)
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" className={btnBase} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="size-4" />
        {t('shell.header.quickCreate')}
        <ChevronDown className="size-3.5 opacity-70" />
      </Button>
      {open ? (
        <div className={panelClass} role="menu">
          <Button variant="ghost" role="menuitem" className={`${itemClass} justify-start font-normal`} onClick={() => go('/tasks/management?quickNew=task')}>
            <ClipboardList className="size-4 shrink-0 opacity-80" />
            {t('shell.header.newTask')}
          </Button>
          <Button variant="ghost" role="menuitem" className={`${itemClass} justify-start font-normal`} onClick={() => go('/tasks/management?tab=varsling')}>
            <Megaphone className="size-4 shrink-0 opacity-80" />
            {t('shell.header.newAlert')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type GapSection = {
  id: string
  title: string
  items: { label: string; to?: string }[]
}

export function ShellComplianceIndicator({ variant }: { variant: 'sidebar' | 'topbar' }) {
  const { t } = useT()
  const ts = useTaskItemsData()
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const { level, sections } = useMemo(() => {
    const sectionsAcc: GapSection[] = []

    const overdueTasks = ts.items.filter((x) => x.status !== 'closed' && x.status !== 'cancelled' && x.dueDate && x.dueDate < today)
    if (overdueTasks.length) {
      sectionsAcc.push({
        id: 'tasks',
        title: t('shell.header.tasksSection'),
        items: [
          {
            label: t('shell.header.overdueTasks', { count: overdueTasks.length }),
            to: '/tasks/management',
          },
        ],
      })
    }

    let level: 'green' | 'yellow' | 'red' = 'green'
    if (sectionsAcc.length > 0) level = 'yellow'

    return { level, sections: sectionsAcc }
  }, [ts.items, today, t])

  const dotClass =
    level === 'green'
      ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]'
      : level === 'yellow'
        ? 'bg-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.4)]'
        : 'bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.35)]'

  const btnClass =
    variant === 'topbar'
      ? `relative rounded-lg p-2 transition-colors hover:bg-white/10 ${open ? 'bg-white/15' : ''}`
      : `relative rounded-lg p-1.5 text-neutral-600 hover:bg-black/5 ${open ? 'bg-black/5' : ''}`

  const panelClass =
    variant === 'topbar'
      ? 'absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-white/15 bg-[var(--ui-overlay-dark)] p-4 shadow-xl'
      : 'absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-xl'

  const heading = variant === 'topbar' ? 'text-white' : 'text-neutral-900'
  const sub = variant === 'topbar' ? 'text-white/55' : 'text-neutral-500'
  const sectionTitle = variant === 'topbar' ? 'text-white/80' : 'text-neutral-700'
  const linkClass = variant === 'topbar' ? 'text-sky-300 hover:text-sky-200' : 'text-[color:var(--ui-accent)] hover:underline'

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className={`h-auto w-auto ${btnClass}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={t('shell.header.complianceOpenDetails')}
        aria-label={t('shell.header.complianceOverview')}
      >
        <ShieldAlert className={variant === 'topbar' ? 'size-5' : 'size-4'} />
        <span className={`absolute right-1 top-1 size-2 rounded-full ${dotClass}`} aria-hidden />
      </Button>
      {open ? (
        <div className={panelClass} role="dialog" aria-label={t('shell.header.compliance')}>
          <h3 className={`text-sm font-semibold ${heading}`}>{t('shell.header.compliance')}</h3>
          <p className={`mt-1 text-xs ${sub}`}>
            {level === 'green'
              ? t('shell.header.complianceGreen')
              : t('shell.header.complianceYellow')}
          </p>
          {sections.length === 0 ? (
            <p className={`mt-4 text-sm ${variant === 'topbar' ? 'text-white/70' : 'text-neutral-600'}`}>
              {t('shell.header.complianceEmpty')}
            </p>
          ) : (
            <ul className={`mt-4 space-y-4 ${sub} text-xs`}>
              {sections.map((sec) => (
                <li key={sec.id}>
                  <p className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide ${sectionTitle}`}>{sec.title}</p>
                  <ul className="space-y-1.5">
                    {sec.items.map((it, i) => (
                      <li key={`${sec.id}-${i}`}>
                        {it.to ? (
                          <Link to={it.to} className={linkClass} onClick={() => setOpen(false)}>
                            {it.label}
                          </Link>
                        ) : (
                          <span className={variant === 'topbar' ? 'text-white/75' : 'text-neutral-700'}>{it.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className={`mt-4 border-t pt-3 text-[10px] ${sub}`}>
            {t('shell.header.complianceDisclaimer')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
