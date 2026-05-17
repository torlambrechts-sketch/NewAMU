import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { SearchableSelect } from '../ui/SearchableSelect'
import { ToggleSwitch } from '../ui/FormToggles'
import type { WizardDef, WizardField } from './types'

// ─── Colour map ───────────────────────────────────────────────────────────────

const ACCENT: Record<string, { ring: string; bg: string; text: string; btn: string; progress: string }> = {
  red:     { ring: 'ring-red-200',     bg: 'bg-red-50',     text: 'text-red-700',     btn: 'bg-red-600 hover:bg-red-700',     progress: 'bg-red-500' },
  amber:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-800',   btn: 'bg-amber-600 hover:bg-amber-700', progress: 'bg-amber-500' },
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', btn: 'bg-emerald-700 hover:bg-emerald-800', progress: 'bg-emerald-600' },
  sky:     { ring: 'ring-sky-200',     bg: 'bg-sky-50',     text: 'text-sky-800',     btn: 'bg-sky-600 hover:bg-sky-700',     progress: 'bg-sky-500' },
  purple:  { ring: 'ring-purple-200',  bg: 'bg-purple-50',  text: 'text-purple-800',  btn: 'bg-purple-600 hover:bg-purple-700', progress: 'bg-purple-500' },
  neutral: { ring: 'ring-neutral-200', bg: 'bg-neutral-50', text: 'text-neutral-700', btn: 'bg-[#1a3d32] hover:bg-[#142e26]', progress: 'bg-[#1a3d32]' },
}

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
  const baseInput = `mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${accent.ring} focus:border-transparent transition-shadow`

  if (field.kind === 'info') {
    return (
      <div className={`rounded-xl border ${accent.ring} ${accent.bg} px-4 py-3`}>
        <p className={`text-sm ${accent.text}`} dangerouslySetInnerHTML={{ __html: field.infoBody ?? '' }} />
      </div>
    )
  }

  if (field.kind === 'severity') {
    const opts = [
      { value: 'low',      label: 'Lav',     colour: 'border-emerald-300 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500', desc: 'Liten konsekvens, lav sannsynlighet' },
      { value: 'medium',   label: 'Middels', colour: 'border-amber-300 bg-amber-50 text-amber-800',       dot: 'bg-amber-500',   desc: 'Moderat konsekvens eller sannsynlighet' },
      { value: 'high',     label: 'Høy',     colour: 'border-red-300 bg-red-50 text-red-800',             dot: 'bg-red-500',     desc: 'Alvorlig konsekvens og/eller høy sannsynlighet' },
      { value: 'critical', label: 'Kritisk', colour: 'border-red-600 bg-red-700 text-white',              dot: 'bg-white',       desc: 'Umiddelbar fare for liv eller helse' },
    ]
    return (
      <div className="grid grid-cols-2 gap-2 mt-1">
        {opts.map((opt) => (
          <Button
            key={opt.value}
            variant="ghost"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left font-normal ${
              value === opt.value ? `${opt.colour} ring-2 ring-offset-1 ring-current shadow-sm` : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-white'
            }`}
          >
            <span className={`mt-0.5 size-3 shrink-0 rounded-full ${value === opt.value ? opt.dot : 'bg-neutral-300'}`} />
            <div>
              <div className="text-sm font-semibold">{opt.label}</div>
              <div className={`text-xs mt-0.5 ${value === opt.value ? 'opacity-80' : 'text-neutral-500'}`}>{opt.desc}</div>
            </div>
          </Button>
        ))}
      </div>
    )
  }

  if (field.kind === 'radio-cards') {
    return (
      <div className="mt-1 grid gap-2">
        {(field.options ?? []).map((opt) => (
          <Button
            key={opt.value}
            variant="ghost"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left font-normal ${
              value === opt.value
                ? 'border-[#1a3d32] bg-[#1a3d32]/5 ring-1 ring-[#1a3d32] shadow-sm hover:bg-[#1a3d32]/5'
                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {opt.icon && <span className="text-xl shrink-0">{opt.icon}</span>}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-neutral-900">{opt.label}</div>
              {opt.description && <div className="text-xs text-neutral-500 mt-0.5">{opt.description}</div>}
            </div>
            <span className={`mt-1 shrink-0 size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              value === opt.value ? 'border-[#1a3d32] bg-[#1a3d32]' : 'border-neutral-300'
            }`}>
              {value === opt.value && <span className="size-1.5 rounded-full bg-white" />}
            </span>
          </Button>
        ))}
      </div>
    )
  }

  if (field.kind === 'checkbox') {
    return (
      <div className="mt-2 flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 hover:bg-neutral-50 transition-colors">
        <ToggleSwitch
          checked={value === true || value === 'true'}
          onChange={(v) => onChange(v)}
          label={field.label}
        />
        <div>
          <span className="text-sm font-medium text-neutral-900">{field.label}</span>
          {field.hint && <p className="text-xs text-neutral-500 mt-0.5">{field.hint}</p>}
        </div>
      </div>
    )
  }

  if (field.kind === 'checkbox-group') {
    const selected: string[] = value && typeof value === 'string' ? JSON.parse(value || '[]') : []
    return (
      <div className="mt-1 space-y-2">
        {(field.options ?? []).map((opt) => {
          const checked = selected.includes(opt.value)
          return (
            <div key={opt.value} className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 hover:bg-neutral-50 transition-colors">
              <ToggleSwitch
                checked={checked}
                onChange={(v) => {
                  const next = v
                    ? [...selected, opt.value]
                    : selected.filter((x) => x !== opt.value)
                  onChange(JSON.stringify(next))
                }}
                label={opt.label}
              />
              <div>
                <span className="text-sm font-medium text-neutral-900">{opt.label}</span>
                {opt.description && <p className="text-xs text-neutral-500">{opt.description}</p>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (field.kind === 'module_picker') {
    const selected: string[] =
      value && typeof value === 'string' ? (JSON.parse(value || '[]') as string[]) : []
    const opts = field.options ?? []
    if (opts.length === 0) {
      return (
        <div className="mt-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {field.emptyHint ?? 'Ingen kandidater funnet for dette kravet ennå.'}
        </div>
      )
    }
    // Grupper etter `group` (eks: "Kurs", "Dokument") med stabil rekkefølge.
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
      <div className="mt-1 space-y-3">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group} className="rounded-xl border border-neutral-200 bg-white">
            <p className="border-b border-neutral-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              {group} · {items.length}
            </p>
            <ul>
              {items.map((opt) => {
                const checked = selected.includes(opt.value)
                return (
                  <li key={opt.value} className="flex items-start gap-3 border-b border-neutral-100 px-3 py-2.5 last:border-b-0 hover:bg-neutral-50">
                    <ToggleSwitch
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      label={opt.label}
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
      <SearchableSelect
        value={value as string}
        options={[
          ...(!field.required ? [{ value: '', label: '— Velg —' }] : []),
          ...(field.options ?? []).map((opt) => ({ value: opt.value, label: opt.label })),
        ]}
        onChange={(v) => onChange(v)}
      />
    )
  }

  if (field.kind === 'textarea') {
    return (
      <StandardTextarea
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
    <StandardInput
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

// ─── Main modal ───────────────────────────────────────────────────────────────

export type WizardModalProps = {
  def: WizardDef
  onClose: () => void
  /** Pre-populate values from a resumable run. */
  initialValues?: Record<string, string | boolean>
  /** Start at this step index (for resume). */
  initialStep?: number
  /**
   * Called after each step advance with (nextStepIndex, currentValues).
   * Used by StudioWizardLauncher to persist `compliance_wizard_runs`.
   */
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
  const progress = ((stepIndex + 1) / totalSteps) * 100

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
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
    // Validate required fields
    const missing = visibleFields(step.fields)
      .filter((f) => f.required && f.kind !== 'checkbox' && f.kind !== 'info' && !getField(f.id))
    if (missing.length > 0) {
      setError(`Vennligst fyll inn: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    // Custom validation
    if (step.validate) {
      const err = step.validate(values)
      if (err) { setError(err); return }
    }
    setError(null)

    // Async side-effect (provisjonering, etc.) — blokkerer fremgang ved feil.
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
          className="flex h-full w-full max-w-[min(100vw,720px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-9 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-neutral-900">Fullført!</h2>
            <p className="max-w-md text-sm text-neutral-600">
              {def.description ?? `${def.title} er registrert.`}
            </p>
            <Button variant="primary" onClick={onClose} className="mt-2 rounded-full px-6 py-2.5">
              Lukk
            </Button>
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
        className="relative flex h-full w-full max-w-[min(100vw,720px)] flex-col overflow-hidden bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className={`shrink-0 px-6 pb-4 pt-5 ${accent.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {step.icon && <span className="text-2xl">{step.icon}</span>}
                <h2 className="text-lg font-semibold text-neutral-900">{def.title}</h2>
              </div>
              <p className={`mt-0.5 text-sm font-medium ${accent.text}`}>{step.title}</p>
              {step.subtitle && <p className="mt-0.5 text-xs text-neutral-500">{step.subtitle}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 shrink-0 rounded-lg text-neutral-400 hover:bg-black/8 hover:text-neutral-700"
              aria-label="Lukk"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex gap-1">
                {def.steps.map((s, i) => (
                  <Button
                    key={s.id}
                    variant="ghost"
                    size="icon"
                    onClick={() => i < stepIndex && setStepIndex(i)}
                    className={`h-1.5 rounded-full p-0 hover:bg-transparent ${
                      i === stepIndex ? `w-6 ${accent.progress}` :
                      i < stepIndex ? `w-3 ${accent.progress} opacity-60` :
                      'w-3 bg-neutral-300'
                    }`}
                    aria-label={`Steg ${i + 1}`}
                    aria-current={i === stepIndex ? 'step' : undefined}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-neutral-500">
                {stepIndex + 1} / {totalSteps}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${accent.progress}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Fields ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {visibleFields(step.fields).map((field) => (
            <div key={field.id}>
              {field.kind !== 'checkbox' && field.kind !== 'info' && (
                <label className="block text-sm font-medium text-neutral-800">
                  {field.label}
                  {field.required && <span className="ml-1 text-red-500">*</span>}
                </label>
              )}
              {field.hint && field.kind !== 'checkbox' && (
                <p className="mt-0.5 text-xs text-neutral-500">{field.hint}</p>
              )}
              <WizardFieldRenderer
                field={field}
                value={getField(field.id)}
                onChange={(v) => setField(field.id, v)}
                accent={accent}
              />
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-neutral-100 px-6 py-4 bg-neutral-50/80">
          {stepIndex > 0 ? (
            <Button
              variant="secondary"
              onClick={handleBack}
              icon={<ChevronLeft className="size-4" />}
              className="rounded-full"
            >
              Tilbake
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="px-0 text-neutral-400 hover:bg-transparent hover:text-neutral-600"
            >
              Avbryt
            </Button>
          )}

          <Button
            variant="primary"
            onClick={handleNext}
            disabled={advancing}
            className={`rounded-full px-5 py-2 ${accent.btn}`}
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
          </Button>
        </div>
      </div>
    </div>
  )
}
