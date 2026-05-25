// "Rammeverk & gap" — unified frameworks crosswalk. Today four
// separate surfaces compete for the same mental space (Regelverk-
// dekning, ISO IMS Analyse, ISO Gap, SoA). This page is the single
// entry that routes users to the right surface per framework.

import { Link } from 'react-router-dom'
import { ArrowUpRight, BarChart3, FileText, Scale, ShieldCheck } from 'lucide-react'

const CREAM_DEEP = '#EFE8DC'

type Framework = {
  id: string
  name: string
  shortName: string
  description: string
  to: string
  color: string
  status: 'live' | 'partial' | 'planned'
}

const FRAMEWORKS: Framework[] = [
  {
    id: 'aml',
    name: 'Arbeidsmiljøloven (AML)',
    shortName: 'AML + IK § 5',
    description:
      '101 kontroller forankret i AML og fire nøkkelforskrifter (Internkontroll, FOR-1355, FOR-1357, Arbeidsplass). Hovedrammeverk for norske virksomheter.',
    to: '/overview/regelverk',
    color: '#1a3d32',
    status: 'live',
  },
  {
    id: 'iso-45001',
    name: 'ISO 45001:2018',
    shortName: 'ISO 45001',
    description:
      'Internasjonal HMS-standard. Mapper ryddig til AML, men har tre "lim-klausuler" (4.1 kontekst, 6.1.2.3 muligheter, 9.3 ledelsens gjennomgåelse) som krever ekstra kontroller.',
    to: '/iso/analyse',
    color: '#1e40af',
    status: 'live',
  },
  {
    id: 'iso-27001',
    name: 'ISO 27001:2022',
    shortName: 'ISO 27001 + SoA',
    description:
      'Informasjonssikkerhet. Statement of Applicability (SoA) mapper Annex A-kontrollene mot virksomhetens scope.',
    to: '/iso/soa',
    color: '#0f766e',
    status: 'live',
  },
  {
    id: 'gdpr',
    name: 'GDPR / Personvernforordningen',
    shortName: 'GDPR',
    description:
      'Personopplysningsloven + GDPR Art. 30 (behandlingsprotokoll), Art. 33–34 (brudd-varsling). Sees i Register-modulen for behandlinger.',
    to: '/registers',
    color: '#7c3aed',
    status: 'partial',
  },
  {
    id: 'iso-14001',
    name: 'ISO 14001:2015',
    shortName: 'ISO 14001',
    description: 'Miljøledelse. Crosswalk-mapping kommer.',
    to: '/iso/analyse',
    color: '#0e7490',
    status: 'planned',
  },
  {
    id: 'iso-9001',
    name: 'ISO 9001:2015',
    shortName: 'ISO 9001',
    description: 'Kvalitetsledelse. Crosswalk-mapping kommer.',
    to: '/iso/analyse',
    color: '#c2410c',
    status: 'planned',
  },
]

const STATUS_LABELS: Record<Framework['status'], { label: string; cls: string }> = {
  live: { label: 'Aktiv', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  partial: { label: 'Delvis', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  planned: { label: 'Planlagt', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}

export function RammeverkPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          <Scale className="size-3.5" aria-hidden />
          Styringssystem · Rammeverk & gap
          <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800">
            Fase 1 · Rammeverk-velger
          </span>
        </div>
        <h1
          className="mt-2 font-serif text-3xl font-medium tracking-tight text-neutral-900 md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Rammeverk &amp; gap
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Velg rammeverk for å se dekning. Fase 1 ruter til de eksisterende
          analyse- og gap-flatene (AML, ISO 45001, ISO 27001, GDPR); Fase 2
          legger til samlet crosswalk-prosent på tvers av rammeverk.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FRAMEWORKS.map((fw) => {
          const status = STATUS_LABELS[fw.status]
          return (
            <Link
              key={fw.id}
              to={fw.to}
              className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
              style={{ background: CREAM_DEEP }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="size-4" aria-hidden style={{ color: fw.color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    {fw.shortName}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>
              <h2
                className="font-serif text-lg font-medium leading-tight text-neutral-900"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {fw.name}
              </h2>
              <p className="text-sm leading-relaxed text-neutral-700">{fw.description}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 group-hover:text-neutral-800">
                Åpne dekning <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
            </Link>
          )
        })}
      </div>

      {/* Quick links to the underlying surfaces */}
      <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link
          to="/iso/gap"
          className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-400"
        >
          <BarChart3 className="size-4 text-neutral-500" aria-hidden />
          <span className="text-sm font-medium text-neutral-800">ISO Gap-analyse</span>
          <ArrowUpRight className="ml-auto size-3.5 text-neutral-300" aria-hidden />
        </Link>
        <Link
          to="/iso/soa"
          className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-400"
        >
          <ShieldCheck className="size-4 text-neutral-500" aria-hidden />
          <span className="text-sm font-medium text-neutral-800">SoA (ISO 27001)</span>
          <ArrowUpRight className="ml-auto size-3.5 text-neutral-300" aria-hidden />
        </Link>
        <Link
          to="/iso/innstillinger"
          className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-400"
        >
          <FileText className="size-4 text-neutral-500" aria-hidden />
          <span className="text-sm font-medium text-neutral-800">ISO Innstillinger</span>
          <ArrowUpRight className="ml-auto size-3.5 text-neutral-300" aria-hidden />
        </Link>
      </div>

      <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        Styringssystem · Rammeverk & gap · ISO 45001 / 27001 / AML / GDPR
      </p>
    </div>
  )
}
