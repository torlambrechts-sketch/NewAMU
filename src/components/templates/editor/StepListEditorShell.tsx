// Shared step-list editor shell. Renders any TemplateEditorAdapter as a
// right-side drawer (default) or fullscreen modal (expand button). The
// shell owns:
//   - draft hydration via adapter.hydrate
//   - auto-save with 800ms debounce via adapter.saveDraft
//   - explicit «Publiser» via adapter.publish
//   - drawer ↔ fullscreen toggle, step selection, prev/next nav
// All template-specific knowledge lives in the adapter.

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import type {
  AdapterMeta,
  EditorMode,
  EditorStep,
  EditorStepAccent,
  SaveState,
  TemplateEditorAdapter,
} from './types'

const ACCENT_BG: Record<EditorStepAccent, string> = {
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-neutral-100 text-neutral-700',
  teal: 'bg-teal-100 text-teal-700',
}

export type StepListEditorShellProps<TDraft> = {
  adapter: TemplateEditorAdapter<TDraft>
  open: boolean
  rowId: string | null
  mode: EditorMode
  onClose: () => void
  onChangeMode: (next: EditorMode) => void
}

export function StepListEditorShell<TDraft>({
  adapter,
  open,
  rowId,
  mode,
  onClose,
  onChangeMode,
}: StepListEditorShellProps<TDraft>) {
  const [draft, setDraft] = useState<TDraft | null>(null)
  const [meta, setMeta] = useState<AdapterMeta | null>(null)
  const [escape, setEscape] = useState<{ label: string; reason: string; onOpen: () => void } | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [save, setSave] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishOk, setPublishOk] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<TDraft | null>(null)

  // Hydration — re-run whenever rowId or adapter identity changes.
  useEffect(() => {
    if (!rowId) {
      setDraft(null)
      setMeta(null)
      setEscape(null)
      setHydratedFor(null)
      return
    }
    if (hydratedFor === rowId) return
    let cancelled = false
    void (async () => {
      const result = await adapter.hydrate(rowId)
      if (cancelled) return
      if (!result) {
        setDraft(null)
        setMeta(null)
        setEscape(null)
        setNotFound(true)
        setHydratedFor(rowId)
        return
      }
      setDraft(result.draft)
      draftRef.current = result.draft
      setMeta(result.meta)
      setEscape(result.escapeHatch ?? null)
      setCanEdit(result.canEdit)
      setNotFound(false)
      setHydratedFor(rowId)
      setSave('idle')
      setSaveError(null)
      setPublishOk(false)
      setPublishError(null)
      setSelectedKey(null)
      setExpandedKey(null)
    })()
    return () => {
      cancelled = true
    }
  }, [adapter, rowId, hydratedFor])

  // Auto-save: 800ms debounce after the draft is marked dirty.
  useEffect(() => {
    if (!rowId || !draft || !canEdit) return
    if (save !== 'pending') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void performAutoSave()
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, save, rowId, canEdit])

  const performAutoSave = useCallback(async () => {
    if (!rowId || !draftRef.current) return
    const current = draftRef.current
    const validationError = adapter.validate(current)
    if (validationError) {
      setSave('error')
      setSaveError(validationError)
      return
    }
    setSave('saving')
    setSaveError(null)
    const r = await adapter.saveDraft(rowId, current)
    if (r.ok) {
      setSave('saved')
    } else {
      setSave('error')
      setSaveError(r.error ?? 'Kunne ikke lagre utkast.')
    }
  }, [adapter, rowId])

  const markDirty = useCallback((next: TDraft) => {
    setDraft(next)
    draftRef.current = next
    setSave('pending')
    setPublishOk(false)
  }, [])

  const onPublish = useCallback(async () => {
    if (!rowId || !draftRef.current) return
    // Flush any pending auto-save first
    if (save === 'pending' || save === 'saving') {
      await performAutoSave()
    }
    const validationError = adapter.validate(draftRef.current)
    if (validationError) {
      setPublishError(validationError)
      return
    }
    setPublishing(true)
    setPublishError(null)
    setPublishOk(false)
    const r = await adapter.publish(rowId, draftRef.current)
    setPublishing(false)
    if (r.ok) {
      setPublishOk(true)
    } else {
      setPublishError(r.error ?? 'Kunne ikke publisere.')
    }
  }, [adapter, rowId, save, performAutoSave])

  const onCloseSafe = useCallback(async () => {
    if (save === 'pending' || save === 'saving') {
      await performAutoSave()
    }
    onClose()
  }, [save, performAutoSave, onClose])

  // ─── Empty / not-hydrated states ──────────────────────────────────────
  if (!open) return null

  if (!rowId) return null

  if (notFound) {
    return (
      <ShellChrome
        mode={mode}
        title="Mal ikke funnet"
        onClose={onClose}
        onChangeMode={onChangeMode}
        accent="slate"
        versionLabel={null}
      >
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Fant ikke malen — den kan ha blitt slettet eller du mangler tilgang.
        </p>
      </ShellChrome>
    )
  }

  if (rowId !== hydratedFor || !draft || !meta) {
    return (
      <ShellChrome
        mode={mode}
        title="Laster …"
        onClose={onClose}
        onChangeMode={onChangeMode}
        accent="slate"
        versionLabel={null}
      >
        <p className="text-sm text-neutral-500">Henter mal …</p>
      </ShellChrome>
    )
  }

  if (escape) {
    return (
      <ShellChrome
        mode={mode}
        title={meta.title}
        onClose={onClose}
        onChangeMode={onChangeMode}
        accent={meta.accent ?? 'amber'}
        versionLabel={meta.versionLabel ?? null}
      >
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{escape.reason}</p>
          <Button variant="primary" className="mt-3" onClick={escape.onOpen}>
            {escape.label}
          </Button>
        </div>
      </ShellChrome>
    )
  }

  // ─── Metadata-only sources (alerts) ───────────────────────────────────
  if (meta.metadataOnly && adapter.renderMetadataOnly) {
    return (
      <ShellChrome
        mode={mode}
        title={meta.title}
        onClose={onClose}
        onChangeMode={onChangeMode}
        accent={meta.accent ?? 'slate'}
        versionLabel={meta.versionLabel ?? null}
      >
        <div className="space-y-4">
          {adapter.renderMetadataOnly(draft, markDirty)}
        </div>
        <ShellFooter
          mode={mode}
          canEdit={canEdit}
          save={save}
          saveError={saveError}
          publishing={publishing}
          publishOk={publishOk}
          publishError={publishError}
          onCancel={onClose}
          onCloseSafe={() => void onCloseSafe()}
          onPublish={() => void onPublish()}
        />
      </ShellChrome>
    )
  }

  const steps = adapter.buildSteps(draft)
  const selectedStep =
    steps.find((s) => s.uiKey === selectedKey) ?? steps[0] ?? null
  const selectedIdx = selectedStep
    ? steps.findIndex((s) => s.uiKey === selectedStep.uiKey)
    : -1
  const stepCount = steps.length
  const completedCount = steps.filter((s) => s.completed).length

  const onAdd = (optionId: string) => {
    markDirty(adapter.applyAddStep(draft, optionId))
  }
  const onRemove = (step: EditorStep) => {
    if (step.locked) return
    markDirty(adapter.applyRemoveStep(draft, step))
    if (selectedKey === step.uiKey) setSelectedKey(null)
    if (expandedKey === step.uiKey) setExpandedKey(null)
  }
  const addOptions = adapter.addStepOptions(draft)
  const variables = adapter.variables ? adapter.variables(draft) : []

  // ─── Drawer mode ──────────────────────────────────────────────────────
  if (mode === 'drawer') {
    return (
      <ShellChrome
        mode="drawer"
        title={meta.title}
        onClose={onClose}
        onChangeMode={onChangeMode}
        accent={meta.accent ?? 'violet'}
        versionLabel={meta.versionLabel ?? null}
      >
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Steg</p>
          {steps.map((s, i) => (
            <StepCardCollapsible
              key={s.uiKey}
              step={s}
              index={i + 1}
              expanded={expandedKey === s.uiKey}
              canEdit={canEdit}
              onToggle={() => setExpandedKey((prev) => (prev === s.uiKey ? null : s.uiKey))}
              onRemove={() => onRemove(s)}
            >
              {adapter.renderStepDetail(s, draft, markDirty)}
            </StepCardCollapsible>
          ))}
          {canEdit && addOptions.length > 0 && (
            <AddStepMenu options={addOptions} onAdd={onAdd} />
          )}
        </div>
        <ShellFooter
          mode="drawer"
          canEdit={canEdit}
          save={save}
          saveError={saveError}
          publishing={publishing}
          publishOk={publishOk}
          publishError={publishError}
          onCancel={onClose}
          onCloseSafe={() => void onCloseSafe()}
          onPublish={() => void onPublish()}
        />
      </ShellChrome>
    )
  }

  // ─── Fullscreen mode ──────────────────────────────────────────────────
  return (
    <ShellChrome
      mode="fullscreen"
      title={meta.title}
      onClose={onClose}
      onChangeMode={onChangeMode}
      accent={meta.accent ?? 'violet'}
      versionLabel={meta.versionLabel ?? null}
    >
      <FullscreenLayout
        meta={meta}
        steps={steps}
        selectedStep={selectedStep}
        onSelect={(k) => setSelectedKey(k)}
        stepCount={stepCount}
        completedCount={completedCount}
        canEdit={canEdit}
        addOptions={addOptions}
        onAdd={onAdd}
        onRemove={onRemove}
        renderDetail={() =>
          selectedStep && adapter.renderStepDetail(selectedStep, draft, markDirty)
        }
        variables={variables}
        save={save}
        saveError={saveError}
        publishing={publishing}
        publishOk={publishOk}
        publishError={publishError}
        canPublish={canEdit}
        onPublish={() => void onPublish()}
        onPrev={() => {
          if (selectedIdx > 0) setSelectedKey(steps[selectedIdx - 1].uiKey)
        }}
        onNext={() => {
          if (selectedIdx >= 0 && selectedIdx < steps.length - 1) {
            setSelectedKey(steps[selectedIdx + 1].uiKey)
          }
        }}
      />
    </ShellChrome>
  )
}

// ─── Chrome ───────────────────────────────────────────────────────────────

type ShellChromeProps = {
  mode: EditorMode
  title: string
  onClose: () => void
  onChangeMode: (next: EditorMode) => void
  accent: EditorStepAccent
  versionLabel: string | null
  children: ReactNode
}

function splitFooter(children: ReactNode): { body: ReactNode; footer: ReactNode | null } {
  const arr = Children.toArray(children)
  const footerIdx = arr.findIndex((c) => isValidElement(c) && (c.type as { displayName?: string }).displayName === 'ShellFooter')
  if (footerIdx === -1) return { body: arr, footer: null }
  return {
    body: arr.slice(0, footerIdx),
    footer: arr[footerIdx],
  }
}

function ShellChrome({ mode, title, onClose, onChangeMode, accent, versionLabel, children }: ShellChromeProps) {
  const { body, footer } = splitFooter(children)
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
          aria-label="Rediger mal"
          className="flex h-full w-full max-w-[min(100vw,640px)] flex-col bg-[#faf9f5] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200 bg-[#faf9f5] px-6 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_BG[accent]}`}>
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Rediger mal
                </p>
                <h2 className="truncate text-lg font-semibold text-neutral-900">{title}</h2>
                {versionLabel && (
                  <p className="mt-0.5 text-[11px] text-neutral-500">{versionLabel}</p>
                )}
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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{body}</div>
          {footer}
        </aside>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[1100] flex flex-col bg-[#faf9f5]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-[#faf9f5] px-8 py-3">
        <nav className="flex items-center gap-2 text-sm text-neutral-500" aria-label="Brødsmuler">
          <span className="font-semibold text-neutral-900">Klarert</span>
          <span className="text-neutral-400">Studio</span>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
          <span>Maler</span>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
          <span className="truncate font-medium text-neutral-700">{title}</span>
        </nav>
        <div className="flex items-center gap-2">
          {versionLabel && (
            <span className="text-[11px] text-neutral-500">{versionLabel}</span>
          )}
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
      <div className="min-h-0 flex-1 overflow-hidden">{body}</div>
    </div>
  )
}

// ─── Step card (drawer mode) ─────────────────────────────────────────────

function StepCardCollapsible({
  step,
  index,
  expanded,
  canEdit,
  onToggle,
  onRemove,
  children,
}: {
  step: EditorStep
  index: number
  expanded: boolean
  canEdit: boolean
  onToggle: () => void
  onRemove: () => void
  children: ReactNode
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
          {children}
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
  options,
  onAdd,
}: {
  options: { id: string; label: string; hint?: string }[]
  onAdd: (id: string) => void
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
          {options.map((opt) => (
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
              <span className="flex flex-col items-start">
                <span>{opt.label}</span>
                {opt.hint && <span className="text-[11px] text-neutral-500">{opt.hint}</span>}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Footer (drawer + metadata-only) ──────────────────────────────────────

type ShellFooterProps = {
  mode: EditorMode
  canEdit: boolean
  save: SaveState
  saveError: string | null
  publishing: boolean
  publishOk: boolean
  publishError: string | null
  onCancel: () => void
  onCloseSafe: () => void
  onPublish: () => void
}

function ShellFooter({
  mode,
  canEdit,
  save,
  saveError,
  publishing,
  publishOk,
  publishError,
  onCancel,
  onCloseSafe,
  onPublish,
}: ShellFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-neutral-200 bg-[#faf9f5] px-6 py-3">
      {publishError && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">{publishError}</p>
      )}
      {publishOk && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Publisert. Endringene er nå live.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <SaveIndicator save={save} saveError={saveError} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Avbryt
          </Button>
          <Button variant="ghost" onClick={onCloseSafe}>
            {mode === 'drawer' ? 'Lagre & lukk' : 'Lukk'}
          </Button>
          {canEdit && (
            <Button variant="primary" onClick={onPublish} disabled={publishing}>
              {publishing ? 'Publiserer …' : 'Publiser'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
ShellFooter.displayName = 'ShellFooter'

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
  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
      Klar
    </span>
  )
}

// ─── Fullscreen layout ────────────────────────────────────────────────────

type FullscreenProps = {
  meta: AdapterMeta
  steps: EditorStep[]
  selectedStep: EditorStep | null
  onSelect: (key: string) => void
  stepCount: number
  completedCount: number
  canEdit: boolean
  addOptions: { id: string; label: string; hint?: string }[]
  onAdd: (id: string) => void
  onRemove: (step: EditorStep) => void
  renderDetail: () => ReactNode
  variables: string[]
  save: SaveState
  saveError: string | null
  publishing: boolean
  publishOk: boolean
  publishError: string | null
  canPublish: boolean
  onPublish: () => void
  onPrev: () => void
  onNext: () => void
}

function FullscreenLayout({
  meta,
  steps,
  selectedStep,
  onSelect,
  stepCount,
  completedCount,
  canEdit,
  addOptions,
  onAdd,
  onRemove,
  renderDetail,
  variables,
  save,
  saveError,
  publishing,
  publishOk,
  publishError,
  canPublish,
  onPublish,
  onPrev,
  onNext,
}: FullscreenProps) {
  const selectedIdx = selectedStep ? steps.findIndex((s) => s.uiKey === selectedStep.uiKey) : -1
  const prev = selectedIdx > 0 ? steps[selectedIdx - 1] : null
  const next = selectedIdx >= 0 && selectedIdx < steps.length - 1 ? steps[selectedIdx + 1] : null
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[360px_1fr]">
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-[#f5f3ec] px-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{meta.title}</h1>
          {meta.subtitle ? (
            <p className="mt-1 text-sm text-neutral-600">{meta.subtitle}</p>
          ) : (
            <p className="mt-1 text-sm text-neutral-600">
              Steg til venstre — velg ett for å redigere detaljene til høyre.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span className="font-semibold uppercase tracking-wider">Steg · {stepCount}</span>
          <span>{completedCount} fullført</span>
        </div>
        <ol className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.uiKey}>
              <StepRowFull
                step={s}
                index={i + 1}
                active={!!selectedStep && s.uiKey === selectedStep.uiKey}
                onClick={() => onSelect(s.uiKey)}
              />
            </li>
          ))}
        </ol>
        {canEdit && addOptions.length > 0 && (
          <AddStepMenu options={addOptions} onAdd={onAdd} />
        )}
        <div className="mt-auto space-y-1 pt-4 text-[11px] text-neutral-500">
          {meta.versionLabel && <p>{meta.versionLabel}</p>}
          {(meta.lawRefs ?? []).length > 0 && (
            <p className="truncate">{(meta.lawRefs ?? []).join(', ')}</p>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-y-auto bg-[#fbfaf6] px-8 py-6">
        {selectedStep ? (
          <DetailPanel
            step={selectedStep}
            renderFields={renderDetail}
            onRemove={() => onRemove(selectedStep)}
            canEdit={canEdit}
            variables={variables}
          />
        ) : (
          <p className="text-sm text-neutral-500">Velg et steg fra listen.</p>
        )}

        <div className="mt-6 flex flex-col gap-2 border-t border-neutral-200 pt-4">
          {publishError && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">{publishError}</p>
          )}
          {publishOk && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Publisert. Endringene er nå live.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={onPrev}
                disabled={!prev}
                icon={<ChevronLeft className="h-4 w-4" />}
              >
                Forrige {prev ? `(${prev.title})` : ''}
              </Button>
              <Button variant="ghost" onClick={onNext} disabled={!next}>
                Neste {next ? `(${next.title})` : ''} <ChevronRight className="ml-1 inline h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <SaveIndicator save={save} saveError={saveError} />
              {canPublish && (
                <Button variant="primary" onClick={onPublish} disabled={publishing}>
                  {publishing ? 'Publiserer …' : 'Publiser'}
                </Button>
              )}
            </div>
          </div>
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
  renderFields,
  onRemove,
  canEdit,
  variables,
}: {
  step: EditorStep
  renderFields: () => ReactNode
  onRemove: () => void
  canEdit: boolean
  variables: string[]
}) {
  const Icon = step.icon
  const headerLabel =
    step.kind === 'trigger'
      ? 'UTLØSER'
      : step.kind === 'condition'
        ? 'BETINGELSE'
        : step.kind === 'logic'
          ? 'LOGIKK'
          : step.kind === 'section'
            ? 'SEKSJON'
            : step.kind === 'item'
              ? 'PUNKT'
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Slett steg"
            onClick={onRemove}
            className="rounded-md text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">{renderFields()}</div>

      {variables.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Tilgjengelige variabler
          </span>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <span
                key={v}
                className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-700"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

