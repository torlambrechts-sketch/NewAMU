// ModuleSakligAmu — AMU & verneombud-modul i Saklig-stilen.
//
// Saklig sitter mellom Vekst (varmt + illustrert) og Styringssatser
// (strikt + styrerom). Stilen beholder serif-overskrifter og litt
// amber-aksent fra Vekst, men dropper rounded-3xl-pillow-kortene, de
// store motiv-watermarkene og den lyriske mikrokopien. Microcopy er
// direkte; kortene er rounded-2xl med tynne border + mild skygge;
// tall vises i serif men labels i sans-serif.

import { ArrowUpRight, Calendar, CheckCircle2, Clock, FileText, Users } from 'lucide-react'
import {
  MotifMedvirkning,
  MotifTrygghet,
} from '../../components/AxisMotifs'

const SERIF = "'Libre Baskerville', Georgia, serif"
const CANVAS = '#FAFAF7'

type Kpi = { id: string; label: string; value: string; sub: string; tone?: 'good' | 'warn' | 'neutral' }

const KPIS: Kpi[] = [
  { id: 'meetings', label: 'AMU-møter i år', value: '3 / 4', sub: 'Q4 planlagt 12. desember', tone: 'good' },
  { id: 'attendance', label: 'Snitt frammøte', value: '92 %', sub: 'Over § 7-2 (5) terskel', tone: 'good' },
  { id: 'open-decisions', label: 'Åpne vedtak', value: '7', sub: '3 forfaller før neste møte', tone: 'warn' },
  { id: 'verneombud', label: 'Verneombud-dekning', value: '7 / 8', sub: 'Bergen mangler', tone: 'warn' },
]

const TONE_VALUE: Record<NonNullable<Kpi['tone']>, string> = {
  good: 'text-emerald-800',
  warn: 'text-amber-800',
  neutral: 'text-[#1a3d32]',
}

const TONE_DOT: Record<NonNullable<Kpi['tone']>, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  neutral: 'bg-[#1a3d32]/40',
}

type Decision = {
  id: string
  title: string
  meeting: string
  owner: string
  due: string
  status: 'I arbeid' | 'Forfaller' | 'Lukket'
}

const DECISIONS: Decision[] = [
  { id: '1', title: 'Utvide psykososial pulsmåling til Bergen-kontoret', meeting: 'AMU Q2 · 13. mai', owner: 'Lina Storhaug', due: '01. juli', status: 'I arbeid' },
  { id: '2', title: 'Etablere fast varslings-prosedyre etter kap. 2A', meeting: 'AMU Q1 · 04. feb', owner: 'HR-direktør', due: '15. juni', status: 'Forfaller' },
  { id: '3', title: 'Verneombud-valg i Bergen — frist for plakat', meeting: 'AMU Q2 · 13. mai', owner: 'Personalavd.', due: '30. mai', status: 'Forfaller' },
  { id: '4', title: 'Innføre 1:1-rytme for skiftledere', meeting: 'AMU Q1 · 04. feb', owner: 'Mona Vestby', due: '—', status: 'Lukket' },
  { id: '5', title: 'Risikoanalyse for nytt prosjekt — Borgen', meeting: 'AMU Q4 · 11. des 2025', owner: 'HMS-leder', due: '—', status: 'Lukket' },
]

const STATUS_PILL: Record<Decision['status'], string> = {
  'I arbeid': 'bg-amber-50 text-amber-900 ring-amber-200',
  Forfaller: 'bg-rose-50 text-rose-900 ring-rose-200',
  Lukket: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
}

type AgendaItem = { id: string; title: string; presenter: string; minutes: number }

const NEXT_AGENDA: AgendaItem[] = [
  { id: '1', title: 'Status arbeidsmiljø-indeks (Q3-snapshot)', presenter: 'HMS-leder', minutes: 15 },
  { id: '2', title: 'Oppfølging åpne vedtak fra Q2', presenter: 'AMU-leder', minutes: 20 },
  { id: '3', title: 'Resultater fra psykososial pulsmåling', presenter: 'Bedriftshelse', minutes: 25 },
  { id: '4', title: 'Risikoanalyse Borgen — gjennomgang', presenter: 'HMS-leder', minutes: 30 },
  { id: '5', title: 'Eventuelt', presenter: '', minutes: 10 },
]

const TOTAL_MINUTES = NEXT_AGENDA.reduce((sum, a) => sum + a.minutes, 0)

export function ModuleSakligAmu() {
  return (
    <div className="-mx-4 -my-6 min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:-mx-8 md:px-10" style={{ backgroundColor: CANVAS }}>
      <div className="mx-auto max-w-6xl space-y-7">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <header className="rounded-2xl border border-amber-200/60 bg-white px-6 py-5 shadow-[0_3px_10px_-6px_rgba(26,61,50,0.15)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <MotifMedvirkning className="mt-1 h-9 w-9 shrink-0" />
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Arbeidsmiljøutvalg
                </div>
                <h1
                  className="text-3xl font-bold leading-tight text-[#1a3d32]"
                  style={{ fontFamily: SERIF }}
                >
                  AMU & verneombud
                </h1>
                <p className="max-w-2xl text-sm text-[#516760]">
                  Møter, vedtak og dekning på tvers av virksomheten. Status etter AML kap. 6 og 7.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#1a3d32]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-amber-50"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden /> Protokoll-historikk
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143027]"
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden /> Planlegg Q4-møte
              </button>
            </div>
          </div>
        </header>

        {/* ── KPI-strip ─────────────────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((kpi) => (
            <article
              key={kpi.id}
              className="rounded-2xl border border-[#1a3d32]/10 bg-white px-5 py-4 shadow-[0_2px_8px_-4px_rgba(26,61,50,0.12)]"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${TONE_DOT[kpi.tone ?? 'neutral']}`} aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#516760]">
                  {kpi.label}
                </span>
              </div>
              <div
                className={`mt-2 text-3xl font-bold leading-none ${TONE_VALUE[kpi.tone ?? 'neutral']}`}
                style={{ fontFamily: SERIF, fontFeatureSettings: '"tnum"' }}
              >
                {kpi.value}
              </div>
              <p className="mt-1.5 text-xs text-[#516760]">{kpi.sub}</p>
            </article>
          ))}
        </section>

        {/* ── Main grid ─────────────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Open decisions */}
          <section className="rounded-2xl border border-[#1a3d32]/10 bg-white shadow-[0_2px_8px_-4px_rgba(26,61,50,0.12)]">
            <header className="flex items-center justify-between border-b border-amber-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                <h2 className="text-sm font-bold text-[#1a3d32]" style={{ fontFamily: SERIF }}>
                  Åpne vedtak
                </h2>
              </div>
              <span className="text-[11px] font-medium text-[#516760]">
                {DECISIONS.filter((d) => d.status !== 'Lukket').length} pågående · {DECISIONS.filter((d) => d.status === 'Lukket').length} lukket
              </span>
            </header>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a3d32]/5 bg-[#FAFAF7] text-left text-[10px] uppercase tracking-wide text-[#516760]">
                  <th className="px-5 py-2 font-semibold">Vedtak</th>
                  <th className="px-3 py-2 font-semibold">Frist</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {DECISIONS.map((d) => (
                  <tr key={d.id} className="border-b border-[#1a3d32]/5 align-top transition-colors hover:bg-amber-50/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#1a3d32]">{d.title}</div>
                      <div className="mt-0.5 text-[11px] text-[#516760]">
                        {d.meeting} · {d.owner}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-[#1a3d32]" style={{ fontFamily: SERIF }}>
                      {d.due}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_PILL[d.status]}`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Next meeting agenda */}
          <section className="rounded-2xl border border-[#1a3d32]/10 bg-white shadow-[0_2px_8px_-4px_rgba(26,61,50,0.12)]">
            <header className="flex items-center justify-between border-b border-amber-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                <h2 className="text-sm font-bold text-[#1a3d32]" style={{ fontFamily: SERIF }}>
                  Neste møte · agenda
                </h2>
              </div>
              <span className="text-[11px] font-medium text-[#516760]">{TOTAL_MINUTES} min</span>
            </header>
            <div className="px-5 py-3 text-xs text-[#516760]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1a3d32]">12. desember 2026</span>
                <span>· 13:00 — 14:40</span>
              </div>
              <p className="mt-1 text-[11px]">Sted: Hovedkontoret, møterom Granåsen · digital deltakelse mulig</p>
            </div>
            <ol className="divide-y divide-[#1a3d32]/5">
              {NEXT_AGENDA.map((a, i) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-amber-300 bg-amber-50 text-center text-xs font-bold leading-6 text-amber-900"
                    style={{ fontFamily: SERIF }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#1a3d32]">{a.title}</div>
                    <div className="mt-0.5 text-[11px] text-[#516760]">
                      {a.presenter && (
                        <>
                          {a.presenter} · {a.minutes} min
                        </>
                      )}
                      {!a.presenter && <>{a.minutes} min</>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <footer className="border-t border-amber-100 px-5 py-3">
              <a
                href="#"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900"
              >
                Åpne i Møter-modulen <ArrowUpRight className="h-3 w-3" aria-hidden />
              </a>
            </footer>
          </section>
        </div>

        {/* ── Verneombud-coverage ─────────────────────────────────── */}
        <section className="rounded-2xl border border-[#1a3d32]/10 bg-white px-5 py-4 shadow-[0_2px_8px_-4px_rgba(26,61,50,0.12)]">
          <header className="mb-4 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <MotifTrygghet className="h-7 w-7" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#516760]">
                  AML § 6-1
                </div>
                <h2
                  className="text-lg font-bold text-[#1a3d32]"
                  style={{ fontFamily: SERIF }}
                >
                  Verneombud-dekning per enhet
                </h2>
              </div>
            </div>
            <span className="text-xs text-[#516760]">7 av 8 enheter dekket</span>
          </header>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { unit: 'Hovedkontoret', name: 'Jens Røstad', covered: true },
              { unit: 'Produksjon Trondheim', name: 'Anne Marie Hauge', covered: true },
              { unit: 'Lager Trondheim', name: 'Olav Strand', covered: true },
              { unit: 'Bergen-avdelingen', name: 'Ikke valgt ennå', covered: false },
              { unit: 'Stavanger', name: 'Petter Sand', covered: true },
              { unit: 'Tromsø', name: 'Maja Lien', covered: true },
              { unit: 'Oslo nord', name: 'Henrik Borg', covered: true },
              { unit: 'Eksterne prosjekter', name: 'Sofie Vik', covered: true },
            ].map((u) => (
              <li
                key={u.unit}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                  u.covered
                    ? 'border-[#1a3d32]/10 bg-[#FAFAF7]'
                    : 'border-rose-200 bg-rose-50'
                }`}
              >
                {u.covered ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1a3d32]">{u.unit}</div>
                  <div className="truncate text-[11px] text-[#516760]">{u.name}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
