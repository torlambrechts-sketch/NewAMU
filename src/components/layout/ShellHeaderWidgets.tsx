import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ClipboardList,
  FileWarning,
  Megaphone,
  Plus,
  ShieldAlert,
  User,
} from 'lucide-react'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { useCouncil } from '../../hooks/useCouncil'
import { useHse } from '../../hooks/useHse'
import { useInternalControl } from '../../hooks/useInternalControl'
import { useTasks } from '../../hooks/useTasks'
import type { NavMode } from './aticsNavMode'

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

function LayoutModeInline({
  navMode,
  onChange,
  darkSurface,
}: {
  navMode: NavMode
  onChange: (m: NavMode) => void
  darkSurface: boolean
}) {
  const inactive = darkSurface
    ? 'border-white/20 text-white/70 hover:border-white/35 hover:text-white'
    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
  const active = darkSurface
    ? 'border-[#c9a227] bg-white/10 text-white'
    : 'border-[color:var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-[color:var(--ui-accent)]'
  return (
    <div>
      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${darkSurface ? 'text-white/55' : 'text-neutral-500'}`}
      >
        Navigasjonslayout
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('topbar')}
          className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
            navMode === 'topbar' ? active : inactive
          }`}
        >
          <span className="flex flex-col gap-0.5">
            <span className="block h-1.5 w-8 rounded-sm bg-current opacity-80" />
            <span className="block h-1 w-8 rounded-sm bg-current opacity-40" />
            <span className="block h-6 w-8 rounded-sm border border-current opacity-30" />
          </span>
          Toppmeny
        </button>
        <button
          type="button"
          onClick={() => onChange('sidebar')}
          className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
            navMode === 'sidebar' ? active : inactive
          }`}
        >
          <span className="flex gap-0.5">
            <span className="block h-8 w-2 rounded-sm bg-current opacity-80" />
            <span className="block h-8 w-6 rounded-sm border border-current opacity-30" />
          </span>
          Sidemeny
        </button>
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
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))
  const dark = variant === 'topbar'

  const btnClass =
    variant === 'topbar'
      ? `rounded-lg p-2 transition-colors hover:bg-white/10 ${open ? 'bg-white/15' : ''}`
      : `rounded-lg p-1.5 text-neutral-600 hover:bg-black/5 hover:text-neutral-900 ${open ? 'bg-black/5 ring-1 ring-[#c9a227]/40' : ''}`

  const panelClass = dark
    ? 'absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/15 bg-[#1f2a26] p-4 shadow-xl'
    : 'absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={btnClass}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={displayName || email || settingsAria}
        aria-label={settingsAria}
      >
        <User className={variant === 'topbar' ? 'size-5' : 'size-4'} />
      </button>
      {open && (
        <div className={panelClass} role="dialog" aria-label="Bruker og innstillinger">
          {isLoggedIn ? (
            <div className={`mb-3 border-b pb-3 ${dark ? 'border-white/10' : 'border-neutral-200'}`}>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>
                {displayName || 'Bruker'}
              </p>
              {email ? (
                <p className={`mt-0.5 truncate text-xs ${dark ? 'text-white/60' : 'text-neutral-500'}`}>{email}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <LanguageSwitcher
                className={
                  dark
                    ? '[&_span]:text-white/70 [&_select]:border-white/25 [&_select]:bg-white/10 [&_select]:text-white'
                    : '[&_span]:text-neutral-600 [&_select]:max-w-[12rem] [&_select]:border-neutral-300 [&_select]:bg-white [&_select]:text-neutral-900'
                }
              />
            </div>
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
              Profil og konto
            </Link>
            {showAuth ? (
              isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    void onSignOut()
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  {logOutLabel}
                </button>
              ) : (
                <a
                  href={logInHref}
                  onClick={() => setOpen(false)}
                  className={`block w-full rounded-lg px-3 py-2 text-center text-sm font-medium ${
                    dark ? 'bg-[#c9a227] text-[#1a2e28] hover:brightness-110' : 'bg-[color:var(--ui-accent)] text-white hover:opacity-95'
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
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))

  const btnBase =
    variant === 'topbar'
      ? 'inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/20 hover:bg-white/18'
      : 'inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50'

  const panelClass =
    variant === 'topbar'
      ? 'absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/15 bg-[#1f2a26] py-1 shadow-xl'
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
      <button type="button" className={btnBase} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="size-4" />
        Nytt
        <ChevronDown className="size-3.5 opacity-70" />
      </button>
      {open ? (
        <div className={panelClass} role="menu">
          <button type="button" role="menuitem" className={itemClass} onClick={() => go('/tasks?quickNew=task')}>
            <ClipboardList className="size-4 shrink-0 opacity-80" />
            Ny oppgave
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => go('/tasks?view=whistle&openWhistle=1')}>
            <Megaphone className="size-4 shrink-0 opacity-80" />
            Ny varslingssak
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => go('/workplace-reporting?newCase=1')}
          >
            <FileWarning className="size-4 shrink-0 opacity-80" />
            Ny arbeidsplass-sak
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => go('/workplace-reporting/incidents?new=1')}
          >
            <AlertTriangle className="size-4 shrink-0 opacity-80" />
            Ny hendelse (HSE)
          </button>
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
  const council = useCouncil()
  const hse = useHse()
  const ic = useInternalControl()
  const ts = useTasks()
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const year = useMemo(() => new Date().getFullYear(), [])

  const { level, sections } = useMemo(() => {
    const sectionsAcc: GapSection[] = []

    const councilOpen = council.compliance.filter((c) => !c.done)
    if (councilOpen.length) {
      sectionsAcc.push({
        id: 'council',
        title: 'AMU / krav og vedtak',
        items: councilOpen.slice(0, 6).map((c) => ({
          label: c.title,
          to: '/council?tab=requirements',
        })),
      })
    }

    const rosRed = ic.rosAssessments.flatMap((r) =>
      r.rows
        .filter((row) => {
          const st = row.status ?? 'draft'
          if (row.done || st === 'finished' || st === 'closed' || st === 'cancelled') return false
          const rs = row.residualScore ?? row.riskScore
          return rs >= 12
        })
        .map((row) => ({
          label: `${r.title}: ${row.activity}`,
          to: '/internal-control?tab=ros',
        })),
    )
    if (rosRed.length) {
      sectionsAcc.push({
        id: 'ros',
        title: 'ROS (høy / rød restrisiko)',
        items: rosRed.slice(0, 8),
      })
    }

    const annualDraft = ic.annualReviews.filter(
      (a) => a.year === year && a.status !== 'locked' && !a.locked,
    )
    if (annualDraft.length) {
      sectionsAcc.push({
        id: 'annual',
        title: 'Årsgjennomgang',
        items: annualDraft.map((a) => ({
          label: `År ${a.year} — ikke låst / ferdig`,
          to: '/internal-control?tab=annual',
        })),
      })
    }

    const hseItems: { label: string; to?: string }[] = []
    if (hse.stats.expiredTraining > 0) {
      hseItems.push({
        label: `${hse.stats.expiredTraining} opplæringsregistrering(er) utløpt`,
        to: '/hse?tab=training',
      })
    }
    if (hse.stats.overdueMilestones > 0) {
      hseItems.push({
        label: `${hse.stats.overdueMilestones} NAV-milepæl(er) forfalt`,
        to: '/hse?tab=sickness',
      })
    }
    if (hse.stats.openInspections > 0) {
      hseItems.push({
        label: `${hse.stats.openInspections} åpne inspeksjon(er)`,
        to: '/hse?tab=inspections',
      })
    }
    if (hse.stats.openSja > 0) {
      hseItems.push({
        label: `${hse.stats.openSja} SJA i utkast / avventer`,
        to: '/hse?tab=sja',
      })
    }
    if (hseItems.length) {
      sectionsAcc.push({ id: 'hse', title: 'HMS', items: hseItems })
    }

    const overdueTasks = ts.tasks.filter((x) => x.status !== 'done' && x.dueDate && x.dueDate < today)
    if (overdueTasks.length) {
      sectionsAcc.push({
        id: 'tasks',
        title: 'Oppgaver',
        items: [
          {
            label: `${overdueTasks.length} forfalte oppgave(r)`,
            to: '/tasks?view=list',
          },
        ],
      })
    }

    const criticalIncident = hse.incidents.filter((i) => i.status !== 'closed' && i.severity === 'critical').length
    if (criticalIncident > 0) {
      sectionsAcc.push({
        id: 'incidents',
        title: 'Hendelser',
        items: [
          {
            label: `${criticalIncident} kritisk(e) hendelse(r) ikke lukket`,
            to: '/workplace-reporting/incidents',
          },
        ],
      })
    }

    let level: 'green' | 'yellow' | 'red' = 'green'
    if (sectionsAcc.some((s) => s.id === 'ros' || s.id === 'incidents')) level = 'red'
    else if (sectionsAcc.length > 0) level = 'yellow'

    return { level, sections: sectionsAcc }
  }, [council.compliance, hse.stats, hse.incidents, ic.rosAssessments, ic.annualReviews, ts.tasks, today, year])

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
      ? 'absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-white/15 bg-[#1f2a26] p-4 shadow-xl'
      : 'absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-xl'

  const heading = variant === 'topbar' ? 'text-white' : 'text-neutral-900'
  const sub = variant === 'topbar' ? 'text-white/55' : 'text-neutral-500'
  const sectionTitle = variant === 'topbar' ? 'text-white/80' : 'text-neutral-700'
  const linkClass = variant === 'topbar' ? 'text-sky-300 hover:text-sky-200' : 'text-[color:var(--ui-accent)] hover:underline'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={btnClass}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Samsvar — åpne detaljer"
        aria-label="Samsvarsoversikt"
      >
        <ShieldAlert className={variant === 'topbar' ? 'size-5' : 'size-4'} />
        <span className={`absolute right-1 top-1 size-2 rounded-full ${dotClass}`} aria-hidden />
      </button>
      {open ? (
        <div className={panelClass} role="dialog" aria-label="Samsvar">
          <h3 className={`text-sm font-semibold ${heading}`}>Samsvar</h3>
          <p className={`mt-1 text-xs ${sub}`}>
            {level === 'green' && 'Ingen åpen avvik registrert i disse sporene.'}
            {level === 'yellow' && 'Det finnes punkter som bør følges opp (se under).'}
            {level === 'red' && 'Kritiske HMS-/ROS- eller hendelsesavvik krever oppfølging.'}
          </p>
          {sections.length === 0 ? (
            <p className={`mt-4 text-sm ${variant === 'topbar' ? 'text-white/70' : 'text-neutral-600'}`}>
              Alt ser bra ut i oversikten akkurat nå.
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
            Oversikten er veiledende og bygger på data i appen (ikke juridisk vurdering).
          </p>
        </div>
      ) : null}
    </div>
  )
}
