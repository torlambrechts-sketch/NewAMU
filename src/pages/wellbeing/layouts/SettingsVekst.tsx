// SettingsVekst — hybrid: organisasjons-innstillingers to-kolonne-DNA
// (venstre = «hvorfor», høyre = «hva») dresset i Vekst-stilen.
//
// Hver seksjon er et cream-omkranset rounded-3xl-kort med eyebrow,
// serif-tittel, valgfri intro og en motif-watermark i hjørnet. Hver
// rad er et to-kolonne-grid: venstre forklarer WHY i vanlig prosa,
// høyre eksponerer kontrollen. Vi tilbyr klassiske helper-komponenter
// (Input, Toggle, Select) som rendres i Vekst-fargene slik at
// settings-flater kan strykes mot Vekst uten boilerplate.

import type { ReactNode } from 'react'
import { OrganisationHeaderIllustration } from '../../../components/organisation/OrganisationHeaderIllustration'
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

export type SettingsVekstRow = {
  id: string
  /** Left-column prose explaining the WHY behind this setting. */
  lead: ReactNode
  /** Optional small uppercase label that sits above the control. */
  label?: string
  /** The actual input / toggle / select / custom control. */
  control: ReactNode
  /** Small note rendered under the control (errors, hints, status). */
  helper?: ReactNode
}

export type SettingsVekstSection = {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  motif?: WellbeingAxisKey
  rows: SettingsVekstRow[]
}

export type SettingsVekstProps = {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  /** Custom hero illustration; defaults to OrganisationHeaderIllustration. */
  illustration?: ReactNode
  /** Right-hand side of the hero — typically Save / Discard buttons. */
  headerActions?: ReactNode
  sections: SettingsVekstSection[]
  footnote?: ReactNode
}

export function SettingsVekst({
  eyebrow,
  title,
  subtitle,
  illustration,
  headerActions,
  sections,
  footnote,
}: SettingsVekstProps) {
  const illu = illustration ?? <OrganisationHeaderIllustration className="h-32 w-auto" />
  return (
    <div className="space-y-8">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <header className="rounded-3xl border border-amber-200/70 bg-gradient-to-br from-[#FAF6EE] via-white to-amber-50/40 p-7 shadow-[0_10px_30px_-18px_rgba(217,119,6,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-1 items-center gap-5">
            <div className="hidden shrink-0 sm:block">{illu}</div>
            <div className="space-y-2">
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
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      </header>

      {/* ── Sections ────────────────────────────────────────────────── */}
      {sections.map((section, idx) => {
        const Motif = section.motif ? MOTIF_BY_AXIS[section.motif] : null
        return (
          <section
            key={section.id}
            className="relative overflow-hidden rounded-3xl border border-[#1a3d32]/15 bg-white shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]"
          >
            {Motif && (
              <Motif className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 opacity-[0.05]" />
            )}

            <div className="relative border-b-2 border-amber-200/70 px-7 py-5">
              <div className="flex items-start gap-3">
                {Motif && <Motif className="mt-0.5 h-9 w-9 shrink-0" />}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                    {section.eyebrow ?? `Del ${idx + 1}`}
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
            </div>

            <div className="relative divide-y divide-amber-100">
              {section.rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-6 px-7 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
                >
                  <div className="text-sm leading-relaxed text-[#516760]">{row.lead}</div>
                  <div className="space-y-1.5">
                    {row.label && (
                      <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a3d32]/70">
                        {row.label}
                      </label>
                    )}
                    {row.control}
                    {row.helper && <div className="text-xs text-[#516760]">{row.helper}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {footnote && (
        <p className="text-center text-[11px] italic leading-relaxed text-[#516760]">{footnote}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Helper controls — Vekst-tone input/toggle/select. Bruk hvor som helst
// inni en `control`-prop, eller direkte i andre Vekst-flater.
// ─────────────────────────────────────────────────────────────────────────

export function SettingsVekstInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border-2 border-[#1a3d32]/15 bg-amber-50/30 px-3.5 py-2.5 text-sm text-[#1a3d32] placeholder-[#516760]/60 focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 ${
        props.className ?? ''
      }`}
    />
  )
}

export function SettingsVekstTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border-2 border-[#1a3d32]/15 bg-amber-50/30 px-3.5 py-2.5 text-sm text-[#1a3d32] placeholder-[#516760]/60 focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 ${
        props.className ?? ''
      }`}
    />
  )
}

export function SettingsVekstSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border-2 border-[#1a3d32]/15 bg-amber-50/30 px-3.5 py-2.5 text-sm text-[#1a3d32] focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 ${
        props.className ?? ''
      }`}
    >
      {props.children}
    </select>
  )
}

export function SettingsVekstToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#1a3d32]/15 bg-amber-50/20 px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50/40">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-amber-500' : 'bg-[#1a3d32]/20'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div>
        <div className="text-sm font-semibold text-[#1a3d32]" style={{ fontFamily: SERIF }}>
          {label}
        </div>
        {description && <div className="mt-0.5 text-xs leading-relaxed text-[#516760]">{description}</div>}
      </div>
    </label>
  )
}

/** Inline read-only key/value pair styled to match the Vekst controls.
 *  Useful for surfacing synced/derived fields (e.g. Brreg-snapshot). */
export function SettingsVekstReadout({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/30 px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">{label}</div>
      <div
        className="mt-1 text-base font-semibold text-[#1a3d32]"
        style={{ fontFamily: SERIF }}
      >
        {value}
      </div>
    </div>
  )
}
