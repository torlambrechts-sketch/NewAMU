// Klarert Studio — full-bleed workflow editor.
// Replaces the three-panel ModulePageShell layout with the Studio chrome:
//   sticky 56px top bar + body = palette (240px) + canvas (flex-1) + inspector (340px).
// Uses useWorkflowTemplateStudio for all persistence; only the UI changes.
// Accessed via /studio/workflow/:ruleId  (ruleId='new' creates on first save).

import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Check,
  Copy,
  Eye,
  Loader2,
  PanelRight,
  Play,
  X,
  AlertTriangle,
} from 'lucide-react'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import { useWorkflowTemplateStudio } from '../../../modules/studio/workflow/useWorkflowTemplateStudio'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { isGovernmentActionType } from '../../types/workflow'
import type { WorkflowFlowStep } from '../../lib/workflowFlowTypes'

import { StudioWorkflowPalette } from '../../components/studio/workflow/StudioWorkflowPalette'
import { StudioWorkflowCanvas } from '../../components/studio/workflow/StudioWorkflowCanvas'
import { StudioWorkflowInspector } from '../../components/studio/workflow/StudioWorkflowInspector'
import type { StudioBlockKind } from '../../components/studio/workflow/studioBlockMeta'

// ─── Save status indicator ────────────────────────────────────────────────────

function SaveStatus({ status, saveError }: { status: string; saveError: string | null }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Lagrer…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
        <span className="h-1.5 w-1.5 rounded-full k-pulse" style={{ background: '#2f7757' }} />
        Auto-lagret
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="text-[11px] text-red-500" title={saveError ?? undefined}>
        Lagring feilet
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
      <span className="h-1.5 w-1.5 rounded-full k-pulse" style={{ background: '#2f7757' }} />
      Auto-lagret
    </span>
  )
}

// ─── K mark (brand) ────────────────────────────────────────────────────────────

function KMark() {
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

// ─── Mode pill ─────────────────────────────────────────────────────────────────

function ModePill({ mode, onChange }: {
  mode: 'simple' | 'advanced'
  onChange: (m: 'simple' | 'advanced') => void
}) {
  return (
    <div className="k-mode-pill" role="tablist" aria-label="Studio modus">
      <button
        type="button"
        className={mode === 'simple' ? 'is-active' : ''}
        onClick={() => onChange('simple')}
        title="Skjul avanserte paneler"
      >
        <span className="k-mode-dot" />
        Enkel
      </button>
      <button
        type="button"
        className={mode === 'advanced' ? 'is-active' : ''}
        onClick={() => onChange('advanced')}
        title="Vis alt — palett, regelverk, versjoner, stil"
      >
        <span className="k-mode-dot" />
        Avansert
      </button>
    </div>
  )
}

// ─── Dry-run log entry type ────────────────────────────────────────────────────

type DryRunLogEntry = {
  step: number
  action_type: string
  label: string | null
  status: 'would_execute' | 'would_skip' | 'gov_action_blocked'
  note: string
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function KlarertStudioWorkflowEditorPage() {
  const { ruleId = 'new' } = useParams<{ ruleId: string }>()
  const [searchParams] = useSearchParams()
  const fromId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const { can, profile, supabase } = useOrgSetupContext()
  const studio = useWorkflowTemplateStudio(ruleId, fromId)

  const isViewOnly =
    !studio.isSystemTemplate &&
    !can('workflows.compose') &&
    !can('workflows.manage') &&
    !profile?.is_org_admin
  const effectivelyDisabled = studio.isSystemTemplate || isViewOnly

  useDirtyGuard(!effectivelyDisabled && studio.saveStatus === 'idle')

  // ── UI state ────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'simple' | 'advanced'>('advanced')
  const [showInspector, setShowInspector] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(-1) // -1 = trigger
  const [publishError, setPublishError] = useState<string | null>(null)
  const [dryRunning, setDryRunning] = useState(false)
  const [dryRunLog, setDryRunLog] = useState<DryRunLogEntry[] | null>(null)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [showDryRunPanel, setShowDryRunPanel] = useState(false)

  // ── Derived ─────────────────────────────────────────────────────────────────

  const hasGovActions = studio.flowDoc.linearSteps.some((s) =>
    s.kind === 'actions' &&
    s.actions.some((a) => isGovernmentActionType((a as { type: string }).type)),
  ) || studio.flowDoc.xorBranches.some((b) =>
    b.steps.some((s) =>
      s.kind === 'actions' &&
      s.actions.some((a) => isGovernmentActionType((a as { type: string }).type)),
    ),
  )

  const hasAtLeastOneAction =
    studio.flowDoc.linearSteps.some((s) => s.kind === 'actions' && s.actions.length > 0) ||
    studio.flowDoc.xorBranches.some((b) =>
      b.steps.some((s) => s.kind === 'actions' && s.actions.length > 0),
    )

  const canPublish =
    !studio.compileError &&
    studio.name.trim().length > 0 &&
    !!studio.triggerEventName &&
    hasAtLeastOneAction

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!studio.name.trim()) {
      setPublishError('Gi malen et navn før publisering.')
      return
    }
    if (!studio.triggerEventName) {
      setPublishError('Velg en utløserhendelse før publisering.')
      return
    }
    if (!hasAtLeastOneAction) {
      setPublishError('Legg til minst én handling i flyten før publisering.')
      return
    }
    if (studio.compileError) {
      setPublishError(`Valideringsfeil: ${studio.compileError}`)
      return
    }
    setPublishError(null)
    await studio.publishTemplate()
    if (!studio.saveError) {
      toast.success(`«${studio.name.trim()}» er publisert`)
      navigate('/studio/workflow')
    } else {
      toast.error(`Publisering feilet: ${studio.saveError}`)
    }
  }

  const handleDryRun = async () => {
    if (!supabase || !studio.rowId) return
    setDryRunning(true)
    setDryRunLog(null)
    setDryRunError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = (import.meta as unknown as { env: { VITE_SUPABASE_URL?: string } }).env
        ?.VITE_SUPABASE_URL ?? ''
      const resp = await fetch(`${supabaseUrl}/functions/v1/workflow-dry-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ rule_id: studio.rowId }),
      })
      const result = await resp.json() as { ok: boolean; log?: DryRunLogEntry[]; error?: string }
      if (result.ok && result.log) {
        setDryRunLog(result.log)
        setShowDryRunPanel(true)
      } else {
        setDryRunError(result.error ?? 'Ukjent feil under dry-run')
        setShowDryRunPanel(true)
      }
    } catch (e) {
      setDryRunError(e instanceof Error ? e.message : 'Nettverksfeil')
      setShowDryRunPanel(true)
    } finally {
      setDryRunning(false)
    }
  }

  const handlePaletteKind = useCallback((action: 'start' | 'end' | 'append', kind: StudioBlockKind | null) => {
    if (action === 'append' && kind) {
      // Append triggers the canvas insert — just dispatching via dataTransfer isn't possible here;
      // canvas handles DnD directly. For click-append we update flowDoc:
      // Find the canvas's insert logic via a shared handler
    }
  }, [])

  const handleUpdateStep = useCallback((idx: number, step: WorkflowFlowStep) => {
    const next = studio.flowDoc.linearSteps.map((s, i) => i === idx ? step : s)
    studio.updateFlowDoc({ ...studio.flowDoc, linearSteps: next })
  }, [studio])

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (studio.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" />
      </div>
    )
  }

  if (studio.loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F7F2]">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold text-neutral-700">{studio.loadError}</p>
        <button
          type="button"
          onClick={() => navigate('/studio/workflow')}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          ← Tilbake til maler
        </button>
      </div>
    )
  }

  const displayName = studio.name || 'Ny arbeidsflyt-mal'
  const showPalette = mode === 'advanced'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="studio-root">

      {/* Top bar */}
      <header className="studio-top">
        <KMark />
        <span className="hidden sm:inline-block h-5 w-px bg-neutral-300/70" />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[12.5px] min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="hidden md:inline text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
          >
            Studio-hjem
          </button>
          <span className="hidden md:inline text-neutral-300">›</span>
          <button
            type="button"
            onClick={() => navigate('/studio/workflow')}
            className="hidden lg:inline text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
          >
            Arbeidsflyter
          </button>
          <span className="hidden lg:inline text-neutral-300">›</span>
          {effectivelyDisabled ? (
            <span
              className="font-semibold text-neutral-800 truncate max-w-[260px]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {displayName}
            </span>
          ) : (
            <input
              className="k-title-input min-w-0"
              value={studio.name}
              onChange={(e) => studio.updateName(e.target.value)}
              placeholder="Ny arbeidsflyt-mal"
              spellCheck={false}
            />
          )}
        </nav>

        {/* Mode pill */}
        <ModePill mode={mode} onChange={setMode} />

        <div className="flex-1 hidden md:block" />

        {/* Right actions */}
        {!effectivelyDisabled && (
          <SaveStatus status={studio.saveStatus} saveError={studio.saveError} />
        )}

        <span className="hidden md:inline-block h-5 w-px bg-neutral-300/70" />

        <button
          type="button"
          onClick={() => setShowInspector((v) => !v)}
          className={`rounded-md p-1.5 transition-colors ${showInspector ? 'text-[#1a3d32] bg-[#e7efe9]' : 'text-neutral-500 hover:bg-neutral-100'}`}
          title={showInspector ? 'Skjul inspektør' : 'Vis inspektør'}
        >
          <PanelRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          title="Forhåndsvis"
        >
          <Eye className="h-4 w-4" />
        </button>

        {studio.rowId && !studio.isSystemTemplate && (
          <button
            type="button"
            onClick={() => void handleDryRun()}
            disabled={dryRunning || !!studio.compileError}
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            {dryRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Test-kjør
          </button>
        )}

        {effectivelyDisabled ? (
          <button
            type="button"
            onClick={() => navigate(`/studio/workflow/new?from=${ruleId}`)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a]"
          >
            <Copy className="h-3.5 w-3.5" />
            Kopier og rediger
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={!canPublish}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a] disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            Publiser
          </button>
        )}
      </header>

      {/* Error/warning banners — floating over body */}
      {(publishError || hasGovActions || (studio.saveError && studio.saveStatus === 'error') || studio.compileError) && (
        <div className="px-4 pt-2 space-y-1.5">
          {publishError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{publishError}</span>
              <button type="button" onClick={() => setPublishError(null)} className="shrink-0 text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {studio.compileError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Valideringsfeil: {studio.compileError}
            </div>
          )}
          {hasGovActions && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Malen inneholder <strong>myndighetsrapportering-handlinger</strong> som krever
                tillatelsen{' '}
                <code className="rounded bg-amber-100 px-1 text-xs">workflows.activate_external</code>.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Studio body */}
      <div className="studio-body" style={{ height: 'calc(100vh - 56px)' }}>

        {/* Left palette (advanced mode only) */}
        {showPalette && (
          <StudioWorkflowPalette
            mode={mode}
            onDragKind={handlePaletteKind}
          />
        )}

        {/* Center canvas */}
        <StudioWorkflowCanvas
          flowDoc={studio.flowDoc}
          onChange={studio.updateFlowDoc}
          sourceModule={studio.sourceModule}
          triggerEventName={studio.triggerEventName}
          name={studio.name}
          description={studio.description}
          rowId={studio.rowId}
          mode={mode}
          selectedIdx={selectedIdx ?? -1}
          onSelect={setSelectedIdx}
          readOnly={effectivelyDisabled}
        />

        {/* Right inspector */}
        {showInspector && (
          <StudioWorkflowInspector
            selectedIdx={selectedIdx}
            flowDoc={studio.flowDoc}
            onUpdateStep={handleUpdateStep}
            sourceModule={studio.sourceModule}
            triggerEventName={studio.triggerEventName}
            onChangeModule={studio.updateSourceModule}
            onChangeEvent={studio.updateTriggerEventName}
            lawRefs={studio.lawRefs}
            onLawRefs={studio.updateLawRefs}
            revisions={studio.revisions}
            revisionsLoading={studio.revisionsLoading}
            onFetchRevisions={studio.fetchRevisions}
            mode={mode}
            disabled={effectivelyDisabled}
          />
        )}
      </div>

      {/* Dry-run results overlay */}
      {showDryRunPanel && (dryRunLog || dryRunError) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/20" role="dialog" aria-modal>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-neutral-900">Dry-run resultat</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDryRunPanel(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
              {dryRunError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {dryRunError}
                </p>
              )}
              {dryRunLog && (
                <ul className="space-y-1.5">
                  {dryRunLog.map((entry, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                      style={{
                        backgroundColor:
                          entry.status === 'gov_action_blocked' ? '#fef3c7'
                          : entry.status === 'would_skip' ? '#f5f5f5'
                          : '#f0fdf4',
                      }}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-[10px] text-neutral-400">
                        {entry.step === 0 ? 'Cond' : `#${entry.step}`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-neutral-700">
                          {entry.label ?? entry.action_type}
                        </span>
                        <span className="ml-2 text-neutral-500">{entry.note}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        entry.status === 'gov_action_blocked' ? 'bg-amber-100 text-amber-700'
                        : entry.status === 'would_skip' ? 'bg-neutral-200 text-neutral-600'
                        : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {entry.status === 'gov_action_blocked' ? 'Gov (blokkert)'
                         : entry.status === 'would_skip' ? 'Hoppet over'
                         : 'Ville kjørt'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
