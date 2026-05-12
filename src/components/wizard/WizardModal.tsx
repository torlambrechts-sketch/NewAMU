import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import type { WizardDef, WizardField } from './types'

// ─── Colour map ───────────────────────────────────────────────────────────────

const ACCENT: Record<
  string,
  { ring: string; bg: string; text: string; btn: string; progress: string }
> = {
  red:     { ring: 'ring-red-200',     bg: 'bg-red-50',     text: 'text-red-700',     btn: 'bg-red-600 hover:bg-red-700',     progress: 'bg-red-500' },
  amber:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-800',   btn: 'bg-amber-600 hover:bg-amber-700', progress: 'bg-amber-500' },
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', btn: 'bg-emerald-700 hover:bg-emerald-800', progress: 'bg-emerald-600' },
  sky:     { ring: 'ring-sky-200',     bg: 'bg-sky-50',     text: 'text-sky-800',     btn: 'bg-sky-600 hover:bg-sky-700',     progress: 'bg-sky-500' },
  purple:  { ring: 'ring-purple-200',  bg: 'bg-purple-50',  text: 'text-purple-800',  btn: 'bg-purple-600 hover:bg-purple-700', progress: 'bg-purple-500' },
  neutral: { ring: 'ring-neutral-200', bg: 'bg-neutral-50', text: 'text-neutral-700', btn: 'bg-[#1a3d32] hover:bg-[#142e26]', progress: 'bg-[#1a3d32]' },
}

const FOREST = '#1a3d32'
const SERIF = "'Libre Baskerville', Georgia, serif"

// ─── Individual field renderer ────────────────────────────────────────────────

function WizardFieldRenderer({
  field,
  value,
  onChange,
  accent,
}: {
  field: WizardField
  value: string | boolean
  onChange: (v: string | boolean) => void
  accent: (typeof ACCENT)[string]
}) {
  const baseInput = `block w-full rounded-none border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900`

  if (field.kind === 'info') {
    return (
      <div className={`border ${accent.ring} ${accent.bg} px-4 py-3`}>
        <p
          className={`text-sm leading-relaxed ${accent.text}`}
          dangerouslySetInnerHTML={{ __html: field.infoBody ?? '' }}
        />
      </div>
    )
  }

  if (field.kind === 'severity') {
    const opts = [
      { value: 'low',      label: 'Lav',     dot: 'bg-emerald-500', desc: 'Liten konsekvens, lav sannsynlighet' },
      { value: 'medium',   label: 'Middels', dot: 'bg-amber-500',   desc: 'Moderat konsekvens eller sannsynlighet' },
      { value: 'high',     label: 'Høy',     dot: 'bg-red-500',     desc: 'Alvorlig konsekvens og/eller høy sannsynlighet' },
      { value: 'critical', label: 'Kritisk', dot: 'bg-red-700',     desc: 'Umiddelbar fare for liv eller helse' },
    ]
    return (
      <div className="grid grid-cols-2 gap-2">
        {opts.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex items-start gap-3 border p-3 text-left transition-all ${
                selected
                  ? 'border-[#1a3d32] bg-[#1a3d32]/5 ring-1 ring-[#1a3d32]'
                  : 'border-neutral-300 bg-white hover:border-neutral-400'
              }`}
            >
              <span className={`mt-1 size-3 shrink-0 rounded-full ${opt.dot}`} />
              <div>
                <div className="text-sm font-semibold text-neutral-900">{opt.label}</div>
                <div className="mt-0.5 text-xs text-neutral-500">{opt.desc}</div>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  if (field.kind === 'radio-cards') {
    return (
      <div className="grid gap-2">
        {(field.options ?? []).map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-3 border p-3 text-left transition-all ${
                selected
                  ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                  : 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-400'
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                  selected ? 'border-white bg-[#1a3d32]' : 'border-neutral-300 bg-white'
                }`}
              >
                {selected ? <Check className="size-3 text-white" /> : null}
              </span>
              {opt.icon ? <span className="text-base">{opt.icon}</span> : null}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{opt.label}</div>
                {opt.description ? (
                  <div className={`mt-0.5 text-xs ${selected ? 'text-white/80' : 'text-neutral-500'}`}>
                    {opt.description}
                  </div>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // Yes/No tokort — speiler Vanta/Greenhouse-mønsteret i screenshot.
  if (field.kind === 'checkbox') {
    const checked = value === true || value === 'true'
    const Btn = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-3 border px-4 py-3 text-left transition-all ${
          active
            ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
            : 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-400'
        }`}
      >
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
            active ? 'border-white' : 'border-neutral-300'
          }`}
        >
          {active ? <Check className="size-3 text-white" /> : null}
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </button>
    )
    return (
      <div className="grid grid-cols-2 gap-2">
        <Btn active={checked} label="Ja" onClick={() => onChange(true)} />
        <Btn active={!checked} label="Nei" onClick={() => onChange(false)} />
      </div>
    )
  }

  if (field.kind === 'checkbox-group') {
    const selected: string[] =
      value && typeof value === 'string' ? (JSON.parse(value || '[]') as string[]) : []
    return (
      <div className="space-y-2">
        {(field.options ?? []).map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-3 border border-neutral-300 bg-white px-3 py-2.5 hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt.value]
                  : selected.filter((v) => v !== opt.value)
                onChange(JSON.stringify(next))
              }}
              className="size-4"
              style={{ accentColor: FOREST }}
            />
            <div>
              <span className="text-sm font-medium text-neutral-900">{opt.label}</span>
              {opt.description ? (
                <p className="text-xs text-neutral-500">{opt.description}</p>
              ) : null}
            </div>
          </label>
        ))}
      </div>
    )
  }

  if (field.kind === 'module_picker') {
    const selected: string[] =
      value && typeof value === 'string' ? (JSON.parse(value || '[]') as string[]) : []
    const opts = field.options ?? []
    if (opts.length === 0) {
      return (
        <div className="border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
          {field.emptyHint ?? 'Ingen kandidater funnet for dette kravet ennå.'}
        </div>
      )
    }
    const groups = new Map<string, typeof opts>()
    for (const o of opts) {
      const g = o.group ?? 'Annet'
      const list = groups.get(g) ?? []
      list.push(o)
      groups.set(g, list)
    }
    const toggle = (val: string) => {
      const next = selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
      onChange(JSON.stringify(next))
    }
    return (
      <div className="space-y-3">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group} className="border border-neutral-300 bg-white">
            <p className="border-b border-neutral-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              {group} · {items.length}
            </p>
            <ul>
              {items.map((opt) => {
                const checked = selected.includes(opt.value)
                return (
                  <li key={opt.value} className="border-b border-neutral-100 last:border-b-0">
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(opt.value)}
                        className="mt-0.5 size-4"
                        style={{ accentColor: FOREST }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-neutral-900">
                            {opt.label}
                          </span>
                          {opt.badge ? (
                            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700">
                              {opt.badge}
                            </span>
                          ) : null}
                        </div>
                        {opt.description ? (
                          <p className="text-xs text-neutral-500">{opt.description}</p>
                        ) : null}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <select
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        className={baseInput}
      >
        {!field.required && <option value="">— Velg —</option>}
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.kind === 'textarea') {
    return (
      <textarea
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className={baseInput}
        required={field.required}
      />
    )
  }

  return (
    <input
      type={field.kind === 'text' ? 'text' : field.kind}
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      min={field.min as string | undefined}
      max={field.max as string | undefined}
      className={baseInput}
      required={field.required}
    />
  )
}

// ─── Step rail (right side, numbered list) ────────────────────────────────────

function StepRail({
  steps,
  currentIndex,
  onJump,
}: {
  steps: { id: string; title: string }[]
  currentIndex: number
  onJump: (idx: number) => void
}) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const isCurrent = i === currentIndex
        const isPast = i < currentIndex
        const numberCls = isPast
          ? 'bg-[#1a3d32] text-white'
          : isCurrent
            ? 'border-2 border-[#1a3d32] bg-white text-[#1a3d32]'
            : 'border border-neutral-300 bg-white text-neutral-500'
        const labelCls = isCurrent
          ? 'font-semibold text-neutral-900'
          : isPast
            ? 'text-neutral-700'
            : 'text-neutral-400'
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => (i <= currentIndex ? onJump(i) : undefined)}
              disabled={i > currentIndex}
              className="flex w-full items-center gap-3 text-left disabled:cursor-default"
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${numberCls}`}
              >
                {isPast ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={`text-sm ${labelCls}`}>{s.title}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export type WizardModalProps = {
  def: WizardDef
  onClose: () => void
  initialValues?: Record<string, string | boolean>
  initialStep?: number
  onStepChange?: (nextStepIndex: number, values: Record<string, string | boolean>) => void
}

export function WizardModal({
  def,
  onClose,
  initialValues,
  initialStep,
  onStepChange,
}: WizardModalProps) {
  const [stepIndex, setStepIndex] = useState(initialStep ?? 0)
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues ?? {})
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const colour = def.colour ?? 'neutral'
  const accent = ACCENT[colour]

  const step = def.steps[stepIndex]
  const totalSteps = def.steps.length
  const isLast = stepIndex === totalSteps - 1

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function setField(id: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [id]: v }))
    setError(null)
  }

  function getField(id: string): string | boolean {
    return values[id] ?? ''
  }

  function visibleFields(fields: WizardField[]) {
    return fields.filter((f) => !f.showWhen || f.showWhen(values))
  }

  async function handleNext() {
    if (advancing) return
    const missing = visibleFields(step.fields).filter(
      (f) =>
        f.required &&
        f.kind !== 'checkbox' &&
        f.kind !== 'info' &&
        !getField(f.id),
    )
    if (missing.length > 0) {
      setError(`Vennligst fyll inn: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    if (step.validate) {
      const err = step.validate(values)
      if (err) {
        setError(err)
        return
      }
    }
    setError(null)

    if (step.onAdvance) {
      setAdvancing(true)
      try {
        const result = await step.onAdvance(values)
        if (!result.ok) {
          setError(result.error)
          return
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Noe gikk galt under bekreftelse.')
        return
      } finally {
        setAdvancing(false)
      }
    }

    if (isLast) {
      def.onSubmit(values)
      onStepChange?.(stepIndex + 1, values)
      setDone(true)
    } else {
      const next = stepIndex + 1
      onStepChange?.(next, values)
      setStepIndex(next)
    }
  }

  function handleBack() {
    setError(null)
    setStepIndex((i) => Math.max(0, i - 1))
  }

  if (done) {
    return (
      <div
        ref={overlayRef}
        onMouseDown={(e) => {
          if (e.target === overlayRef.current) onClose()
        }}
        className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
      >
        <div
          className="flex h-full w-full max-w-[min(100vw,1100px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-9 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: SERIF }}>
              Fullført!
            </h2>
            <p className="max-w-md text-sm text-neutral-600">
              {def.description ?? `${def.title} er registrert.`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-[#1a3d32] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#142e26]"
            >
              Lukk
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
    >
      <div
        className="relative flex h-full w-full max-w-[min(100vw,1100px)] flex-col overflow-hidden bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {step.icon ? <span className="mr-1.5">{step.icon}</span> : null}
              Trinn {stepIndex + 1} av {totalSteps}
            </div>
            <h2
              className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              {def.title}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {step.title}
              {step.subtitle ? <span className="text-neutral-400"> · {step.subtitle}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800"
            aria-label="Lukk"
          >
            <X className="size-6" />
          </button>
        </header>

        {/* ── Body: form (left) + step rail (right) ───────────────────── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-h-0 overflow-y-auto">
            {visibleFields(step.fields).map((field) => {
              const isInfo = field.kind === 'info'
              const isCheckbox = field.kind === 'checkbox'
              const isStandalone = isInfo // info spenner hele bredden uten venstre-spørsmål
              const leftPrompt = field.prompt ?? (isCheckbox ? field.label : field.label)
              const showLabelTag = !!field.prompt && !isCheckbox && !isInfo

              if (isStandalone) {
                return (
                  <div
                    key={field.id}
                    className="border-b border-neutral-200/80 px-6 py-5 last:border-b-0 sm:px-8"
                  >
                    <WizardFieldRenderer
                      field={field}
                      value={getField(field.id)}
                      onChange={(v) => setField(field.id, v)}
                      accent={accent}
                    />
                  </div>
                )
              }

              return (
                <div
                  key={field.id}
                  className="grid grid-cols-1 gap-4 border-b border-neutral-200/80 px-6 py-5 last:border-b-0 sm:px-8 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10"
                >
                  <div>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {leftPrompt}
                      {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                    </p>
                    {field.hint ? (
                      <p className="mt-1 text-xs text-neutral-500">{field.hint}</p>
                    ) : null}
                  </div>
                  <div>
                    {showLabelTag ? (
                      <label
                        htmlFor={field.id}
                        className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-neutral-800"
                      >
                        {field.label}
                      </label>
                    ) : null}
                    <WizardFieldRenderer
                      field={field}
                      value={getField(field.id)}
                      onChange={(v) => setField(field.id, v)}
                      accent={accent}
                    />
                  </div>
                </div>
              )
            })}

            {error ? (
              <div className="mx-6 mb-5 mt-2 flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 sm:mx-8">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            ) : null}
          </div>

          <aside className="hidden border-l border-neutral-200/80 bg-[#f0efe9] px-5 py-6 lg:block">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Trinn
            </p>
            <StepRail
              steps={def.steps.map((s) => ({ id: s.id, title: s.title }))}
              currentIndex={stepIndex}
              onJump={(i) => setStepIndex(i)}
            />
          </aside>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-4 sm:px-8">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ChevronLeft className="size-4" />
              Tilbake
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-800"
            >
              Avbryt
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={advancing}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ${accent.btn}`}
          >
            {advancing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {step.advancingLabel ?? 'Lagrer …'}
              </>
            ) : isLast ? (
              <>
                <CheckCircle2 className="size-4" />
                {def.steps[stepIndex].id === 'confirm' ? 'Bekreft og lagre' : 'Lagre'}
              </>
            ) : (
              <>
                Neste
                <ChevronRight className="size-4" />
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}
