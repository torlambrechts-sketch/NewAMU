// Klarert Studio — workflow template editor.
// Uses KlarertStudioShell for chrome; useWorkflowTemplateStudio for persistence.
// Accessed via /studio/workflow/:ruleId  (ruleId='new' creates on first save).

import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  Loader2,
  Play,
  X,
} from 'lucide-react'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import { useWorkflowTemplateStudio } from '../../../modules/studio/workflow/useWorkflowTemplateStudio'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { isGovernmentActionType } from '../../types/workflow'
import type { WorkflowFlowStep } from '../../lib/workflowFlowTypes'

import { KlarertStudioShell } from '../../components/studio/KlarertStudioShell'
import { StudioWorkflowPalette } from '../../components/studio/workflow/StudioWorkflowPalette'
import { StudioWorkflowCanvas } from '../../components/studio/workflow/StudioWorkflowCanvas'
import { StudioWorkflowInspector } from '../../components/studio/workflow/StudioWorkflowInspector'
import type { StudioBlockKind } from '../../components/studio/workflow/studioBlockMeta'

type DryRunLogEntry = {
  step: number
  action_type: string
  label: string | null
  status: 'would_execute' | 'would_skip' | 'gov_action_blocked'
  note: string
}

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

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'simple' | 'advanced'>('advanced')
  const [showInspector, setShowInspector] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(-1)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [dryRunning, setDryRunning] = useState(false)
  const [dryRunLog, setDryRunLog] = useState<DryRunLogEntry[] | null>(null)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [showDryRunPanel, setShowDryRunPanel] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────────
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

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!studio.name.trim()) { setPublishError('Gi malen et navn før publisering.'); return }
    if (!studio.triggerEventName) { setPublishError('Velg en utløserhendelse før publisering.'); return }
    if (!hasAtLeastOneAction) { setPublishError('Legg til minst én handling i flyten.'); return }
    if (studio.compileError) { setPublishError(`Valideringsfeil: ${studio.compileError}`); return }
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePaletteKind = useCallback((_action: 'start' | 'end' | 'append', _kind: StudioBlockKind | null) => {
    // Palette click-to-append is handled by the canvas directly via DnD data transfer
  }, [])

  const handleUpdateStep = useCallback((idx: number, step: WorkflowFlowStep) => {
    const next = studio.flowDoc.linearSteps.map((s, i) => i === idx ? step : s)
    studio.updateFlowDoc({ ...studio.flowDoc, linearSteps: next })
  }, [studio])

  // ── Top-bar action buttons ────────────────────────────────────────────────────
  const actions = (
    <>
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
          {dryRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
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
    </>
  )

  // ── Alert banners ─────────────────────────────────────────────────────────────
  const banners = (
    <>
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
    </>
  )

  return (
    <>
      <KlarertStudioShell
        moduleLabel="Arbeidsflyter"
        moduleHref="/studio/workflow"
        title={studio.name}
        onTitleChange={effectivelyDisabled ? undefined : studio.updateName}
        titlePlaceholder="Ny arbeidsflyt-mal"
        mode={mode}
        onModeChange={setMode}
        showInspector={showInspector}
        onToggleInspector={() => setShowInspector((v) => !v)}
        loading={studio.loading}
        loadError={studio.loadError}
        loadErrorBackLabel="← Tilbake til maler"
        saveStatus={studio.saveStatus}
        saveError={studio.saveError}
        readOnly={effectivelyDisabled}
        actions={actions}
        banners={publishError || studio.compileError || hasGovActions ? banners : undefined}
        palette={mode === 'advanced' ? (
          <StudioWorkflowPalette mode={mode} onDragKind={handlePaletteKind} />
        ) : undefined}
        inspector={showInspector ? (
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
        ) : undefined}
      >
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
      </KlarertStudioShell>

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
    </>
  )
}
