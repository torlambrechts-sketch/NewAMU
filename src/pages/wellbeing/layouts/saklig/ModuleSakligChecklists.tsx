// ModuleSakligChecklists — sjekklister + vernerunder-modul i Saklig-
// stilen. Vis at det in-between-uttrykket fungerer like godt for et
// tett listebilde som for et oversikts-dashbord — samme palette,
// samme typografi, men nå tilpasset filter-rad + tabell-flate.

import {
  CheckCircle2,
  ClipboardList,
  Download,
  Filter,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  MotifTrygghet,
} from '../../components/AxisMotifs'

const SERIF = "'Libre Baskerville', Georgia, serif"
const CANVAS = '#FAFAF7'

type Pack = 'AML-AMU' | 'ISO 45001'
type Status = 'Klar til signering' | 'Pågående' | 'Forfalt' | 'Signert'

type ChecklistRow = {
  id: string
  template: string
  unit: string
  pack: Pack
  owner: string
  due: string
  progress: number
  status: Status
}

const ROWS: ChecklistRow[] = [
  { id: '1', template: 'Månedlig HMS-runde — Produksjon', unit: 'Trondheim', pack: 'AML-AMU', owner: 'Anne Marie Hauge', due: '15. mai', progress: 100, status: 'Klar til signering' },
  { id: '2', template: 'Kvartalsvis § 4-3 oppfølging', unit: 'Hovedkontor', pack: 'AML-AMU', owner: 'Mona Vestby', due: '20. mai', progress: 75, status: 'Pågående' },
  { id: '3', template: 'Vernerunde Bergen Q2', unit: 'Bergen', pack: 'AML-AMU', owner: 'Verneombud Bergen', due: '08. mai', progress: 40, status: 'Forfalt' },
  { id: '4', template: 'ISO 45001 § 10.2 årlig revisjon', unit: 'Selskaps-bredt', pack: 'ISO 45001', owner: 'HMS-leder', due: '01. juni', progress: 60, status: 'Pågående' },
  { id: '5', template: 'Sikkerhetsrunde lager', unit: 'Trondheim', pack: 'AML-AMU', owner: 'Olav Strand', due: '22. mai', progress: 100, status: 'Klar til signering' },
  { id: '6', template: 'Risikoanalyse Borgen-prosjekt', unit: 'Prosjekt Borgen', pack: 'AML-AMU', owner: 'HMS-leder', due: '03. mai', progress: 100, status: 'Signert' },
  { id: '7', template: 'Brann- og evakueringsrunde', unit: 'Stavanger', pack: 'AML-AMU', owner: 'Petter Sand', due: '11. mai', progress: 100, status: 'Signert' },
  { id: '8', template: 'Vernerunde Q2 — Tromsø', unit: 'Tromsø', pack: 'AML-AMU', owner: 'Maja Lien', due: '14. mai', progress: 25, status: 'Pågående' },
]

const STATUS_PILL: Record<Status, string> = {
  'Klar til signering': 'bg-amber-50 text-amber-900 ring-amber-200',
  Pågående: 'bg-[#1a3d32]/5 text-[#1a3d32] ring-[#1a3d32]/15',
  Forfalt: 'bg-rose-50 text-rose-900 ring-rose-200',
  Signert: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
}

const PACK_PILL: Record<Pack, string> = {
  'AML-AMU': 'bg-[#1a3d32]/5 text-[#1a3d32]',
  'ISO 45001': 'bg-blue-50 text-blue-900',
}

type Filter = 'alle' | Status

export function ModuleSakligChecklists() {
  return (
    <div className="-mx-4 -my-6 min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:-mx-8 md:px-10" style={{ backgroundColor: CANVAS }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <header className="rounded-2xl border border-amber-200/60 bg-white px-6 py-5 shadow-[0_3px_10px_-6px_rgba(26,61,50,0.15)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <MotifTrygghet className="mt-1 h-9 w-9 shrink-0" />
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Sjekklister & Vernerunder
                </div>
                <h1
                  className="text-3xl font-bold leading-tight text-[#1a3d32]"
                  style={{ fontFamily: SERIF }}
                >
                  Pågående HMS-runder
                </h1>
                <p className="max-w-2xl text-sm text-[#516760]">
                  Åtte aktive sjekklister på tvers av AML-AMU og ISO 45001-pakker. En forfalt;
                  to klare til signering.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#1a3d32]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-amber-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Eksporter rapport
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143027]"
              >
                <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Start ny runde
              </button>
            </div>
          </div>

          {/* Summary chips */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Aktive', value: '6', tone: 'neutral' },
              { label: 'Forfalt', value: '1', tone: 'risk' },
              { label: 'Klare til signering', value: '2', tone: 'warn' },
              { label: 'Signert i år', value: '47', tone: 'good' },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border px-4 py-3 ${
                  s.tone === 'risk'
                    ? 'border-rose-200 bg-rose-50/60'
                    : s.tone === 'warn'
                    ? 'border-amber-200 bg-amber-50/60'
                    : s.tone === 'good'
                    ? 'border-emerald-200 bg-emerald-50/60'
                    : 'border-[#1a3d32]/10 bg-[#FAFAF7]'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#516760]">
                  {s.label}
                </div>
                <div
                  className="mt-1 text-2xl font-bold leading-none text-[#1a3d32]"
                  style={{ fontFamily: SERIF, fontFeatureSettings: '"tnum"' }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* ── Toolbar ──────────────────────────────────────────────── */}
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#1a3d32]/10 bg-white px-4 py-3 shadow-[0_2px_8px_-4px_rgba(26,61,50,0.10)]">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#516760]" aria-hidden />
            <input
              type="search"
              placeholder="Søk i sjekklister …"
              className="w-full rounded-md border border-[#1a3d32]/15 bg-[#FAFAF7] py-1.5 pl-8 pr-3 text-sm text-[#1a3d32] placeholder-[#516760]/60 focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          {/* Filter pills */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-md bg-[#FAFAF7] p-0.5 ring-1 ring-inset ring-[#1a3d32]/10">
            {(['alle', 'Pågående', 'Forfalt', 'Klar til signering', 'Signert'] as Filter[]).map((f, i) => (
              <button
                key={f}
                type="button"
                className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  i === 0
                    ? 'bg-white text-[#1a3d32] shadow-sm'
                    : 'text-[#516760] hover:text-[#1a3d32]'
                }`}
              >
                {f === 'alle' ? 'Alle' : f}
              </button>
            ))}
          </div>

          {/* Secondary filters */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#1a3d32]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1a3d32] hover:bg-amber-50"
          >
            <Filter className="h-3 w-3" aria-hidden /> Pakke · Alle
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#1a3d32]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1a3d32] hover:bg-amber-50"
          >
            <Filter className="h-3 w-3" aria-hidden /> Enhet · Alle
          </button>
        </section>

        {/* ── Table ──────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-[#1a3d32]/10 bg-white shadow-[0_2px_8px_-4px_rgba(26,61,50,0.12)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-100 bg-[#FAFAF7] text-left text-[10px] uppercase tracking-wide text-[#516760]">
                <th className="px-5 py-3 font-semibold" style={{ fontFamily: SERIF }}>
                  Sjekkliste
                </th>
                <th className="px-3 py-3 font-semibold" style={{ fontFamily: SERIF }}>
                  Enhet
                </th>
                <th className="px-3 py-3 font-semibold" style={{ fontFamily: SERIF }}>
                  Pakke
                </th>
                <th className="px-3 py-3 font-semibold" style={{ fontFamily: SERIF }}>
                  Ansvarlig
                </th>
                <th className="px-3 py-3 font-semibold" style={{ fontFamily: SERIF }}>
                  Frist
                </th>
                <th className="px-3 py-3 font-semibold" style={{ fontFamily: SERIF }}>
                  Fremdrift
                </th>
                <th className="px-3 py-3 font-semibold" style={{ fontFamily: SERIF }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.id}
                  className={`align-middle transition-colors hover:bg-amber-50/30 ${
                    i < ROWS.length - 1 ? 'border-b border-[#1a3d32]/5' : ''
                  }`}
                >
                  <td className="px-5 py-3">
                    <div className="font-semibold text-[#1a3d32]">{row.template}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-[#516760]">{row.unit}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${PACK_PILL[row.pack]}`}
                    >
                      {row.pack}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-[#1a3d32]">{row.owner}</td>
                  <td
                    className={`px-3 py-3 text-xs ${
                      row.status === 'Forfalt' ? 'font-semibold text-rose-700' : 'text-[#1a3d32]'
                    }`}
                    style={{ fontFamily: SERIF }}
                  >
                    {row.due}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#1a3d32]/10">
                        <div
                          className={`h-1.5 rounded-full ${
                            row.progress === 100
                              ? 'bg-emerald-500'
                              : row.status === 'Forfalt'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${row.progress}%` }}
                        />
                      </div>
                      <span
                        className="w-8 text-[10px] font-bold text-[#516760]"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {row.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_PILL[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="flex items-center justify-between border-t border-[#1a3d32]/5 bg-[#FAFAF7] px-5 py-3">
            <p className="text-[11px] text-[#516760]">Viser 8 av 12 aktive sjekklister.</p>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900"
            >
              Se alle <Sparkles className="h-3 w-3" aria-hidden />
            </a>
          </footer>
        </section>

        {/* ── Bunntips ─────────────────────────────────────────────── */}
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/30 px-5 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div>
            <h3
              className="text-sm font-bold text-[#1a3d32]"
              style={{ fontFamily: SERIF }}
            >
              To sjekklister venter på signering
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[#516760]">
              Begge er 100% utfylt og venter på signering fra autorisert leder. Klikk en av
              dem i listen over, eller åpne signaturkøen via «Eksporter rapport».
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
