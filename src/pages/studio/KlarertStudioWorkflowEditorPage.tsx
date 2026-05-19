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
import { AlertTriangle, Check, Copy, Loader2, Pencil, Zap } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { WarningBox } from '../../components/ui/AlertBox'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WorkflowFlowBuilder } from '../../components/workflow/WorkflowFlowBuilder'
import { StudioWorkflowTriggerSelector } from '../../../modules/studio/workflow/StudioWorkflowTriggerSelector'
import { StudioWorkflowMetadataPanel } from '../../../modules/studio/workflow/StudioWorkflowMetadataPanel'
import { useWorkflowTemplateStudio } from '../../../modules/studio/workflow/useWorkflowTemplateStudio'
import { isGovernmentActionType } from '../../../src/types/workflow'
import type { WorkflowAction, WorkflowXorActionsEnvelope } from '../../../src/types/workflow'

// Derive whether the current flow contains gov actions (for warning banner).
function flowHasGovAction(
  actionsJson: WorkflowAction[] | WorkflowXorActionsEnvelope | null,
): boolean {
  if (!actionsJson) return false
  if (Array.isArray(actionsJson)) {
    return actionsJson.some((a) => isGovernmentActionType((a as { type: string }).type))
  }
  return actionsJson.branches.some((b) =>
    b.actions.some((a) => isGovernmentActionType((a as { type: string }).type)),
  )
}

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

export function KlarertStudioWorkflowEditorPage() {
  const { ruleId = 'new' } = useParams<{ ruleId: string }>()
  const [searchParams] = useSearchParams()
  const fromId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useWorkflowTemplateStudio(ruleId, fromId)
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

  const canPublish =
    !studio.compileError &&
    studio.name.trim().length > 0 &&
    !!studio.triggerEventName

  const handlePublish = async () => {
    if (!canPublish) {
      alert(
        studio.compileError ??
          'Legg til et navn, velg en hendelse, og legg til minst én handling.',
      )
      return
    }
    await studio.publishTemplate()
    if (!studio.saveError) {
      navigate('/studio/workflow')
    }
  }

  const titleNode =
    editingName && !studio.isSystemTemplate ? (
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
          if (!studio.isSystemTemplate) {
            setEditingName(true)
            setTimeout(() => nameInputRef.current?.select(), 0)
          }
        }}
        className={[
          'group flex items-center gap-2',
          !studio.isSystemTemplate && 'hover:text-[#1a3d32]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {displayName}
        {!studio.isSystemTemplate && (
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-50" aria-hidden />
        )}
      </button>
    )

  const headerActions = (
    <div className="flex items-center gap-3">
      {!studio.isSystemTemplate && (
        <SaveIndicator
          status={studio.saveStatus}
          lastSavedAt={studio.lastSavedAt}
          saveError={studio.saveError}
        />
      )}
      {studio.isSystemTemplate ? (
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
      {/* Description field above the three-panel area */}
      <div className="mb-3">
        <StandardInput
          value={studio.description}
          onChange={(e) => studio.updateDescription(e.target.value)}
          disabled={studio.isSystemTemplate}
          placeholder="Kort beskrivelse av hva denne malen gjør…"
          className="w-full"
        />
      </div>

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
            disabled={studio.isSystemTemplate}
          />

          {/* Center: flow builder */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <WorkflowFlowBuilder
              value={studio.flowDoc}
              onChange={studio.updateFlowDoc}
              sourceModule={studio.sourceModule}
              compileError={studio.compileError}
            />
          </div>

          {/* Right: metadata panel */}
          <StudioWorkflowMetadataPanel
            lawRefs={studio.lawRefs}
            frameworks={studio.frameworks}
            pack={studio.pack}
            cadenceHint={studio.cadenceHint}
            confidentialityLevel={studio.confidentialityLevel}
            disabled={studio.isSystemTemplate}
            onLawRefs={studio.updateLawRefs}
            onFrameworks={studio.updateFrameworks}
            onPack={studio.updatePack}
            onCadenceHint={studio.updateCadenceHint}
            onConfidentialityLevel={studio.updateConfidentialityLevel}
          />
        </div>
      </div>
    </ModulePageShell>
  )
}
