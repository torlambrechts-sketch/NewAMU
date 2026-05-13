// SurveyVekst — varm-styled spørreundersøkelses-form. Hver seksjon
// får sitt motiv fra axis-illustrasjonene, spørsmål rendres som store
// serif-overskrifter, og Likert-svar bruker rounde knapper med soft
// amber-fyll når valgt. Designet slik at QPS Nordic / ARK / NAQ-R+
// kan presenteres som en samtale, ikke et skjema.

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Send } from 'lucide-react'
import {
  MotifMedvirkning,
  MotifMestring,
  MotifTrivsel,
  MotifTrygghet,
} from '../components/AxisMotifs'
import type { WellbeingAxisKey } from '../dashboards/useWorkerWellbeingDatasets'

const SERIF = "'Libre Baskerville', Georgia, serif"

const MOTIF_BY_AXIS: Record<WellbeingAxisKey, React.ComponentType<{ className?: string }>> = {
  trygghet: MotifTrygghet,
  trivsel: MotifTrivsel,
  medvirkning: MotifMedvirkning,
  mestring: MotifMestring,
}

export type SurveyVekstScale =
  | { kind: 'likert5'; min: string; max: string }
  | { kind: 'likert7'; min: string; max: string }
  | { kind: 'binary'; yes?: string; no?: string }
  | { kind: 'text' }

export type SurveyVekstQuestion = {
  id: string
  text: string
  helper?: string
  scale: SurveyVekstScale
}

export type SurveyVekstSection = {
  id: string
  title: string
  intro?: string
  axisKey?: WellbeingAxisKey
  questions: SurveyVekstQuestion[]
}

export type SurveyVekstProps = {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  sections: SurveyVekstSection[]
  submitLabel?: string
  onSubmit?: (values: Record<string, string | number | null>) => void
  /** Bottom-of-form note (privacy, anonymity statement, etc). */
  footnote?: ReactNode
}

export function SurveyVekst({
  eyebrow,
  title,
  subtitle,
  sections,
  submitLabel = 'Send inn svarene',
  onSubmit,
  footnote,
}: SurveyVekstProps) {
  const [values, setValues] = useState<Record<string, string | number | null>>({})

  const setAnswer = (id: string, v: string | number | null) =>
    setValues((prev) => ({ ...prev, [id]: v }))

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(values)
      }}
    >
      <header className="space-y-2">
        {eyebrow && (
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
            {eyebrow}
          </span>
        )}
        <h1
          className="text-3xl font-bold leading-tight text-[#1a3d32] sm:text-4xl"
          style={{ fontFamily: SERIF }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-base leading-relaxed text-[#516760]">{subtitle}</p>
        )}
      </header>

      {sections.map((section, idx) => {
        const Motif = section.axisKey ? MOTIF_BY_AXIS[section.axisKey] : null
        return (
          <section
            key={section.id}
            className="relative overflow-hidden rounded-3xl border border-[#1a3d32]/15 bg-white p-7 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]"
          >
            {Motif && (
              <Motif className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 opacity-[0.06]" />
            )}

            <div className="relative">
              <div className="flex items-start gap-3">
                {Motif && <Motif className="mt-0.5 h-10 w-10 shrink-0" />}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                    Del {idx + 1}
                  </div>
                  <h2
                    className="mt-1 text-2xl font-bold leading-tight text-[#1a3d32]"
                    style={{ fontFamily: SERIF }}
                  >
                    {section.title}
                  </h2>
                  {section.intro && (
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#516760]">
                      {section.intro}
                    </p>
                  )}
                </div>
              </div>

              <ol className="mt-6 space-y-7">
                {section.questions.map((q, qi) => (
                  <li key={q.id} className="border-t border-amber-100 pt-5 first:border-t-0 first:pt-0">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="shrink-0 text-sm font-bold text-amber-700"
                        style={{ fontFamily: SERIF }}
                      >
                        {qi + 1}.
                      </span>
                      <h3
                        className="text-lg font-semibold leading-snug text-[#1a3d32] sm:text-xl"
                        style={{ fontFamily: SERIF }}
                      >
                        {q.text}
                      </h3>
                    </div>
                    {q.helper && (
                      <p className="ml-6 mt-1 text-xs italic leading-relaxed text-[#516760]">{q.helper}</p>
                    )}
                    <div className="ml-6 mt-4">
                      <ScaleControl
                        scale={q.scale}
                        value={values[q.id] ?? null}
                        onChange={(v) => setAnswer(q.id, v)}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )
      })}

      <div className="flex flex-col items-end gap-3">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full border-2 border-amber-300 bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(217,119,6,0.45)] transition-all hover:bg-amber-700"
          style={{ fontFamily: SERIF }}
        >
          <Send className="h-4 w-4" aria-hidden /> {submitLabel}
        </button>
        {footnote && (
          <p className="max-w-md text-right text-[11px] italic leading-relaxed text-[#516760]">{footnote}</p>
        )}
      </div>
    </form>
  )
}

function ScaleControl({
  scale,
  value,
  onChange,
}: {
  scale: SurveyVekstScale
  value: string | number | null
  onChange: (v: string | number | null) => void
}) {
  if (scale.kind === 'likert5' || scale.kind === 'likert7') {
    const n = scale.kind === 'likert5' ? 5 : 7
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: n }, (_, i) => i + 1).map((v) => {
            const active = value === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(v)}
                aria-pressed={active}
                className={`relative h-12 w-12 rounded-full border-2 text-base font-bold transition-all ${
                  active
                    ? 'border-amber-500 bg-amber-500 text-white shadow-[0_6px_14px_-6px_rgba(217,119,6,0.6)] scale-110'
                    : 'border-[#1a3d32]/20 bg-white text-[#1a3d32] hover:border-amber-300 hover:bg-amber-50'
                }`}
                style={{ fontFamily: SERIF }}
              >
                {v}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] italic text-[#516760]">
          <span>{scale.min}</span>
          <span>{scale.max}</span>
        </div>
      </div>
    )
  }
  if (scale.kind === 'binary') {
    return (
      <div className="flex gap-3">
        {(
          [
            { key: 'yes', label: scale.yes ?? 'Ja' },
            { key: 'no', label: scale.no ?? 'Nei' },
          ] as const
        ).map((opt) => {
          const active = value === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={active}
              className={`rounded-full border-2 px-5 py-2 text-sm font-semibold transition-all ${
                active
                  ? 'border-amber-500 bg-amber-500 text-white shadow-[0_6px_14px_-6px_rgba(217,119,6,0.6)]'
                  : 'border-[#1a3d32]/20 bg-white text-[#1a3d32] hover:border-amber-300 hover:bg-amber-50'
              }`}
              style={{ fontFamily: SERIF }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }
  // text
  return (
    <textarea
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      placeholder="Skriv et fritt-tekst-svar her …"
      className="w-full rounded-2xl border-2 border-[#1a3d32]/15 bg-amber-50/30 px-4 py-3 text-sm text-[#1a3d32] placeholder-[#516760]/60 focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
    />
  )
}
