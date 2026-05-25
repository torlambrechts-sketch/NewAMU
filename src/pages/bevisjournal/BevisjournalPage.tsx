// "Bevisjournal" — append-only evidence ledger landing. The data
// itself lives in internkontroll's evidence stub today; this page is
// the auditor-facing entry surface that explains what bevisjournalen
// is and routes users to the existing detail flate. A follow-up will
// aggregate evidence from every module behind a shared share-token
// (see /controls auditor-token pattern from compliance-layer).

import { Link } from 'react-router-dom'
import { ArrowUpRight, ExternalLink, History, ScrollText, ShieldCheck } from 'lucide-react'

const CREAM_DEEP = '#EFE8DC'
const FOREST = '#1a3d32'

export function BevisjournalPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          <ShieldCheck className="size-3.5" aria-hidden />
          Styringssystem · Bevisjournal
        </div>
        <h1
          className="mt-2 font-serif text-3xl font-medium tracking-tight text-neutral-900 md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Bevisjournal
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Den uforanderlige bevisledgeren. Hver gang en kontroll utføres,
          en aktivitet lukkes, eller en signatur faller — landes det her som
          en signert post som ikke kan endres eller slettes. Del en token-
          lenke med revisor, og de ser hele sannheten på sekunder.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/overview/internkontroll?section=revisjon"
          className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
          style={{ background: CREAM_DEEP }}
        >
          <div className="flex items-center gap-2">
            <ScrollText className="size-4" aria-hidden style={{ color: FOREST }} />
            <h2
              className="font-serif text-lg font-medium text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Revisjonslogg pr. paragraf
            </h2>
          </div>
          <p className="text-sm text-neutral-700">
            Bla i evidensen pr. § med tidslinje, signaturer og lenker til
            kilde-dokumentene. Default-flate i dag — vil flyttes hit i Fase 2.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 group-hover:text-neutral-800">
            Åpne revisjonslogg <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </Link>

        <Link
          to="/controls"
          className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
          style={{ background: CREAM_DEEP }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" aria-hidden style={{ color: '#1e40af' }} />
            <h2
              className="font-serif text-lg font-medium text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Kontroll-bevis (Tier 2)
            </h2>
          </div>
          <p className="text-sm text-neutral-700">
            Per-kontroll bevisflyt fra compliance-layer. Auditor-token
            shareable: revisor får read-only token-lenke til hele bevis-
            bunken uten å logge inn.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 group-hover:text-neutral-800">
            Åpne Kontroller <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </Link>

        <Link
          to="/admin/settings/audit"
          className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
          style={{ background: CREAM_DEEP }}
        >
          <div className="flex items-center gap-2">
            <History className="size-4" aria-hidden style={{ color: '#a88332' }} />
            <h2
              className="font-serif text-lg font-medium text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Audit-logg (system)
            </h2>
          </div>
          <p className="text-sm text-neutral-700">
            System-level audit av brukerhandlinger, RBAC-endringer og
            sensitive operasjoner. Forskjellig fra bevisjournalen —
            audit-loggen er for IT-sikkerhet, bevisjournalen for HMS-revisjon.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 group-hover:text-neutral-800">
            Åpne Audit-logg <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </Link>

        <a
          href="https://www.arbeidstilsynet.no/hms/internkontroll/krav-til-dokumentasjon/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
          style={{ background: CREAM_DEEP }}
        >
          <div className="flex items-center gap-2">
            <ExternalLink className="size-4" aria-hidden style={{ color: '#0891b2' }} />
            <h2
              className="font-serif text-lg font-medium text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              IK § 5 · Krav til dokumentasjon
            </h2>
          </div>
          <p className="text-sm text-neutral-700">
            Arbeidstilsynet om hvilken HMS-dokumentasjon som er obligatorisk
            skriftlig — punktene 4–8 i internkontrollforskriften.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 group-hover:text-neutral-800">
            Åpne Arbeidstilsynet.no <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </a>
      </div>

      <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        Styringssystem · Bevisjournal · Aggregator (Fase 2) henter fra
        compliance · meetings.protocol · BHT · ARB-15/17/23 målinger ·
        TID-1/3/5 timeregistrering
      </p>
    </div>
  )
}
