// LayoutStyringssatser — strikt, styreroms-aktig variant. Designet
// for å føles som et formelt strategi-dokument: serif overskrifter,
// sterk typografisk hierarki, ingen dekorative kort, og en
// 7/3-kolonneoppbygging hvor hovedteksten leses som en saksframlegg
// og høyre kolonne er styreroms-fakta + hjemler.
//
// Reuse: WorkplaceSplit7030Layout + WorkplaceDashboardShell — samme
// chrome som «standard» dashboard-sider på plattformen, men brukt
// for å gi rapporten en kjent profesjonell ramme.

import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { WorkplaceDashboardShell } from '../../../components/layout/WorkplaceDashboardShell'
import { WorkplaceSplit7030Layout } from '../../../components/layout/WorkplaceSplit7030Layout'
import {
  WELLBEING_AXIS_LABELS,
  WELLBEING_AXIS_LAW,
  type WellbeingAxisKey,
} from '../dashboards/useWorkerWellbeingDatasets'
import type { ArbeidsmiljostrategiData } from '../hooks/useArbeidsmiljostrategiData'

const SERIF = "'Libre Baskerville', Georgia, serif"

const LEGAL_REFERENCES: Array<{ label: string; body: string }> = [
  {
    label: 'AML § 1-1',
    body: 'Lovens formål: et fullt forsvarlig arbeidsmiljø som gir trygghet mot fysiske og psykiske skadevirkninger.',
  },
  { label: 'AML § 3-1 (b)', body: 'Systematisk HMS-arbeid skal omfatte mål for arbeidsmiljøet.' },
  { label: 'AML § 4-1', body: 'Generelle krav til arbeidsmiljøet — fullt forsvarlig.' },
  { label: 'AML § 4-3', body: 'Psykososialt arbeidsmiljø — verdighet og integritet.' },
  { label: 'AML kap. 6 & 7', body: 'Verneombud og arbeidsmiljøutvalg — medvirkningsapparatet.' },
]

export function LayoutStyringssatser({ data }: { data: ArbeidsmiljostrategiData }) {
  const reportDate = new Date().toLocaleDateString('nb-NO', { dateStyle: 'long' })

  // Forrige måneds snapshot — brukt til å gi indeks-tabellen en
  // sammenligningskolonne. snapshots[0] er nyeste; vi tar første som
  // ikke er fra inneværende periode.
  const previousSnapshot =
    data.snapshots.find((s) => s.period_key !== data.currentPeriodKey) ?? null
  const previousLabel = previousSnapshot?.period_key ?? '—'
  const formatDelta = (current: string, previous: number | null) => {
    const cur = Number(current)
    if (!Number.isFinite(cur) || previous == null) return '—'
    const d = cur - previous
    if (d === 0) return '±0'
    return d > 0 ? `+${d}` : `${d}`
  }

  return (
    <WorkplaceDashboardShell
      breadcrumb={[
        { label: 'Arbeidsflate', to: '/' },
        { label: 'Oversikt', to: '/overview/hms' },
        { label: 'Arbeidsmiljøstrategi' },
      ]}
      title={
        <span style={{ fontFamily: SERIF }}>
          Arbeidsmiljøstrategi for {data.organizationName}
        </span>
      }
      description={
        <span>
          Status per {reportDate}. Et utfalls-orientert sammendrag av hvordan
          organisasjonen lever opp til arbeidsmiljølovens formål — for AMU og styret.
        </span>
      }
      headerActions={
        <Link
          to="/overview/arbeidsmiljostrategi/rapport?autoprint=1"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          <Scale className="h-3.5 w-3.5" aria-hidden /> Styreromsrapport
        </Link>
      }
    >
      <WorkplaceSplit7030Layout
        cardWrap
        splitDensity="default"
        main={
          <div className="space-y-8">
            {/* Saksframlegg-stilen */}
            <section>
              <h2
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500"
                style={{ fontFamily: SERIF }}
              >
                1. Strategisk intensjon
              </h2>
              <div className="mt-2 border-l-2 border-[#1a3d32]/30 pl-5">
                {data.visionMd ? (
                  <p
                    className="whitespace-pre-wrap text-base leading-relaxed text-neutral-900"
                    style={{ fontFamily: SERIF }}
                  >
                    {data.visionMd}
                  </p>
                ) : (
                  <p className="text-sm italic text-neutral-500">
                    Visjon ikke formulert ennå — strategiens fundament mangler. Be HMS-leder
                    eller daglig leder fylle inn på Strategi-fanen.
                  </p>
                )}
                {data.missionMd && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                    {data.missionMd}
                  </p>
                )}
              </div>
            </section>

            {/* Mål dette året */}
            <section>
              <h2
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500"
                style={{ fontFamily: SERIF }}
              >
                2. Mål dette året
              </h2>
              {data.focusAreas.length === 0 ? (
                <p className="mt-2 text-sm italic text-neutral-500">
                  Ingen fokusområder satt. Etter AML § 3-1 (b) skal det formuleres
                  konkrete mål for HMS-arbeidet.
                </p>
              ) : (
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-neutral-300 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      <th className="py-2 pr-3">Akse</th>
                      <th className="py-2 pr-3">Fokusområde</th>
                      <th className="py-2">Måltall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.focusAreas.map((f) => (
                      <tr key={f.id} className="border-b border-neutral-200 align-top">
                        <td className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
                          {WELLBEING_AXIS_LABELS[f.axis_key as WellbeingAxisKey] ?? f.axis_key}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-neutral-900">{f.title}</div>
                          {f.body_md && (
                            <div className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-neutral-600">
                              {f.body_md}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-xs text-neutral-700">{f.target_metric ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Indeks og delskår */}
            <section>
              <h2
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500"
                style={{ fontFamily: SERIF }}
              >
                3. Arbeidsmiljø-indeks og delskår
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
                <div className="border-r border-neutral-200 pr-6">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Samlet indeks</div>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span
                      className="text-5xl font-bold leading-none text-[#1a3d32]"
                      style={{ fontFamily: SERIF, fontFeatureSettings: '"tnum"' }}
                    >
                      {data.indexLabel}
                    </span>
                    <span className="text-xs text-neutral-500">av 100</span>
                  </div>
                  {data.indexDelta && (
                    <div className="mt-1 text-xs text-neutral-700">
                      Endring vs forrige måned: <span className="font-semibold">{data.indexDelta}</span>
                    </div>
                  )}
                </div>
                <div>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-300 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        <th className="py-1 pr-3">Akse</th>
                        <th className="py-1 pr-3 text-right">Inneværende</th>
                        <th className="py-1 pr-3 text-right">{previousLabel}</th>
                        <th className="py-1 pr-3 text-right">Δ</th>
                        <th className="py-1">Hjemmel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['trygghet', 'trivsel', 'medvirkning', 'mestring'] as WellbeingAxisKey[]).map((k) => {
                        const previous = previousSnapshot
                          ? (previousSnapshot[`${k}_score` as keyof typeof previousSnapshot] as number | null) ?? null
                          : null
                        const delta = formatDelta(data.axisScores[k], previous)
                        const deltaTone =
                          delta === '—' || delta === '±0'
                            ? 'text-neutral-500'
                            : delta.startsWith('+')
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        return (
                          <tr key={k} className="border-b border-neutral-100">
                            <td className="py-1.5 pr-3 font-semibold text-neutral-900">
                              {WELLBEING_AXIS_LABELS[k]}
                            </td>
                            <td className="py-1.5 pr-3 text-right font-mono text-neutral-900">{data.axisScores[k]}</td>
                            <td className="py-1.5 pr-3 text-right font-mono text-neutral-500">
                              {previous ?? '—'}
                            </td>
                            <td className={`py-1.5 pr-3 text-right font-mono font-semibold ${deltaTone}`}>{delta}</td>
                            <td className="py-1.5 text-xs text-neutral-600">{WELLBEING_AXIS_LAW[k]}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Signal per akse */}
            <section>
              <h2
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500"
                style={{ fontFamily: SERIF }}
              >
                4. Signal og foreslått handling per akse
              </h2>
              <ol className="mt-3 space-y-4">
                {data.axisOverview.map((row, i) => (
                  <li key={row.axisKey} className="border-l-2 border-[#1a3d32]/30 pl-5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      4.{i + 1} {WELLBEING_AXIS_LABELS[row.axisKey]} · {WELLBEING_AXIS_LAW[row.axisKey]}
                    </div>
                    <h3
                      className="mt-1 text-base font-bold text-neutral-900"
                      style={{ fontFamily: SERIF }}
                    >
                      Skår: {row.score}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-800">
                      <span className="font-semibold text-neutral-900">Signal.</span> {row.signal}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-800">
                      <span className="font-semibold text-neutral-900">Foreslått handling.</span>{' '}
                      {row.nextMove}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Saker som krever oppmerksomhet */}
            {data.actionQueue.length > 0 && (
              <section>
                <h2
                  className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: SERIF }}
                >
                  5. Saker til beslutning
                </h2>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-neutral-300 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      <th className="py-2 pr-3">Akse</th>
                      <th className="py-2 pr-3">Sak</th>
                      <th className="py-2 pr-3">Alvorlighet</th>
                      <th className="py-2">Kilde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.actionQueue.map((row, i) => (
                      <tr key={i} className="border-b border-neutral-200 align-top">
                        <td className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
                          {row.axis}
                        </td>
                        <td className="py-2 pr-3 text-neutral-900">{row.item}</td>
                        <td className="py-2 pr-3 text-xs font-semibold text-neutral-700">{row.severity}</td>
                        <td className="py-2 text-xs text-neutral-600">{row.origin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        }
        aside={
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                Sammendrag
              </h3>
              <dl className="mt-3 space-y-2 text-xs">
                <Row k="Periode" v={reportDate} />
                <Row k="Indeks" v={`${data.indexLabel} / 100`} />
                {data.indexDelta && <Row k="Endring" v={data.indexDelta} />}
                <Row k="Snapshots" v={`${data.snapshots.length}`} />
                <Row k="Inneværende periode" v={data.hasCurrentMonth ? 'Lagret' : 'Ikke lagret'} />
              </dl>
            </section>

            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                Lov-hjemmel
              </h3>
              <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-neutral-700">
                {LEGAL_REFERENCES.map((r) => (
                  <li key={r.label}>
                    <span className="font-semibold text-neutral-900">{r.label}.</span> {r.body}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                Snapshot-historikk
              </h3>
              {data.snapshots.length === 0 ? (
                <p className="mt-2 text-xs italic text-neutral-500">Ingen snapshots lagret.</p>
              ) : (
                <table className="mt-3 w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
                    <tr className="border-b border-neutral-200">
                      <th className="py-1 pr-2 text-left font-semibold">Periode</th>
                      <th className="py-1 text-right font-semibold">Indeks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.snapshots.slice(0, 6).map((s) => (
                      <tr key={s.id} className="border-b border-neutral-100">
                        <td className="py-1 pr-2 text-neutral-700">{s.period_key}</td>
                        <td className="py-1 text-right font-mono text-neutral-900">
                          {s.index_value ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="border-t border-neutral-200 pt-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                Vedtak
              </h3>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
                Strategien er gjennomgått av styret og AMU på dato som angitt under,
                og bekreftes som et mål-styrt vedtak etter AML § 3-1 (b). Avvik fra
                strategien skal protokollføres i AMU-møte senest påfølgende kvartal.
              </p>
              <div className="mt-4 space-y-3">
                <VedtakRow label="Vedtatt av styret" />
                <VedtakRow label="Bekreftet av AMU" />
                <VedtakRow label="Neste gjennomgang" />
              </div>
            </section>

            <section className="border-t border-neutral-200 pt-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                Underskrift
              </h3>
              <div className="mt-3 space-y-4 text-xs">
                <SignatureLine label="HMS-leder" />
                <SignatureLine label="AMU-leder" />
              </div>
            </section>
          </div>
        }
      />
    </WorkplaceDashboardShell>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-neutral-100 py-1.5">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="font-semibold text-neutral-900">{v}</dd>
    </div>
  )
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-7 border-b border-neutral-400" />
      <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  )
}

function VedtakRow({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2 text-[11px]">
      <span className="text-neutral-600">{label}</span>
      <span className="inline-block h-4 w-24 border-b border-neutral-400" />
    </div>
  )
}
