// Full-bleed Studio chrome shared by every module editor (workflow, survey, checklist, …).
// Provides: sticky 56px top bar, loading/error states, three-panel body layout.
// Each editor supplies: palette (240px), canvas (flex-1 via children), inspector (340px).
// DnD contexts (if needed) live in the editor page, wrapping this component.

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2, PanelRight } from 'lucide-react'

// ─── Brand mark ──────────────────────────────────────────────────────────────

export function KMark() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span
        className="flex items-center justify-center rounded-md"
        style={{
          width: 28, height: 28,
          background: 'var(--forest, #1a3d32)',
          color: '#fff',
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: 17,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        K
      </span>
      <span className="hidden md:inline-flex items-baseline gap-1 leading-none">
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600 }}>
          Klarert
        </span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 400, color: '#737373' }}>
          Studio
        </span>
      </span>
    </div>
  )
}

// ─── Mode pill ────────────────────────────────────────────────────────────────

export function ModePill({ mode, onChange }: {
  mode: 'simple' | 'advanced'
  onChange: (m: 'simple' | 'advanced') => void
}) {
  return (
    <div className="k-mode-pill" role="group" aria-label="Studio modus">
      <button
        type="button"
        className={mode === 'simple' ? 'is-active' : ''}
        onClick={() => onChange('simple')}
        aria-pressed={mode === 'simple'}
        title="Skjul avanserte paneler"
      >
        <span className="k-mode-dot" aria-hidden="true" />
        Enkel
      </button>
      <button
        type="button"
        className={mode === 'advanced' ? 'is-active' : ''}
        onClick={() => onChange('advanced')}
        aria-pressed={mode === 'advanced'}
        title="Vis alt — palett, regelverk, versjoner, stil"
      >
        <span className="k-mode-dot" aria-hidden="true" />
        Avansert
      </button>
    </div>
  )
}

// ─── Save indicator ───────────────────────────────────────────────────────────

export function SaveStatus({ status, saveError }: { status: string; saveError: string | null }) {
  if (status === 'saving') {
    return (
      <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Lagrer…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span role="alert" aria-live="assertive" className="text-[11px] text-red-500" title={saveError ?? undefined}>
        Lagring feilet
      </span>
    )
  }
  if (status === 'idle') return null
  // saved — show pulse dot
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
      <span className="h-1.5 w-1.5 rounded-full k-pulse" style={{ background: '#2f7757' }} aria-hidden="true" />
      Auto-lagret
    </span>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export type StudioShellProps = {
  /** Second-level breadcrumb label, e.g. "Spørreundersøkelser" */
  moduleLabel: string
  /** href for the second-level breadcrumb */
  moduleHref: string

  /** Current document title (controlled) */
  title: string
  /** Called when user edits the title inline; omit to make title read-only */
  onTitleChange?: (v: string) => void
  titlePlaceholder?: string

  /** Simple/Advanced mode pill; omit both to hide the pill */
  mode?: 'simple' | 'advanced'
  onModeChange?: (m: 'simple' | 'advanced') => void

  /** Inspector (right-rail) toggle */
  showInspector?: boolean
  onToggleInspector?: () => void

  /** Loading/error gate — shows spinner or error instead of body */
  loading?: boolean
  loadError?: string | null
  loadErrorBackLabel?: string

  /** Top-bar save state */
  saveStatus?: string
  saveError?: string | null
  /** When true: top-bar title is uneditable; save status hidden */
  readOnly?: boolean

  /** Extra action buttons on the right of the top bar */
  actions?: ReactNode

  /** Alert banners rendered below the top bar, above the body */
  banners?: ReactNode

  /** Left 240px palette panel. Pass null/undefined to hide. */
  palette?: ReactNode

  /** Right 340px inspector panel. Pass null/undefined to hide. */
  inspector?: ReactNode

  /** Canvas = flex-1 center area */
  children: ReactNode
}

export function KlarertStudioShell({
  moduleLabel,
  moduleHref,
  title,
  onTitleChange,
  titlePlaceholder = 'Ny mal',
  mode,
  onModeChange,
  showInspector,
  onToggleInspector,
  loading,
  loadError,
  loadErrorBackLabel = '← Tilbake',
  saveStatus,
  saveError,
  readOnly,
  actions,
  banners,
  palette,
  inspector,
  children,
}: StudioShellProps) {
  const navigate = useNavigate()

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2]" role="status" aria-label="Laster…">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden="true" />
        <span className="sr-only">Laster…</span>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F7F2]">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold text-neutral-700">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate(moduleHref)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          {loadErrorBackLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="studio-root">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="studio-top">
        <KMark />
        <span className="hidden sm:inline-block h-5 w-px bg-neutral-300/70" />

        {/* Breadcrumb + title */}
        <nav aria-label="Brødsmule" className="flex items-center gap-1.5 text-[12.5px] min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="hidden md:inline text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
          >
            Studio-hjem
          </button>
          <span className="hidden md:inline text-neutral-300" aria-hidden="true">›</span>
          <button
            type="button"
            onClick={() => navigate(moduleHref)}
            className="hidden lg:inline text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
          >
            {moduleLabel}
          </button>
          <span className="hidden lg:inline text-neutral-300" aria-hidden="true">›</span>

          {readOnly || !onTitleChange ? (
            <span
              className="font-semibold text-neutral-800 truncate max-w-[260px]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {title || titlePlaceholder}
            </span>
          ) : (
            <input
              aria-label="Malnavn"
              className="k-title-input min-w-0"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={titlePlaceholder}
              spellCheck={false}
            />
          )}
        </nav>

        {/* Mode pill */}
        {mode !== undefined && onModeChange && (
          <ModePill mode={mode} onChange={onModeChange} />
        )}

        <div className="flex-1 hidden md:block" />

        {/* Save status */}
        {!readOnly && saveStatus && (
          <SaveStatus status={saveStatus} saveError={saveError ?? null} />
        )}

        <span className="hidden md:inline-block h-5 w-px bg-neutral-300/70" />

        {/* Inspector toggle */}
        {onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={`rounded-md p-1.5 transition-colors ${showInspector ? 'text-[#1a3d32] bg-[#e7efe9]' : 'text-neutral-500 hover:bg-neutral-100'}`}
            title={showInspector ? 'Skjul inspektør' : 'Vis inspektør'}
            aria-label={showInspector ? 'Skjul inspektør' : 'Vis inspektør'}
            aria-pressed={showInspector}
          >
            <PanelRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {/* Extra top-bar actions */}
        {actions}
      </header>

      {/* ── Alert banners ───────────────────────────────────────────────────── */}
      {banners && (
        <div className="px-4 pt-2 space-y-1.5">
          {banners}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="studio-body" style={{ height: 'calc(100vh - 56px)' }}>
        {palette}
        {children}
        {inspector}
      </div>

    </div>
  )
}
