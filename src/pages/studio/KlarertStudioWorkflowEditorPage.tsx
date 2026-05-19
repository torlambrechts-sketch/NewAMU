// Workflow template Studio editor — three-panel layout
// (trigger selector | flow builder | metadata panel).
//
// Accessed via /studio/workflow/:ruleId.
// ruleId === 'new' creates a new template on first save.
// ?from=<id> forks from workflow_rule_catalog or an existing org template.
//
// Writes to workflow_rules with is_template=true.
// Government actions in the flow trigger a compliance warning banner.

import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock, Copy, Loader2, Pencil, Play, X, Zap } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WorkflowFlowBuilder } from '../../components/workflow/WorkflowFlowBuilder'
import { StudioWorkflowTriggerSelector } from '../../../modules/studio/workflow/StudioWorkflowTriggerSelector'
import { StudioWorkflowMetadataPanel } from '../../../modules/studio/workflow/StudioWorkflowMetadataPanel'
import { useWorkflowTemplateStudio } from '../../../modules/studio/workflow/useWorkflowTemplateStudio'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { isGovernmentActionType } from '../../../src/types/workflow'


function SaveIndicator({
  status,
  lastSavedAt,
  saveError,
}: {
  status: string
  lastSavedAt: Date | null
  saveError: string | null
}) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Lagrer…
      </span>
    )
  }
  if (status === 'saved' && lastSavedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Check className="h-3.5 w-3.5 text-emerald-500" />
        Auto-lagret
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="text-xs text-red-500" title={saveError ?? undefined}>
        Lagring feilet
      </span>
    )
  }
  return null
}

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
  // View-only for users who can view but cannot edit org templates
  const isViewOnly =
    !studio.isSystemTemplate &&
    !can('workflows.compose') &&
    !can('workflows.manage') &&
    !profile?.is_org_admin
  const effectivelyDisabled = studio.isSystemTemplate || isViewOnly
  useDirtyGuard(!effectivelyDisabled && studio.saveStatus === 'idle')
  const canPromoteToProduction = can('workflows.activate_external')
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const displayName = studio.name || 'Ny arbeidsflyt-mal'

  // Derive gov action presence from compiled flow for warning banner
  // (compile happens inside hook; we check compileError absence + actions in flowDoc)
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

  const [publishError, setPublishError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showDryRun, setShowDryRun] = useState(false)
  const [dryRunning, setDryRunning] = useState(false)
  const [dryRunLog, setDryRunLog] = useState<DryRunLogEntry[] | null>(null)
  const [dryRunError, setDryRunError] = useState<string | null>(null)

  const handleDryRun = async () => {
    if (!supabase || !studio.rowId) return
    setDryRunning(true)
    setDryRunLog(null)
    setDryRunError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = (import.meta as unknown as { env: { VITE_SUPABASE_URL?: string } }).env
        ?.VITE_SUPABASE_URL ?? ''
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/workflow-dry-run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ rule_id: studio.rowId }),
        },
      )
      const result = await resp.json() as { ok: boolean; log?: DryRunLogEntry[]; error?: string }
      if (result.ok && result.log) {
        setDryRunLog(result.log)
      } else {
        setDryRunError(result.error ?? 'Ukjent feil under dry-run')
      }
    } catch (e) {
      setDryRunError(e instanceof Error ? e.message : 'Nettverksfeil')
    } finally {
      setDryRunning(false)
    }
  }

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

  const titleNode =
    editingName && !effectivelyDisabled ? (
      <StandardInput
        ref={nameInputRef}
        value={studio.name}
        onChange={(e) => studio.updateName(e.target.value)}
        onBlur={() => setEditingName(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false)
        }}
        className="h-9 w-72 text-base font-semibold"
        autoFocus
      />
    ) : (
      <button
        type="button"
        onClick={() => {
          if (!effectivelyDisabled) {
            setEditingName(true)
            setTimeout(() => nameInputRef.current?.select(), 0)
          }
        }}
        className={[
          'group flex items-center gap-2',
          !effectivelyDisabled && 'hover:text-[#1a3d32]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {displayName}
        {!effectivelyDisabled && (
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-50" aria-hidden />
        )}
      </button>
    )

  const headerActions = (
    <div className="flex items-center gap-3">
      {!effectivelyDisabled && (
        <SaveIndicator
          status={studio.saveStatus}
          lastSavedAt={studio.lastSavedAt}
          saveError={studio.saveError}
        />
      )}
      {!studio.isSystemTemplate && studio.rowId && (
        <button
          type="button"
          onClick={() => {
            setShowHistory(true)
            void studio.fetchRevisions()
          }}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
        >
          <Clock className="h-3.5 w-3.5" />
          Historikk
        </button>
      )}
      {effectivelyDisabled ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(`/studio/workflow/new?from=${ruleId}`)}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          Kopier og rediger
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={handlePublish}
          disabled={!canPublish}
          className="gap-1.5"
        >
          <Zap className="h-3.5 w-3.5" />
          Publiser
        </Button>
      )}
    </div>
  )

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Studio', to: '/studio' },
        { label: 'Arbeidsflyt', to: '/studio/workflow' },
        { label: displayName },
      ]}
      title={titleNode}
      headerActions={headerActions}
      loading={studio.loading}
      notFound={
        studio.loadError
          ? {
              title: studio.loadError,
              backHref: '/studio/workflow',
              backLabel: '← Tilbake til maler',
            }
          : undefined
      }
    >
      {/* View-only notice for users without compose permission */}
      {isViewOnly && (
        <InfoBox>
          Du kan se denne malen, men mangler tillatelsen{' '}
          <code className="rounded bg-blue-50 px-1 text-xs">workflows.compose</code>{' '}
          for å redigere den.{' '}
          <button
            type="button"
            onClick={() => navigate(`/studio/workflow/new?from=${ruleId}`)}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Kopier den for å lage din egen versjon.
          </button>
        </InfoBox>
      )}

      {/* Description field above the three-panel area */}
      <div className="mb-3">
        <StandardInput
          value={studio.description}
          onChange={(e) => studio.updateDescription(e.target.value)}
          disabled={effectivelyDisabled}
          placeholder="Kort beskrivelse av hva denne malen gjør…"
          className="w-full"
        />
      </div>

      {/* Publish validation error */}
      {publishError && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{publishError}</span>
          <button
            type="button"
            onClick={() => setPublishError(null)}
            className="shrink-0 text-red-400 hover:text-red-600"
            aria-label="Lukk"
          >
            ×
          </button>
        </div>
      )}

      {/* Gov-action compliance warning */}
      {hasGovActions && (
        <WarningBox>
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Malen inneholder en eller flere <strong>myndighetsrapportering-handlinger</strong>.
              Aktivering krever tillatelsen{' '}
              <code className="rounded bg-amber-100 px-1 text-xs">workflows.activate_external</code>{' '}
              og godkjenning fra en annen administrator.
            </span>
          </div>
        </WarningBox>
      )}

      {/* Save error (auto-save or publish failure) */}
      {studio.saveError && studio.saveStatus === 'error' && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">Lagring feilet: {studio.saveError}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
        {/* Compile error strip */}
        {studio.compileError && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
            Valideringsfeil: {studio.compileError}
          </div>
        )}

        {/* Three-panel area */}
        <div className="flex" style={{ height: 'calc(100vh - 20rem)' }}>
          {/* Left: trigger selector */}
          <StudioWorkflowTriggerSelector
            sourceModule={studio.sourceModule}
            triggerEventName={studio.triggerEventName}
            triggerType={studio.triggerType}
            triggerOn={studio.triggerOn}
            onChangeModule={studio.updateSourceModule}
            onChangeEvent={studio.updateTriggerEventName}
            onChangeTriggerType={studio.updateTriggerType}
            onChangeTriggerOn={studio.updateTriggerOn}
            disabled={effectivelyDisabled}
          />

          {/* Center: flow builder */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <WorkflowFlowBuilder
              value={studio.flowDoc}
              onChange={studio.updateFlowDoc}
              sourceModule={studio.sourceModule}
              compileError={studio.compileError}
              readOnly={effectivelyDisabled}
            />
          </div>

          {/* Right: metadata panel */}
          <StudioWorkflowMetadataPanel
            templateName={studio.name}
            lawRefs={studio.lawRefs}
            frameworks={studio.frameworks}
            pack={studio.pack}
            cadenceHint={studio.cadenceHint}
            confidentialityLevel={studio.confidentialityLevel}
            runtimeEnvironment={studio.runtimeEnvironment}
            hasGovActions={hasGovActions}
            canPromote={canPromoteToProduction}
            disabled={effectivelyDisabled}
            onLawRefs={studio.updateLawRefs}
            onFrameworks={studio.updateFrameworks}
            onPack={studio.updatePack}
            onCadenceHint={studio.updateCadenceHint}
            onConfidentialityLevel={studio.updateConfidentialityLevel}
            onUpgradeToProduction={studio.upgradeToProduction}
          />
        </div>
      </div>
      {/* Dry-run test panel */}
      {studio.rowId && !studio.isSystemTemplate && (
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setShowDryRun((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {showDryRun ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
            )}
            <Play className="h-4 w-4 shrink-0 text-emerald-600" />
            Dry-run test
            <span className="ml-1 text-xs font-normal text-neutral-400">— simuler flyten uten å kjøre handlinger</span>
          </button>

          {showDryRun && (
            <div className="border-t border-neutral-100 px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleDryRun()}
                  disabled={dryRunning || !!studio.compileError}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15322a] disabled:opacity-40"
                >
                  {dryRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Kjør simulering
                </button>
                {studio.compileError && (
                  <span className="text-xs text-red-500">Fiks valideringsfeil før test</span>
                )}
              </div>

              {dryRunError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {dryRunError}
                </p>
              )}

              {dryRunLog && (
                <ul className="mt-3 space-y-1.5">
                  {dryRunLog.map((entry, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                      style={{
                        backgroundColor:
                          entry.status === 'gov_action_blocked'
                            ? '#fef3c7'
                            : entry.status === 'would_skip'
                              ? '#f5f5f5'
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
                        entry.status === 'gov_action_blocked'
                          ? 'bg-amber-100 text-amber-700'
                          : entry.status === 'would_skip'
                            ? 'bg-neutral-200 text-neutral-600'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {entry.status === 'gov_action_blocked'
                          ? 'Gov (blokkert)'
                          : entry.status === 'would_skip'
                            ? 'Hoppet over'
                            : 'Ville kjørt'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Revision history modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-labelledby="history-modal-title">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h3 id="history-modal-title" className="text-sm font-semibold text-neutral-900">
                Versjonshistorikk
              </h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {studio.revisionsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                </div>
              ) : studio.revisions.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-neutral-400">
                  Ingen versjoner lagret ennå. Lagring skjer automatisk.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {studio.revisions.map((rev, i) => (
                    <li key={rev.id} className="px-5 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-neutral-700">
                          v{rev.revision_number}
                          {i === 0 && (
                            <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Siste
                            </span>
                          )}
                        </span>
                        <time className="shrink-0 text-[11px] text-neutral-400">
                          {new Date(rev.created_at).toLocaleString('nb')}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{rev.name}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </ModulePageShell>
  )
}
