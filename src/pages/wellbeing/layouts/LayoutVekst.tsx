// LayoutVekst — varm, narrativ, illustrert variant av Arbeids-
// miljøstrategi-siden. Designet rundt fortellingen om at fire
// grener (utfallsaksene) vokser fra ett felles rotsystem. Serif-
// typografi i overskrifter speiler Klarert-merkevaren på Landing-
// og WelcomePage; resten er sans-serif.
//
// Palette: forest (#1a3d32) for typografi, varm amber (#d97706) som
// gjennomgående aksent, soft cream (#FAF6EE) som lerret. Cards har
// rounded-3xl, generøs padding og en svak amber-skygge.

import { Link } from 'react-router-dom'
import { ArrowUpRight, Sprout } from 'lucide-react'
import { VekstIllustration } from '../components/VekstIllustration'
import {
  MotifMedvirkning,
  MotifMestring,
  MotifTrivsel,
  MotifTrygghet,
} from '../components/AxisMotifs'
import {
  WELLBEING_AXIS_LABELS,
  WELLBEING_AXIS_LAW,
  type WellbeingAxisKey,
} from '../dashboards/useWorkerWellbeingDatasets'
import type { ArbeidsmiljostrategiData } from '../hooks/useArbeidsmiljostrategiData'

const SERIF = "'Libre Baskerville', Georgia, serif"

const AXIS_COPY: Record<WellbeingAxisKey, { lead: string; verb: string }> = {
  trygghet: { lead: 'Folk skal kunne gå hjem hele.', verb: 'vokser fra' },
  trivsel: { lead: 'Folk skal kjenne seg sett.', verb: 'næres av' },
  medvirkning: { lead: 'Folk skal bli hørt.', verb: 'styrkes av' },
  mestring: { lead: 'Folk skal kunne det de gjør.', verb: 'modnes ved' },
}

const AXIS_MOTIF: Record<WellbeingAxisKey, React.ComponentType<{ className?: string }>> = {
  trygghet: MotifTrygghet,
  trivsel: MotifTrivsel,
  medvirkning: MotifMedvirkning,
  mestring: MotifMestring,
}

export function LayoutVekst({ data }: { data: ArbeidsmiljostrategiData }) {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#FAF6EE] px-4 py-10 sm:px-6 sm:py-12 md:-mx-8 md:px-12">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
              Vi dyrker arbeidsmiljøet
            </span>
            <h1
              className="text-4xl font-bold leading-tight text-[#1a3d32] sm:text-5xl"
              style={{ fontFamily: SERIF }}
            >
              Vår vilje for {data.organizationName}
            </h1>
            {data.visionMd ? (
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-[#2c3a35]">{data.visionMd}</p>
            ) : (
              <p className="max-w-xl text-base italic leading-relaxed text-[#516760]">
                Skriv hva slags arbeidsmiljø dere ønsker å skape. Strategien blir tydeligere
                når den lever som en setning alle kjenner igjen.
              </p>
            )}
            {data.missionMd && (
              <p className="max-w-xl whitespace-pre-wrap text-sm leading-relaxed text-[#516760]">{data.missionMd}</p>
            )}
            <div className="flex items-center gap-3 pt-2">
              <IndexBadge label={data.indexLabel} delta={data.indexDelta} />
              <span className="text-sm text-[#516760]">
                samlet trivselsindeks denne måneden
              </span>
            </div>
          </div>
          <VekstIllustration className="mx-auto h-auto w-full max-w-[420px]" />
        </header>

        {/* ── Fokusområder dette året ──────────────────────────────────── */}
        {data.focusAreas.length > 0 && (
          <section className="space-y-3">
            <SectionTitle eyebrow="I år går vi etter dette">Tre frø vi planter</SectionTitle>
            <ul className="grid gap-4 md:grid-cols-3">
              {data.focusAreas.slice(0, 3).map((f) => (
                <li
                  key={f.id}
                  className="rounded-3xl border border-amber-200/70 bg-white p-6 shadow-[0_8px_24px_-12px_rgba(217,119,6,0.25)]"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    {WELLBEING_AXIS_LABELS[f.axis_key as WellbeingAxisKey] ?? f.axis_key}
                  </span>
                  <h3
                    className="mt-2 text-lg font-bold leading-snug text-[#1a3d32]"
                    style={{ fontFamily: SERIF }}
                  >
                    {f.title}
                  </h3>
                  {f.body_md && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#516760]">{f.body_md}</p>
                  )}
                  {f.target_metric && (
                    <p className="mt-3 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                      Mål: {f.target_metric}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Fire grener ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionTitle eyebrow="Fire grener fra samme rot">Slik vokser arbeidsmiljøet</SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.axisOverview.map((row) => {
              const copy = AXIS_COPY[row.axisKey]
              const Motif = AXIS_MOTIF[row.axisKey]
              return (
                <li
                  key={row.axisKey}
                  className="relative overflow-hidden rounded-3xl border border-[#1a3d32]/15 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]"
                >
                  {/* Bakgrunns-motif — stort, lyst, dekorativt */}
                  <Motif className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 opacity-[0.06]" />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex flex-1 items-start gap-3">
                      <Motif className="mt-0.5 h-10 w-10 shrink-0" />
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                          {WELLBEING_AXIS_LABELS[row.axisKey]}
                        </div>
                        <p
                          className="mt-1 text-xl font-semibold leading-snug text-[#1a3d32]"
                          style={{ fontFamily: SERIF }}
                        >
                          {copy.lead}
                        </p>
                        <p className="mt-1 text-[11px] text-[#516760]">{WELLBEING_AXIS_LAW[row.axisKey]}</p>
                      </div>
                    </div>
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-50 text-xl font-bold text-amber-900"
                      style={{ fontFamily: SERIF }}
                    >
                      {row.score}
                    </div>
                  </div>
                  <div className="relative mt-4 space-y-2 border-t border-amber-100 pt-3">
                    <p className="text-sm text-[#2c3a35]">
                      <span className="font-semibold text-[#1a3d32]">{copy.verb}</span> {row.signal}
                    </p>
                    <p className="text-sm text-[#2c3a35]">
                      <span className="font-semibold text-[#1a3d32]">Neste steg:</span> {row.nextMove}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {/* ── Hva vi har av redskap ────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionTitle eyebrow="Vi gjør dette sammen">Redskapene som dyrker frem trivselen</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.tools.map((t) => (
              <li
                key={`${t.axis}-${t.title}`}
                className="group rounded-2xl border border-[#1a3d32]/10 bg-white p-4 transition-shadow hover:shadow-[0_8px_20px_-10px_rgba(217,119,6,0.35)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                    {WELLBEING_AXIS_LABELS[t.axis]}
                  </span>
                  <Link
                    to={t.path}
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#1a3d32] opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Åpne <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
                <h3 className="mt-1 text-sm font-semibold text-[#1a3d32]" style={{ fontFamily: SERIF }}>
                  {t.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#516760]">{t.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Neste steg (action queue) — milde nudges ─────────────────── */}
        {data.actionQueue.length > 0 && (
          <section className="space-y-3">
            <SectionTitle eyebrow="Det vi skal stelle med først">Et par ting som trenger litt sol</SectionTitle>
            <ul className="space-y-2">
              {data.actionQueue.slice(0, 5).map((row, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4"
                >
                  <span className="mt-0.5 text-amber-700">
                    <Sprout className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{row.axis}</div>
                    <p className="text-sm leading-relaxed text-[#2c3a35]">{row.item}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-[#516760]">{row.origin}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function IndexBadge({ label, delta }: { label: string; delta: string }) {
  return (
    <span
      className="inline-flex items-baseline gap-2 rounded-full border-2 border-amber-300 bg-white px-4 py-1.5 shadow-[0_4px_12px_-6px_rgba(217,119,6,0.4)]"
    >
      <span
        className="text-2xl font-bold text-[#1a3d32]"
        style={{ fontFamily: SERIF }}
      >
        {label}
      </span>
      <span className="text-[10px] text-[#516760]">av 100</span>
      {delta && (
        <span
          className={`text-[11px] font-semibold ${
            delta.startsWith('+')
              ? 'text-emerald-700'
              : delta.startsWith('-')
              ? 'text-rose-700'
              : 'text-neutral-500'
          }`}
        >
          {delta}
        </span>
      )}
    </span>
  )
}

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">{eyebrow}</div>
      <h2
        className="mt-1 text-2xl font-bold leading-tight text-[#1a3d32]"
        style={{ fontFamily: SERIF }}
      >
        {children}
      </h2>
    </div>
  )
}
