/**
 * CRUD dialogs for <OKRDashboard editable />.
 *
 * - <OKRModal>             — generic centred modal shell.
 * - <ObjectiveDialog>      — create / edit objective (title, description, owner).
 * - <KeyResultDialog>      — create / edit KR (title, progress, confidence, target, current).
 * - <ConfirmDeleteDialog>  — destructive-confirm with cascade hint for objectives.
 * - <ConfidencePicker>     — segmented 3-button selector (emerald / amber / rose).
 * - <ProgressInput>        — range slider + number input bound to the same value.
 *
 * All dialogs use the same workplace tokens as the rest of the page
 * (rounded-xl, cream header band, forest accent, Libre Baskerville).
 */
import { useEffect, useId, useState, type FormEvent } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { WORKPLACE_PAGE_SERIF } from '../layout/WorkplacePageHeading1'
import {
  CONFIDENCE_BG,
  CONFIDENCE_LABEL,
  type Confidence,
  type KeyResult,
  type Objective,
  type OKROwner,
} from './types'

/* ── Modal shell ──────────────────────────────────────────────────────────── */

export function OKRModal({
  open,
  onClose,
  title,
  children,
  footer,
  /** Slight tone shift for destructive actions. */
  tone = 'default',
  labelledById,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
  tone?: 'default' | 'danger'
  labelledById?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
    >
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-neutral-900/35 backdrop-blur-[2px]"
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
        <header
          className={`flex items-start justify-between gap-3 border-b border-neutral-200/80 px-5 py-4 ${
            tone === 'danger' ? 'bg-rose-50' : 'bg-[#FBF8F1]'
          }`}
        >
          <h3
            id={labelledById}
            className="text-lg font-semibold tracking-tight text-neutral-900"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {title}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Lukk"
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200/80 bg-neutral-50 px-5 py-3">
          {footer}
        </footer>
      </div>
    </div>
  )
}

/* ── Field helpers ────────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-600">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </label>
  )
}

/* ── Confidence + Progress controls ───────────────────────────────────────── */

export function ConfidencePicker({
  value,
  onChange,
}: {
  value: Confidence
  onChange: (next: Confidence) => void
}) {
  const tiers: Confidence[] = ['on_track', 'at_risk', 'off_track']
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {tiers.map((c) => {
        const active = value === c
        return (
          <Button
            key={c}
            type="button"
            variant={active ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onChange(c)}
            aria-pressed={active}
            className={
              active
                ? `${CONFIDENCE_BG[c]} border-transparent text-white hover:brightness-95`
                : ''
            }
          >
            {CONFIDENCE_LABEL[c]}
          </Button>
        )
      })}
    </div>
  )
}

export function ProgressInput({
  value,
  confidence,
  onChange,
}: {
  value: number
  confidence: Confidence
  onChange: (next: number) => void
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n))
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <StandardInput
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className={`h-1.5 w-full appearance-none rounded-full bg-neutral-200 ${CONFIDENCE_BG[confidence]}/0`}
          aria-label="Fremdrift"
        />
      </div>
      <StandardInput
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(0)
            return
          }
          onChange(clamp(Number(raw)))
        }}
        className="w-20 text-right font-mono tabular-nums"
        aria-label="Fremdrift i prosent"
      />
      <span className="text-xs text-neutral-500">%</span>
    </div>
  )
}

/* ── Objective dialog ─────────────────────────────────────────────────────── */

export type ObjectiveDialogMode =
  | { kind: 'create' }
  | { kind: 'edit'; objective: Objective }

export type ObjectiveFormPayload = {
  title: string
  description: string
  owner: OKROwner
}

export function ObjectiveDialog({
  open,
  mode,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: ObjectiveDialogMode
  onClose: () => void
  onSubmit: (payload: ObjectiveFormPayload) => void
}) {
  // Re-mount the form whenever the dialog opens with a different mode so
  // useState initialisers pick up the right starting values — avoids the
  // react-hooks/set-state-in-effect anti-pattern.
  if (!open) return null
  return (
    <ObjectiveDialogInner
      key={objectiveDialogKey(mode)}
      mode={mode}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function objectiveDialogKey(mode: ObjectiveDialogMode) {
  return mode.kind === 'edit' ? `edit:${mode.objective.id}` : 'create'
}

function ObjectiveDialogInner({
  mode,
  onClose,
  onSubmit,
}: {
  mode: ObjectiveDialogMode
  onClose: () => void
  onSubmit: (payload: ObjectiveFormPayload) => void
}) {
  const titleId = useId()
  const [title, setTitle] = useState(
    mode.kind === 'edit' ? mode.objective.title : '',
  )
  const [description, setDescription] = useState(
    mode.kind === 'edit' ? (mode.objective.description ?? '') : '',
  )
  const [ownerName, setOwnerName] = useState(
    mode.kind === 'edit' ? mode.objective.owner.name : '',
  )
  const [touched, setTouched] = useState(false)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    setTouched(true)
    if (!title.trim() || !ownerName.trim()) return
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      owner: { name: ownerName.trim() },
    })
  }

  const titleMissing = touched && !title.trim()
  const ownerMissing = touched && !ownerName.trim()

  return (
    <OKRModal
      open
      onClose={onClose}
      labelledById={titleId}
      title={
        <span id={titleId}>
          {mode.kind === 'create' ? 'Nytt mål' : 'Rediger mål'}
        </span>
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="primary" onClick={() => submit()}>
            {mode.kind === 'create' ? 'Opprett mål' : 'Lagre endringer'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tittel">
          <StandardInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Eks. Bli foretrukket HMS-plattform i Norden"
            autoFocus
            aria-invalid={titleMissing || undefined}
          />
          {titleMissing ? (
            <p className="mt-1 text-xs text-rose-600">Tittel er påkrevd.</p>
          ) : null}
        </Field>

        <Field label="Beskrivelse" hint="Valgfri — kort kontekst, ikke fullsetning.">
          <StandardTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Eks. Etablere Klarert som det åpenbare valget…"
          />
        </Field>

        <Field label="Eier">
          <StandardInput
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Fornavn Etternavn"
            aria-invalid={ownerMissing || undefined}
          />
          {ownerMissing ? (
            <p className="mt-1 text-xs text-rose-600">Eier er påkrevd.</p>
          ) : null}
        </Field>
      </form>
    </OKRModal>
  )
}

/* ── Key result dialog ────────────────────────────────────────────────────── */

export type KeyResultDialogMode =
  | { kind: 'create'; objectiveTitle: string }
  | { kind: 'edit'; kr: KeyResult; objectiveTitle: string }

export type KeyResultFormPayload = {
  title: string
  progress: number
  confidence: Confidence
  target?: string
  current?: string
  progressMode: 'manual' | 'task_rollup'
}

export function KeyResultDialog({
  open,
  mode,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: KeyResultDialogMode
  onClose: () => void
  onSubmit: (payload: KeyResultFormPayload) => void
}) {
  if (!open) return null
  return (
    <KeyResultDialogInner
      key={keyResultDialogKey(mode)}
      mode={mode}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function keyResultDialogKey(mode: KeyResultDialogMode) {
  return mode.kind === 'edit' ? `edit:${mode.kr.id}` : `create:${mode.objectiveTitle}`
}

function KeyResultDialogInner({
  mode,
  onClose,
  onSubmit,
}: {
  mode: KeyResultDialogMode
  onClose: () => void
  onSubmit: (payload: KeyResultFormPayload) => void
}) {
  const titleId = useId()
  const [title, setTitle] = useState(mode.kind === 'edit' ? mode.kr.title : '')
  const [progress, setProgress] = useState(mode.kind === 'edit' ? mode.kr.progress : 0)
  const [confidence, setConfidence] = useState<Confidence>(
    mode.kind === 'edit' ? mode.kr.confidence : 'on_track',
  )
  const [current, setCurrent] = useState(
    mode.kind === 'edit' ? (mode.kr.current ?? '') : '',
  )
  const [target, setTarget] = useState(
    mode.kind === 'edit' ? (mode.kr.target ?? '') : '',
  )
  const [progressMode, setProgressMode] = useState<'manual' | 'task_rollup'>(
    mode.kind === 'edit' ? (mode.kr.progressMode ?? 'manual') : 'manual',
  )
  const [touched, setTouched] = useState(false)

  const rollupDisabled = mode.kind === 'edit' ? Boolean(mode.kr.rollupDisabled) : false
  const isRollup = progressMode === 'task_rollup'

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    setTouched(true)
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      progress: Math.max(0, Math.min(100, progress)),
      confidence,
      current: current.trim() || undefined,
      target: target.trim() || undefined,
      progressMode,
    })
  }

  const titleMissing = touched && !title.trim()

  return (
    <OKRModal
      open
      onClose={onClose}
      labelledById={titleId}
      title={
        <span id={titleId}>
          {mode.kind === 'create' ? 'Nytt key result' : 'Rediger key result'}
        </span>
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="primary" onClick={() => submit()}>
            {mode.kind === 'create' ? 'Legg til KR' : 'Lagre endringer'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-xs text-neutral-500">
        Knyttes til <span className="font-medium text-neutral-700">{mode.objectiveTitle}</span>
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tittel">
          <StandardInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Eks. Nå NPS ≥ 55 blant aktive HMS-brukere"
            autoFocus
            aria-invalid={titleMissing || undefined}
          />
          {titleMissing ? (
            <p className="mt-1 text-xs text-rose-600">Tittel er påkrevd.</p>
          ) : null}
        </Field>

        <Field
          label="Fremdriftskilde"
          hint={
            rollupDisabled
              ? 'Beregning fra oppgaver støtter ikke «lavere = bedre»-mål. Bruk manuell.'
              : isRollup
                ? 'Fremdriften beregnes fra andelen koblede oppgaver som er fullført.'
                : 'Manuell — sett fremdrift selv.'
          }
        >
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={!isRollup ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={!isRollup}
              onClick={() => setProgressMode('manual')}
            >
              Manuell
            </Button>
            <Button
              type="button"
              variant={isRollup ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={isRollup}
              disabled={rollupDisabled}
              onClick={() => setProgressMode('task_rollup')}
            >
              Fra oppgaver
            </Button>
          </div>
        </Field>

        {!isRollup ? (
          <Field label="Fremdrift">
            <ProgressInput
              value={progress}
              confidence={confidence}
              onChange={setProgress}
            />
          </Field>
        ) : null}

        <Field label="Tillit">
          <ConfidencePicker value={confidence} onChange={setConfidence} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nå-verdi" hint={isRollup ? 'Beregnes fra oppgaver' : 'Valgfri'}>
            <StandardInput
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="47"
              disabled={isRollup}
            />
          </Field>
          <Field label="Mål-verdi" hint="Valgfri">
            <StandardInput
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="55"
            />
          </Field>
        </div>
      </form>
    </OKRModal>
  )
}

/* ── Confirm delete ───────────────────────────────────────────────────────── */

export function ConfirmDeleteDialog({
  open,
  title,
  body,
  confirmLabel = 'Slett',
  onClose,
  onConfirm,
}: {
  open: boolean
  title: React.ReactNode
  body: React.ReactNode
  confirmLabel?: string
  onClose: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  return (
    <OKRModal
      open={open}
      onClose={onClose}
      tone="danger"
      labelledById={titleId}
      title={<span id={titleId}>{title}</span>}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <div className="text-sm text-neutral-700">{body}</div>
      </div>
    </OKRModal>
  )
}
