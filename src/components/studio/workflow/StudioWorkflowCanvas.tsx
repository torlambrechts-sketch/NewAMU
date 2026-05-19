// Notion-style block-stack canvas for the Klarert Studio workflow editor.
// Each FlowStep is rendered as a draggable card. Insert rows appear between
// blocks for DnD drop targets. The trigger block is always first and locked.

import { useCallback, useRef, useState } from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { ComponentType } from 'react'
import {
  type WorkflowFlowDocument,
  type WorkflowFlowStep,
  newFlowStepId,
} from '../../../lib/workflowFlowTypes'
import {
  STUDIO_BLOCK_META,
  SIMPLE_KINDS,
  ALL_PALETTE_KINDS,
  actionTypeToKind,
  type StudioBlockKind,
} from './studioBlockMeta'
import {
  defaultTaskAction,
  defaultSendEmailAction,
  defaultNotificationAction,
  defaultWebhookAction,
  defaultLogOnlyAction,
  defaultWaitUntilAction,
  defaultRequestApprovalAction,
  defaultEscalateAction,
} from '../../workflow/workflowActionDefaults'

// ─── Local icon helper ───────────────────────────────────────────────────────

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const icons = LucideIcons as unknown as Record<string, ComponentType<LucideProps>>
  const Icon = icons[name]
  if (!Icon) return null
  return <Icon className={className} />
}

// ─── Default step factory ────────────────────────────────────────────────────

function makeNewStep(kind: StudioBlockKind): WorkflowFlowStep {
  const id = newFlowStepId()
  if (kind === 'condition' || kind === 'branch') {
    return { id, kind: 'condition', label: 'Ny betingelse', condition: { match: 'always' } }
  }
  // action kinds
  let action
  switch (kind) {
    case 'email':    action = defaultSendEmailAction(); break
    case 'task':     action = defaultTaskAction(); break
    case 'notif':    action = defaultNotificationAction(); break
    case 'webhook':  action = defaultWebhookAction(); break
    case 'log':      action = defaultLogOnlyAction(); break
    case 'wait':     action = defaultWaitUntilAction(); break
    case 'approval': action = defaultRequestApprovalAction(); break
    case 'assign':   action = defaultEscalateAction(); break
    case 'ros':      return { id, kind: 'actions', label: 'ROS-utkast', actions: [{ type: 'create_ros_draft', template: 'standard 5×5' } as unknown as ReturnType<typeof defaultTaskAction>] }
    case 'amu':      return { id, kind: 'actions', label: 'AMU-saksliste', actions: [{ type: 'add_amu_agenda_item', agendaItem: '', priority: 'normal' } as never] }
    default:         action = defaultTaskAction()
  }
  const meta = STUDIO_BLOCK_META[kind]
  return { id, kind: 'actions', label: `Ny ${meta?.label.toLowerCase() ?? 'handling'}`, actions: [action] }
}

// ─── Block body preview ──────────────────────────────────────────────────────

function BlockBodyPreview({ step, sourceModule, triggerEventName }: {
  step: WorkflowFlowStep | null
  isTrigger?: boolean
  sourceModule?: string
  triggerEventName?: string | null
}) {
  if (!step) {
    // Trigger block preview
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800">
          <LucideIcon name="Zap" className="h-3 w-3" />
          {sourceModule ?? '—'} · {triggerEventName ?? 'hendelse ikke valgt'}
        </span>
      </div>
    )
  }
  if (step.kind === 'condition') {
    const c = step.condition
    const matchLabel = 'match' in c && c.match === 'always' ? 'Alltid' : 'Betingelse'
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 font-semibold text-amber-800">
          {matchLabel}
        </span>
      </div>
    )
  }
  if (step.kind === 'actions' && step.actions.length > 0) {
    const a = step.actions[0]
    const kind = actionTypeToKind((a as { type: string }).type)
    const meta = STUDIO_BLOCK_META[kind]
    return (
      <div
        className="mt-3 inline-flex items-center gap-2 rounded-md px-2 py-1 text-[11.5px]"
        style={{ background: meta?.tint, border: `1px solid ${meta?.border}`, color: meta?.accent }}
      >
        <LucideIcon name={meta?.icon ?? 'Circle'} className="h-3 w-3" />
        {meta?.label ?? kind}
        {step.actions.length > 1 && (
          <span className="text-[10px] opacity-70">+{step.actions.length - 1}</span>
        )}
      </div>
    )
  }
  return (
    <div className="mt-3 text-[11.5px] text-neutral-400 italic">Legg til handling i inspektøren</div>
  )
}

// ─── Insert row ──────────────────────────────────────────────────────────────

function InsertRow({ isDrop, onDragOver, onDrop, onInsert, insertIndex }: {
  isDrop: boolean
  onDragOver: (idx: number) => void
  onDrop: (idx: number) => void
  onInsert: (idx: number) => void
  insertIndex: number
}) {
  return (
    <div
      className={`k-insert-row${isDrop ? ' is-drop' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; onDragOver(insertIndex) }}
      onDrop={(e) => { e.preventDefault(); onDrop(insertIndex) }}
    >
      <div className="k-insert-line" />
      <button
        type="button"
        className="k-insert-btn"
        onClick={() => onInsert(insertIndex)}
        title="Sett inn blokk"
      >
        <LucideIcon name="Plus" className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Add block row ────────────────────────────────────────────────────────────

function AddBlockRow({ mode, onAdd }: { mode: 'simple' | 'advanced'; onAdd: (k: StudioBlockKind) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const kinds = mode === 'simple' ? SIMPLE_KINDS : ALL_PALETTE_KINDS

  return (
    <div ref={ref} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-white/40 px-3 py-3 text-sm font-medium text-neutral-600 transition-colors hover:border-[#1a3d32] hover:bg-[#e7efe9]/40 hover:text-[#1a3d32]"
      >
        <LucideIcon name="Plus" className="h-4 w-4" />
        Legg til steg
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-[420px] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Velg blokktype</p>
          <div className="grid grid-cols-2 gap-1">
            {kinds.map((k) => {
              const m = STUDIO_BLOCK_META[k]
              if (!m) return null
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setOpen(false); onAdd(k) }}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-[#e7efe9] hover:text-[#1a3d32]"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    style={{ background: m.tint, color: m.accent, border: `1px solid ${m.border}` }}
                  >
                    <LucideIcon name={m.icon} className="h-3 w-3" />
                  </span>
                  <span className="font-medium">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Single block card ────────────────────────────────────────────────────────

type BlockCardProps = {
  stepIndex: number      // index in linearSteps (0-based); -1 for trigger
  step: WorkflowFlowStep | null   // null = trigger
  order: number          // display order (1-based)
  isSelected: boolean
  isDragging: boolean
  isDisabled?: boolean
  sourceModule?: string
  triggerEventName?: string | null
  onSelect: (idx: number) => void
  onDragStart: (idx: number) => void
  onDelete: (idx: number) => void
  onDuplicate: (idx: number) => void
  onToggle: (idx: number) => void
  onTitleChange: (idx: number, title: string) => void
  readOnly?: boolean
}

function BlockCard({
  stepIndex, step, order, isSelected, isDragging,
  sourceModule, triggerEventName,
  onSelect, onDragStart, onDelete, onDuplicate, onToggle, onTitleChange, readOnly,
}: BlockCardProps) {
  const isTrigger = step === null
  const kind: StudioBlockKind = isTrigger
    ? 'trigger'
    : step.kind === 'condition'
    ? 'condition'
    : actionTypeToKind((step.actions[0] as { type: string } | undefined)?.type ?? 'create_task')

  const meta = STUDIO_BLOCK_META[kind] ?? STUDIO_BLOCK_META.task
  const enabled = isTrigger ? true : true // steps don't have enabled on this model directly
  const label = isTrigger
    ? (triggerEventName ?? 'Utløser')
    : (step.label ?? meta.label)

  return (
    <div
      className={[
        'k-block',
        isSelected ? 'is-selected' : '',
        isDragging ? 'is-dragging' : '',
        !enabled ? 'is-disabled' : '',
      ].filter(Boolean).join(' ')}
      onClick={(e) => { e.stopPropagation(); onSelect(stepIndex) }}
    >
      {/* Hover handles */}
      <div className="k-block-handles">
        {!readOnly && !isTrigger && (
          <button
            type="button"
            className="k-block-handle is-add"
            title="Legg til blokk under"
            onClick={(e) => { e.stopPropagation(); /* handled by insert rows */ }}
          >
            <LucideIcon name="Plus" className="h-3.5 w-3.5" />
          </button>
        )}
        {!isTrigger && (
          <button
            type="button"
            className="k-block-handle"
            draggable={!isTrigger && !readOnly}
            onDragStart={(e) => {
              if (isTrigger || readOnly) { e.preventDefault(); return }
              e.stopPropagation()
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('application/x-klarert-stepidx', String(stepIndex))
              onDragStart(stepIndex)
            }}
            title={isTrigger ? 'Utløseren er låst som første steg' : 'Dra for å flytte'}
          >
            <LucideIcon name="GripVertical" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Block head */}
      <div className="flex items-start gap-3">
        {/* Step number */}
        <span className={`k-step-number${isSelected ? ' is-active' : ''}`}>{order}</span>

        <div className="min-w-0 flex-1">
          {/* Kind chip + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: meta.tint, color: meta.accent, border: `1px solid ${meta.border}` }}
            >
              <LucideIcon name={meta.icon} className="h-3 w-3" />
              {meta.label}
            </span>
            {isTrigger && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                <LucideIcon name="Lock" className="h-2.5 w-2.5" />
                Steg 1 · låst
              </span>
            )}

            {/* Action buttons at right */}
            {!readOnly && !isTrigger && (
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggle(stepIndex) }}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  title="Aktiver/deaktiver"
                >
                  <LucideIcon name="CircleDot" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(stepIndex) }}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  title="Dupliser"
                >
                  <LucideIcon name="Copy" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(stepIndex) }}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                  title="Slett"
                >
                  <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {!readOnly && isTrigger && (
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(stepIndex) }}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  title="Kopier"
                >
                  <LucideIcon name="Copy" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Title (inline editable) */}
          {!readOnly && !isTrigger ? (
            <input
              value={label}
              onChange={(e) => onTitleChange(stepIndex, e.target.value)}
              placeholder="Uten tittel"
              spellCheck={false}
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 w-full bg-transparent text-[16px] font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
              style={{ fontFamily: 'var(--font-serif)' }}
            />
          ) : (
            <p
              className="mt-1.5 text-[16px] font-semibold text-neutral-900"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {label || 'Uten tittel'}
            </p>
          )}

          {/* Body preview */}
          <BlockBodyPreview
            step={step}
            isTrigger={isTrigger}
            sourceModule={sourceModule}
            triggerEventName={triggerEventName}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Minimap ─────────────────────────────────────────────────────────────────

function StepMinimap({ steps, activeIdx, onJump }: {
  steps: WorkflowFlowStep[]
  activeIdx: number
  onJump: (idx: number) => void
}) {
  return (
    <div className="hidden xl:block w-[36px] shrink-0">
      <p className="rotate-180 [writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
        Oversikt
      </p>
      <ol className="space-y-1.5">
        {/* trigger */}
        <li>
          <button
            type="button"
            onClick={() => onJump(-1)}
            className={`k-minimap-block${activeIdx === -1 ? ' is-active' : ''}`}
            style={{ width: '100%' }}
            title="Utløser"
          >
            <span className="k-mm-dot" style={{ background: STUDIO_BLOCK_META.trigger.accent }} />
            <span className="k-mm-bar" />
          </button>
        </li>
        {steps.map((s, i) => {
          const kind = s.kind === 'condition'
            ? 'condition'
            : actionTypeToKind((s.actions[0] as { type: string } | undefined)?.type ?? 'create_task')
          const meta = STUDIO_BLOCK_META[kind] ?? STUDIO_BLOCK_META.task
          const on = i === activeIdx
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(i)}
                className={`k-minimap-block${on ? ' is-active' : ''}`}
                style={{ width: '100%' }}
                title={s.label ?? meta.label}
              >
                <span className="k-mm-dot" style={{ background: meta.accent }} />
                <span className="k-mm-bar" />
              </button>
            </li>
          )
        })}
      </ol>
      <div className="mt-2 text-[10px] tabular-nums text-neutral-500 text-center">
        {steps.length + 1}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type CanvasProps = {
  flowDoc: WorkflowFlowDocument
  onChange: (doc: WorkflowFlowDocument) => void
  sourceModule: string
  triggerEventName: string | null
  name: string
  description: string
  rowId: string | null
  mode: 'simple' | 'advanced'
  selectedIdx: number   // -1 = trigger, >=0 = linearSteps index
  onSelect: (idx: number) => void
  readOnly?: boolean
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function StudioWorkflowCanvas({
  flowDoc, onChange, sourceModule, triggerEventName, description, rowId,
  mode, selectedIdx, onSelect, readOnly,
}: CanvasProps) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [draggingKind, setDraggingKind] = useState<StudioBlockKind | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const steps = flowDoc.linearSteps

  const insertAt = useCallback((kind: StudioBlockKind, atIndex: number) => {
    const newStep = makeNewStep(kind)
    const next = steps.slice()
    const at = Math.max(0, Math.min(atIndex, next.length))
    next.splice(at, 0, newStep)
    onChange({ ...flowDoc, linearSteps: next })
    onSelect(at)
  }, [steps, flowDoc, onChange, onSelect])

  const deleteStep = useCallback((idx: number) => {
    const next = steps.filter((_, i) => i !== idx)
    onChange({ ...flowDoc, linearSteps: next })
    if (selectedIdx === idx) onSelect(-1)
  }, [steps, flowDoc, onChange, selectedIdx, onSelect])

  const duplicateStep = useCallback((idx: number) => {
    const copy = { ...steps[idx], id: newFlowStepId() }
    if (copy.kind === 'actions') copy.actions = [...copy.actions]
    const next = steps.slice()
    next.splice(idx + 1, 0, copy)
    onChange({ ...flowDoc, linearSteps: next })
    onSelect(idx + 1)
  }, [steps, flowDoc, onChange, onSelect])

  const updateTitle = useCallback((idx: number, title: string) => {
    const next = steps.map((s, i) => i === idx ? { ...s, label: title } : s)
    onChange({ ...flowDoc, linearSteps: next })
  }, [steps, flowDoc, onChange])

  const handleDrop = useCallback((atIndex: number) => {
    if (draggingIdx !== null) {
      // Reorder
      const arr = steps.slice()
      const [pulled] = arr.splice(draggingIdx, 1)
      let dest = atIndex
      if (draggingIdx < atIndex) dest -= 1
      if (dest < 0) dest = 0
      arr.splice(dest, 0, pulled)
      onChange({ ...flowDoc, linearSteps: arr })
      onSelect(dest)
    } else if (draggingKind) {
      insertAt(draggingKind, atIndex)
    }
    setDraggingIdx(null)
    setDraggingKind(null)
    setDropIndex(null)
  }, [draggingIdx, draggingKind, steps, flowDoc, onChange, onSelect, insertAt])

  // Expose drag kind setter for palette drag events (via data transfer)
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    const kind = e.dataTransfer.getData('application/x-klarert-kind') as StudioBlockKind | ''
    if (kind) setDraggingKind(kind || null)
  }

  const totalCount = steps.length

  // Workflow ID badge
  const wfId = rowId ? `WF-${rowId.slice(0, 6).toUpperCase()}` : 'WF-NR'

  return (
    <div
      className="studio-canvas"
      onClick={() => onSelect(-1)}
      onDragOver={handleCanvasDragOver}
      onDrop={(e) => {
        e.preventDefault()
        const kind = e.dataTransfer.getData('application/x-klarert-kind') as StudioBlockKind | ''
        if (kind) insertAt(kind as StudioBlockKind, steps.length)
      }}
    >
      <div className="mx-auto max-w-[820px] px-6 md:px-10 py-8 flex gap-6">
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>

          {/* Workflow meta strip */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-neutral-200 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-700">
                <LucideIcon name="GitBranch" className="h-3 w-3 text-[#6d28d9]" />
                Arbeidsflyt · {wfId}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                <LucideIcon name="CircleDot" className="h-3 w-3" />
                Kladd
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-neutral-200 px-2 py-0.5 text-[10.5px] text-neutral-600">
                <LucideIcon name="Megaphone" className="h-3 w-3 text-[#b91c1c]" />
                Modul: {sourceModule}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-neutral-200 px-2 py-0.5 text-[10.5px] text-neutral-600">
                <LucideIcon name="History" className="h-3 w-3" />
                Sist endret nå
              </span>
            </div>
            {description && (
              <p className="text-[13px] text-neutral-600 leading-relaxed">{description}</p>
            )}
          </div>

          {/* Block stack */}
          <div>
            {/* Trigger block (synthetic, always index -1) */}
            <BlockCard
              stepIndex={-1}
              step={null}
              order={1}
              isSelected={selectedIdx === -1}
              isDragging={false}
              sourceModule={sourceModule}
              triggerEventName={triggerEventName}
              onSelect={onSelect}
              onDragStart={() => {}}
              onDelete={() => {}}
              onDuplicate={() => {}}
              onToggle={() => {}}
              onTitleChange={() => {}}
              readOnly={readOnly}
            />

            {steps.map((s, i) => (
              <div key={s.id}>
                <InsertRow
                  isDrop={dropIndex === i}
                  insertIndex={i}
                  onDragOver={setDropIndex}
                  onDrop={handleDrop}
                  onInsert={(at) => insertAt('task', at)}
                />
                <BlockCard
                  stepIndex={i}
                  step={s}
                  order={i + 2}
                  isSelected={selectedIdx === i}
                  isDragging={draggingIdx === i}
                  sourceModule={sourceModule}
                  triggerEventName={triggerEventName}
                  onSelect={onSelect}
                  onDragStart={setDraggingIdx}
                  onDelete={deleteStep}
                  onDuplicate={duplicateStep}
                  onToggle={() => { /* no enabled field on step */ }}
                  onTitleChange={updateTitle}
                  readOnly={readOnly}
                />
              </div>
            ))}

            {/* Final insert row */}
            <InsertRow
              isDrop={dropIndex === totalCount}
              insertIndex={totalCount}
              onDragOver={setDropIndex}
              onDrop={handleDrop}
              onInsert={(at) => insertAt('task', at)}
            />

            {/* Add block row */}
            {!readOnly && (
              <AddBlockRow
                mode={mode}
                onAdd={(k) => insertAt(k, steps.length)}
              />
            )}
          </div>

          {/* Simple mode info box */}
          {mode === 'simple' && (
            <div className="mt-8 rounded-xl border border-[#c5d3c8] bg-[#e7efe9] px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <LucideIcon name="EyeOff" className="h-4 w-4 mt-0.5 text-[#1a3d32]" />
                <div>
                  <p className="text-[12.5px] font-semibold text-neutral-900">Du er i Enkel modus</p>
                  <p className="mt-1 text-[11.5px] text-neutral-700">
                    Blokkpalett, regelverk-tagging, stil-paneler, versjonshistorikk og test-kjør-detaljer er skjult.
                    Bytt til <b>Avansert</b> i toppbaren for full kontroll.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Minimap rail (advanced only) */}
        {mode === 'advanced' && (
          <StepMinimap
            steps={steps}
            activeIdx={selectedIdx}
            onJump={onSelect}
          />
        )}
      </div>
    </div>
  )
}
