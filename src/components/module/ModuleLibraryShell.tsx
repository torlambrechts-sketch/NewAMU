// ModuleLibraryShell — shared chrome for module library pages.
//
// Owns: sticky header (eyebrow, serif h1, subtitle, optional lens-segmented
// control, optional settings button), persistent tab row (Analyse always
// first, module-specific tabs, optional Katalog tab, primary CTA slot), and
// the body-switching logic between library / katalog / analyse / full-detail
// view modes.
//
// Everything else is a render slot — the shell is chrome-only.
// First consumers: compliance/checklists, meetings (Step 3), survey (Step 4).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, LayoutList, Wrench } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

// Exported so module pages can use the same serif constant for sub-headings,
// context cards, etc. without re-defining it locally.
export const SERIF = "'Libre Baskerville', 'Source Serif 4', Georgia, serif"

export type ViewMode = 'library' | 'katalog' | 'analyse'

export type ModuleLibraryTab = {
  id: string
  label: string
  /** Displayed next to the label in muted text. */
  count?: number
  /** Render label in SERIF font (e.g. Lovverk pack names). */
  serifLabel?: boolean
}

export type ModuleLibraryLenses = {
  items: { id: string; label: string; icon: ComponentType<{ className?: string }> }[]
  value: string
  /**
   * Called when the user clicks a lens button. The shell resets viewMode to
   * 'library' automatically after calling this — callers must not do it
   * themselves. If the lens ever needs to change programmatically (deep-link,
   * effect), call onChange AND handle any external view state separately,
   * because only the shell's button onClick pairs the two actions.
   */
  onChange: (id: string) => void
}

/** When set, replaces the library/katalog body with full-width detail content. */
export type DetailFullView = {
  title: string
  content: ReactNode
  actions?: ReactNode
  onClose: () => void
}

export type ModuleLibraryShellProps = {
  // ── Header ──────────────────────────────────────────────────────────────
  eyebrow: string
  title: string
  subtitle: string
  /** Hex colour used for active tab underline and active lens highlight. */
  accentColor?: string

  // ── Header right chrome ──────────────────────────────────────────────────
  /** Segmented lens control. Omit for modules with no lens dimension. */
  lenses?: ModuleLibraryLenses
  /** Route for the settings wrench button. Omit to hide the button. */
  settingsTo?: string
  /** Extra nodes injected between the lens control and the settings button. */
  headerExtra?: ReactNode

  // ── Tab row ─────────────────────────────────────────────────────────────
  /** Module-specific tabs. Analyse is always prepended by the shell. */
  tabs: ModuleLibraryTab[]
  activeTab: string | null
  onTabChange: (tabId: string) => void
  /** Node placed at the far right of the tab row (e.g. primary CTA button). */
  tabRowAction?: ReactNode

  // ── Body view slots ──────────────────────────────────────────────────────
  libraryView: ReactNode
  /** Presence of this prop adds a Katalog tab. */
  katalogView?: ReactNode
  analyseView: ReactNode
  /** Panels rendered alongside analyse (add/edit widget side-panels). */
  analyseEditPanels?: ReactNode

  // ── Detail pane ──────────────────────────────────────────────────────────
  /** Open <SlidePanel /> or null. Rendered outside the body flow as an overlay. */
  detailPanel?: ReactNode
  /** When non-null, replaces the library/katalog body with full-width detail. */
  detailFullView?: DetailFullView | null
}

export function ModuleLibraryShell({
  eyebrow,
  title,
  subtitle,
  accentColor = '#1a3d32',
  lenses,
  settingsTo,
  headerExtra,
  tabs,
  activeTab,
  onTabChange,
  tabRowAction,
  libraryView,
  katalogView,
  analyseView,
  analyseEditPanels,
  detailPanel,
  detailFullView,
}: ModuleLibraryShellProps) {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('library')

  const isFullView = Boolean(detailFullView)
  const showAnalyse = viewMode === 'analyse'
  const showLibrary = viewMode === 'library' && !isFullView
  const showKatalog = viewMode === 'katalog' && !isFullView

  function tabCls(active: boolean) {
    return (
      'flex shrink-0 items-center gap-1.5 border-b-2 px-[18px] py-2.5 text-[13px] ' +
      'whitespace-nowrap transition-colors ' +
      (active
        ? 'text-neutral-900'
        : 'border-transparent text-neutral-600 hover:border-neutral-200 hover:text-neutral-700')
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F9F7F2]">
      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex-shrink-0 border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-10 pb-0 pt-6">

          {/* Title + right controls */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                {eyebrow}
              </p>
              <h1
                className="text-3xl font-bold leading-tight text-neutral-900"
                style={{ fontFamily: SERIF }}
              >
                {title}
              </h1>
              <p className="mt-1 text-[13px] text-neutral-600">{subtitle}</p>
            </div>

            <div className="mt-1 flex shrink-0 items-center gap-2">
              {/* Lens segmented control */}
              {lenses && (
                <div className="inline-flex rounded-lg bg-neutral-100 p-[3px] gap-0.5">
                  {lenses.items.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { lenses.onChange(m.id); setViewMode('library') }}
                      className={
                        'inline-flex items-center gap-1.5 rounded-md px-3.5 py-[7px] text-xs font-semibold transition-all ' +
                        (lenses.value === m.id && viewMode === 'library'
                          ? 'bg-white text-neutral-900 shadow-sm'
                          : 'text-neutral-600 hover:text-neutral-800')
                      }
                    >
                      <m.icon className="h-3.5 w-3.5" />
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              {headerExtra}

              {settingsTo && (
                <button
                  onClick={() => navigate(settingsTo)}
                  title="Innstillinger"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
                >
                  <Wrench className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tab row */}
          <div className="mt-4 flex items-end justify-between gap-2">
            <div className="flex gap-0 overflow-x-auto">
              {/* Analyse — always first */}
              <button
                onClick={() => setViewMode(viewMode === 'analyse' ? 'library' : 'analyse')}
                className={tabCls(viewMode === 'analyse')}
                style={viewMode === 'analyse' ? { borderColor: accentColor } : undefined}
              >
                <BarChart3 className="h-3.5 w-3.5 opacity-70" />
                <span style={{ fontWeight: 700 }}>Analyse</span>
              </button>

              {/* Module-specific tabs */}
              {tabs.map((tab) => {
                const active = viewMode === 'library' && activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => { onTabChange(tab.id); setViewMode('library') }}
                    className={tabCls(active)}
                    style={active ? { borderColor: accentColor } : undefined}
                  >
                    <span
                      style={{
                        fontFamily: tab.serifLabel ? SERIF : undefined,
                        fontWeight: 700,
                      }}
                    >
                      {tab.label}
                    </span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="ml-2 tabular-nums text-[12px] text-neutral-500">
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Katalog — present only when katalogView slot is provided */}
              {katalogView !== undefined && (
                <button
                  onClick={() => setViewMode(viewMode === 'katalog' ? 'library' : 'katalog')}
                  className={tabCls(viewMode === 'katalog')}
                  style={viewMode === 'katalog' ? { borderColor: accentColor } : undefined}
                >
                  <LayoutList className="h-3.5 w-3.5 opacity-70" />
                  <span style={{ fontWeight: 700 }}>Katalog</span>
                </button>
              )}
            </div>

            {tabRowAction !== undefined && (
              <div className="shrink-0 pb-1.5">{tabRowAction}</div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}

      {/* Analyse view */}
      {showAnalyse && (
        <>
          {analyseView}
          {analyseEditPanels}
        </>
      )}

      {/* Full-detail view — overrides library / katalog body when set */}
      {isFullView && detailFullView && (
        <div className="mx-auto w-full max-w-[1400px] px-10 py-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={detailFullView.onClose}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Tilbake til panel
              </button>
              {detailFullView.title && (
                <>
                  <span className="text-neutral-300">|</span>
                  <span
                    className="text-[17px] font-semibold text-neutral-900"
                    style={{ fontFamily: SERIF }}
                  >
                    {detailFullView.title}
                  </span>
                </>
              )}
            </div>
            {detailFullView.actions && (
              <div className="flex items-center gap-2">{detailFullView.actions}</div>
            )}
          </div>
          {detailFullView.content}
        </div>
      )}

      {/* Library view */}
      {showLibrary && libraryView}

      {/* Katalog view */}
      {showKatalog && katalogView}

      {/* Overlay (SlidePanel etc.) — rendered outside body flow */}
      {detailPanel}
    </div>
  )
}
