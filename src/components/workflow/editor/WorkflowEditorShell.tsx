// Step-list workflow editor. One component, two presentations:
//   - mode='drawer'     → right slide-over, inline-expand cards
//   - mode='fullscreen' → full-viewport, step list left + detail right
// Both share the same draft state + auto-save against workflow_rules.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import {
  compileWorkflowFlow,
  defaultWorkflowFlowDocument,
  parseFlowDocument,
  type WorkflowFlowDocument,
} from '../../../lib/workflowFlowTypes'
import type { WorkflowAction } from '../../../types/workflow'
import {
  defaultSendEmailAction,
  defaultTaskAction,
  defaultNotificationAction,
} from '../workflowActionDefaults'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import {
  appendAction,
  appendCondition,
  buildEditorSteps,
  getActionAt,
  isXorEnvelope,
  patchAction,
  patchCondition,
  removeStep,
  type EditorStep,
} from './stepModel'
import {
  ConditionFields,
  CreateRosDraftFields,
  CreateTaskFields,
  EmailFields,
  GenericActionPreview,
  NotificationFields,
  VariableChips,
  WaitDelayFields,
  variablesFor,
} from './StepFieldEditors'

const ACCENT_BG: Record<EditorStep['accent'], string> = {
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-neutral-100 text-neutral-700',
}

type EditorMode = 'drawer' | 'fullscreen'

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export type WorkflowEditorShellProps = {
  open: boolean
  ruleId: string | null
  mode: EditorMode
  onClose: () => void
  onChangeMode: (next: EditorMode) => void
  /** Optional jump-to advanced canvas editor (for XOR / advanced rules). */
  onOpenAdvanced?: (ruleId: string) => void
}

export function WorkflowEditorShell({
  open,
  ruleId,
  mode,
  onClose,
  onChangeMode,
  onOpenAdvanced,
}: WorkflowEditorShellProps) {
  const { rules, upsertRule, canCompose } = useWorkflows()
  const rule = useMemo(() => rules.find((r) => r.id === ruleId) ?? null, [rules, ruleId])

  const [doc, setDoc] = useState<WorkflowFlowDocument>(defaultWorkflowFlowDocument())
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>('trigger')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate when the rule loads or changes
  useEffect(() => {
    if (!rule) return
    if (hydratedFor === rule.id) return
    const parsed = rule.flow_graph_json ? parseFlowDocument(rule.flow_graph_json as unknown) : null
    setDoc(parsed ?? defaultWorkflowFlowDocument())
    setHydratedFor(rule.id)
    setSave('idle')
    setSaveError(null)
    setSelectedKey('trigger')
    setExpandedKey(null)
  }, [rule, hydratedFor])

  // Auto-save: debounce 800ms after the doc changes
  useEffect(() => {
    if (!rule || !canCompose || save === 'idle' || save === 'saved') return
    if (save !== 'pending') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void performSave()
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, save, rule, canCompose])

  const performSave = useCallback(async () => {
    if (!rule) return
    const compiled = compileWorkflowFlow(doc)
    if ('error' in compiled) {
      setSave('error')
      setSaveError(compiled.error)
      return
    }
    setSave('saving')
    setSaveError(null)
    const result = await upsertRule({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      description: rule.description,
      source_module: rule.source_module,
      trigger_event_name: rule.trigger_event_name ?? null,
      trigger_on: rule.trigger_on,
      is_active: rule.is_active,
      condition_json: compiled.condition_json,
      actions_json: compiled.actions_json,
      flow_graph_json: doc as unknown as Record<string, unknown>,
      priority: rule.priority,
    })
    if (result?.ok) {
      setSave('saved')
    } else {
      setSave('error')
      setSaveError('Kunne ikke lagre arbeidsflyt.')
    }
  }, [rule, doc, upsertRule])

  const markDirty = useCallback((next: WorkflowFlowDocument) => {
    setDoc(next)
    setSave('pending')
  }, [])

  const handleCloseAndSave = useCallback(async () => {
    if (save === 'pending' || save === 'saving') {
      await performSave()
    }
    onClose()
  }, [save, performSave, onClose])

  if (!open || !rule) return null

  // XOR rules don't fit the linear step list — show a redirect prompt
  if (isXorEnvelope(rule.actions_json)) {
    return (
      <ShellChrome mode={mode} onClose={onClose} onChangeMode={onChangeMode} title={rule.name}>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Avansert flyt (XOR-grener)</p>
          <p className="mt-1">
            Denne regelen har grenstruktur som ikke kan vises i den enkle steg-listen.
          </p>
          {onOpenAdvanced && (
            <Button
              variant="primary"
              className="mt-3"
              onClick={() => onOpenAdvanced(rule.id)}
            >
              Åpne i avansert visning
            </Button>
          )}
        </div>
      </ShellChrome>
    )
  }

  const steps = buildEditorSteps(doc, rule.name, rule.trigger_event_name ?? null)
  const stepCount = steps.length
  const completedCount = steps.filter((s) => s.completed).length
  const sourceModule = rule.source_module
  const selectedStep = steps.find((s) => s.uiKey === selectedKey) ?? steps[0]
  const selectedIdx = steps.findIndex((s) => s.uiKey === selectedStep?.uiKey)

  const onAddAction = (kind: 'email' | 'task' | 'notification' | 'wait' | 'condition') => {
    if (kind === 'condition') {
      const next = appendCondition(doc, { match: 'always' })
      markDirty(next)
      return
    }
    let action: WorkflowAction
    switch (kind) {
      case 'email':
        action = defaultSendEmailAction()
        break
      case 'task':
        action = defaultTaskAction()
        break
      case 'notification':
        action = defaultNotificationAction()
        break
      case 'wait':
        action = { type: 'wait_delay', amount: 1, unit: 'days' }
        break
    }
    markDirty(appendAction(doc, action))
  }

  const onRemove = (step: EditorStep) => {
    if (step.locked) return
    markDirty(removeStep(doc, step))
    if (selectedKey === step.uiKey) setSelectedKey('trigger')
    if (expandedKey === step.uiKey) setExpandedKey(null)
  }

  const onPatchAction = (step: EditorStep, next: WorkflowAction) => {
    if (step.source.type !== 'action') return
    markDirty(patchAction(doc, step.source.flowStepId, step.source.actionIndex, next))
  }

  const renderDetailFields = (step: EditorStep) => {
    if (step.kind === 'trigger') {
      return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          <p className="flex items-center gap-2 font-medium">
            <Lock className="h-3.5 w-3.5" />
            Utløser er bundet til regelens modul ({sourceModule})
          </p>
          {rule.trigger_event_name ? (
            <p className="mt-1 font-mono text-xs text-neutral-600">{rule.trigger_event_name}</p>
          ) : (
            <p className="mt-1 text-xs text-neutral-500">Ingen hendelse valgt — sett i regelens innstillinger.</p>
          )}
        </div>
      )
    }
    if (step.kind === 'condition' && step.source.type === 'condition') {
      const { flowStepId } = step.source
      const flowStep = doc.linearSteps.find((s) => s.id === flowStepId)
      if (!flowStep || flowStep.kind !== 'condition') return null
      return (
        <ConditionFields
          value={flowStep.condition}
          onChange={(next) => markDirty(patchCondition(doc, flowStepId, next))}
        />
      )
    }
    if (step.source.type !== 'action') return null
    const action = getActionAt(doc, step.source.flowStepId, step.source.actionIndex)
    if (!action) return null
    switch (action.type) {
      case 'send_email':
        return (
          <EmailFields
            a={action}
            onPatch={(next) => onPatchAction(step, next)}
            showCc
          />
        )
      case 'create_ros_draft':
        return <CreateRosDraftFields a={action} onPatch={(next) => onPatchAction(step, next)} />
      case 'create_task':
        return <CreateTaskFields a={action} onPatch={(next) => onPatchAction(step, next)} />
      case 'send_notification':
        return <NotificationFields a={action} onPatch={(next) => onPatchAction(step, next)} />
      case 'wait_delay':
        return <WaitDelayFields a={action} onPatch={(next) => onPatchAction(step, next)} />
      default:
        return <GenericActionPreview a={action} />
    }
  }

  // ─── Drawer mode ───────────────────────────────────────────────────────
  if (mode === 'drawer') {
    return (
      <ShellChrome mode="drawer" onClose={onClose} onChangeMode={onChangeMode} title={rule.name}>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Steg</p>
          {steps.map((s, i) => (
            <StepCardCollapsible
              key={s.uiKey}
              step={s}
              index={i + 1}
              expanded={expandedKey === s.uiKey}
              canEdit={canCompose}
              onToggle={() => setExpandedKey((prev) => (prev === s.uiKey ? null : s.uiKey))}
              onRemove={() => onRemove(s)}
              renderFields={() => renderDetailFields(s)}
            />
          ))}
          {canCompose && (
            <AddStepMenu onAdd={onAddAction} />
          )}
        </div>
        <ShellFooter
          mode="drawer"
          save={save}
          saveError={saveError}
          onCancel={onClose}
          onSaveClose={() => void handleCloseAndSave()}
        />
      </ShellChrome>
    )
  }

  // ─── Fullscreen mode ───────────────────────────────────────────────────
  return (
    <ShellChrome mode="fullscreen" onClose={onClose} onChangeMode={onChangeMode} title={rule.name}>
      <FullscreenLayout
        steps={steps}
        selectedKey={selectedStep?.uiKey ?? 'trigger'}
        onSelect={(k) => setSelectedKey(k)}
        completedCount={completedCount}
        stepCount={stepCount}
        canEdit={canCompose}
        onAdd={onAddAction}
        onRemove={onRemove}
        rule={rule}
        save={save}
        saveError={saveError}
        sourceModule={sourceModule}
        renderDetail={() => selectedStep && renderDetailFields(selectedStep)}
        selectedStep={selectedStep}
        onPrev={() => {
          if (selectedIdx > 0) setSelectedKey(steps[selectedIdx - 1].uiKey)
        }}
        onNext={() => {
          if (selectedIdx >= 0 && selectedIdx < steps.length - 1) setSelectedKey(steps[selectedIdx + 1].uiKey)
        }}
      />
    </ShellChrome>
  )
}

// ─── Chrome (drawer vs fullscreen header) ─────────────────────────────────

function ShellChrome({
  mode,
  title,
  onClose,
  onChangeMode,
  children,
}: {
  mode: EditorMode
  title: string
  onClose: () => void
  onChangeMode: (next: EditorMode) => void
  children: React.ReactNode
}) {
  if (mode === 'drawer') {
    return (
      <div
        className="fixed inset-0 z-[1100] flex justify-end bg-black/45 backdrop-blur-[2px]"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Rediger arbeidsflyt"
          className="flex h-full w-full max-w-[min(100vw,640px)] flex-col bg-[#faf9f5] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200 bg-[#faf9f5] px-6 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                <span aria-hidden>↻</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Rediger arbeidsflyt
                </p>
                <h2 className="truncate text-lg font-semibold text-neutral-900">{title}</h2>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Åpne full-skjerm"
                onClick={() => onChangeMode('fullscreen')}
                className="rounded-md text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Lukk"
                onClick={onClose}
                className="rounded-md text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </aside>
      </div>
    )
  }

  // fullscreen
  return (
    <div className="fixed inset-0 z-[1100] flex flex-col bg-[#faf9f5]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-[#faf9f5] px-8 py-3">
        <nav className="flex items-center gap-2 text-sm text-neutral-500" aria-label="Brødsmuler">
          <span className="font-semibold text-neutral-900">Klarert</span>
          <span className="text-neutral-400">Studio</span>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
          <span>Arbeidsflyt</span>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
          <span className="font-medium text-neutral-700">{title}</span>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Minimer til side-skuff"
            onClick={() => onChangeMode('drawer')}
            className="rounded-md text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Lukk"
            onClick={onClose}
            className="rounded-md text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

// ─── Collapsible card (drawer) ────────────────────────────────────────────

function StepCardCollapsible({
  step,
  index,
  expanded,
  canEdit,
  onToggle,
  onRemove,
  renderFields,
}: {
  step: EditorStep
  index: number
  expanded: boolean
  canEdit: boolean
  onToggle: () => void
  onRemove: () => void
  renderFields: () => React.ReactNode
}) {
  const Icon = step.icon
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white ${
        expanded ? 'border-emerald-300 shadow-sm ring-1 ring-emerald-100' : 'border-neutral-200'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-neutral-50"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            step.completed && !expanded ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {step.completed && !expanded ? '✓' : index}
        </span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACCENT_BG[step.accent]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-900">{step.title}</span>
          <span className="block truncate text-xs text-neutral-500">{step.subtitle}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-400 transition ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="space-y-4 border-t border-neutral-200 bg-[#fbfaf6] px-4 py-4">
          {renderFields()}
          {!step.locked && canEdit && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Slett steg
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add-step menu ────────────────────────────────────────────────────────

function AddStepMenu({
  onAdd,
}: {
  onAdd: (kind: 'email' | 'task' | 'notification' | 'wait' | 'condition') => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-3 text-sm text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50"
      >
        <Plus className="h-4 w-4" />
        Legg til steg
      </Button>
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          {[
            { id: 'condition' as const, label: 'Betingelse' },
            { id: 'email' as const, label: 'Send e-post' },
            { id: 'task' as const, label: 'Opprett oppgave' },
            { id: 'notification' as const, label: 'Send varsling' },
            { id: 'wait' as const, label: 'Vent / forsinkelse' },
          ].map((opt) => (
            <Button
              key={opt.id}
              type="button"
              variant="ghost"
              onClick={() => {
                onAdd(opt.id)
                setOpen(false)
              }}
              className="w-full justify-start rounded-none px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Drawer footer ────────────────────────────────────────────────────────

function ShellFooter({
  mode,
  save,
  saveError,
  onCancel,
  onSaveClose,
}: {
  mode: EditorMode
  save: SaveState
  saveError: string | null
  onCancel: () => void
  onSaveClose: () => void
}) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between gap-3 border-t border-neutral-200 bg-[#faf9f5] px-6 py-3">
      <SaveIndicator save={save} saveError={saveError} />
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
        <Button variant="primary" onClick={onSaveClose}>
          {mode === 'drawer' ? 'Lagre & lukk' : 'Publiser'}
        </Button>
      </div>
    </div>
  )
}

function SaveIndicator({ save, saveError }: { save: SaveState; saveError: string | null }) {
  if (save === 'saving') {
    return <span className="text-xs text-neutral-500">Lagrer …</span>
  }
  if (save === 'error') {
    return <span className="text-xs text-rose-700">{saveError ?? 'Kunne ikke lagre'}</span>
  }
  if (save === 'pending') {
    return <span className="text-xs text-amber-700">• Endringer ulagret</span>
  }
  if (save === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Auto-lagret
      </span>
    )
  }
  return <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
    <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
    Klar
  </span>
}

// ─── Fullscreen layout ────────────────────────────────────────────────────

function FullscreenLayout({
  steps,
  selectedKey,
  selectedStep,
  onSelect,
  completedCount,
  stepCount,
  canEdit,
  onAdd,
  onRemove,
  rule,
  save,
  saveError,
  sourceModule,
  renderDetail,
  onPrev,
  onNext,
}: {
  steps: EditorStep[]
  selectedKey: string
  selectedStep: EditorStep | undefined
  onSelect: (key: string) => void
  completedCount: number
  stepCount: number
  canEdit: boolean
  onAdd: (kind: 'email' | 'task' | 'notification' | 'wait' | 'condition') => void
  onRemove: (step: EditorStep) => void
  rule: { name: string; law_refs?: string[] | null }
  save: SaveState
  saveError: string | null
  sourceModule: string
  renderDetail: () => React.ReactNode
  onPrev: () => void
  onNext: () => void
}) {
  const selectedIdx = steps.findIndex((s) => s.uiKey === selectedKey)
  const prev = selectedIdx > 0 ? steps[selectedIdx - 1] : null
  const next = selectedIdx >= 0 && selectedIdx < steps.length - 1 ? steps[selectedIdx + 1] : null
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[360px_1fr]">
      {/* Left column — title + step list */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-[#f5f3ec] px-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{rule.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Steg til venstre — som å fylle ut en oppgave med deloppgaver. Velg ett for å redigere
            detaljene til høyre.
          </p>
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span className="font-semibold uppercase tracking-wider">
            Steg · {stepCount}
          </span>
          <span>{completedCount} fullført</span>
        </div>
        <ol className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.uiKey}>
              <StepRowFull
                step={s}
                index={i + 1}
                active={s.uiKey === selectedKey}
                onClick={() => onSelect(s.uiKey)}
              />
            </li>
          ))}
        </ol>
        {canEdit && <AddStepMenu onAdd={onAdd} />}
        <div className="mt-auto space-y-1 pt-4 text-[11px] text-neutral-500">
          <p>v1 (kladd)</p>
          {(rule.law_refs ?? []).length > 0 && (
            <p className="truncate">{(rule.law_refs ?? []).join(', ')}</p>
          )}
        </div>
      </aside>

      {/* Right column — step detail */}
      <section className="flex min-h-0 flex-col overflow-y-auto bg-[#fbfaf6] px-8 py-6">
        {selectedStep ? (
          <DetailPanel
            step={selectedStep}
            sourceModule={sourceModule}
            renderFields={renderDetail}
            onRemove={() => onRemove(selectedStep)}
            canEdit={canEdit}
          />
        ) : (
          <p className="text-sm text-neutral-500">Velg et steg fra listen.</p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onPrev}
              disabled={!prev}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Forrige {prev ? `(${prev.title})` : ''}
            </Button>
            <Button variant="primary" onClick={onNext} disabled={!next}>
              Neste {next ? `(${next.title})` : ''} <ChevronRight className="ml-1 inline h-4 w-4" />
            </Button>
          </div>
          <SaveIndicator save={save} saveError={saveError} />
        </div>
      </section>
    </div>
  )
}

function StepRowFull({
  step,
  index,
  active,
  onClick,
}: {
  step: EditorStep
  index: number
  active: boolean
  onClick: () => void
}) {
  const Icon = step.icon
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`flex h-auto w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition ${
        active
          ? 'border-emerald-300 bg-white shadow-sm ring-1 ring-emerald-200'
          : 'border-transparent hover:bg-white/70'
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          step.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-700'
        }`}
      >
        {step.completed ? '✓' : index}
      </span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${ACCENT_BG[step.accent]}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-neutral-900">{step.title}</span>
        <span className="block truncate text-[11px] text-neutral-500">{step.subtitle}</span>
      </span>
    </Button>
  )
}

function DetailPanel({
  step,
  sourceModule,
  renderFields,
  onRemove,
  canEdit,
}: {
  step: EditorStep
  sourceModule: string
  renderFields: () => React.ReactNode
  onRemove: () => void
  canEdit: boolean
}) {
  const Icon = step.icon
  const headerLabel = step.kind === 'trigger'
    ? 'UTLØSER'
    : step.kind === 'condition'
      ? 'BETINGELSE'
      : step.kind === 'logic'
        ? 'LOGIKK'
        : 'HANDLING'
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_BG[step.accent]}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {`Steg · ${headerLabel}`}
            </p>
            <h2 className="text-xl font-semibold text-neutral-900">{step.title}</h2>
          </div>
        </div>
        {!step.locked && canEdit && (
          <div className="flex items-center gap-1">
            <Badge variant="neutral">
              <Copy className="mr-1 inline h-3 w-3" /> Dupliser
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Slett steg"
              onClick={onRemove}
              className="rounded-md text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">{renderFields()}</div>

      <VariableChips variables={variablesFor(sourceModule)} />
    </div>
  )
}
