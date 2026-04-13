import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList } from 'lucide-react'

/**
 * Dedikert innføring i årskontroll (PDCA Check/Act) med lenke til utfylling under Internkontroll.
 * Data lagres via eksisterende internkontroll-modul (org-modul payload / Supabase).
 */
export function YearskontrollModule() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-sm">
          <ClipboardList className="size-6 text-[#1a3d32]" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Årskontroll</h1>
          <p className="text-sm text-neutral-500">Koblet til ROS og årsgjennomgang (IK-f § 5 nr. 8)</p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm leading-relaxed text-neutral-700">
          ROS-analyse er ferskvare. Årskontrollen (årlig gjennomgang / revisjon) sikrer at tiltak følges opp og at
          risikobildet stemmer med virkeligheten — i tråd med <strong>PDCA</strong> (Plan–Do–<strong>Check</strong>–
          <strong>Act</strong>), der årskontrollen dekker Check- og Act-fasen.
        </p>

        <h2 className="mt-6 text-sm font-semibold text-neutral-900">Hovedkategorier i årskontrollen</h2>
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm text-neutral-700">
          <li>
            <strong>Status på tiltaksplan</strong> — fremdrift: er planlagte risikoreduserende tiltak gjennomført i tide
            og av riktig ansvarlig? Ressursbruk: tid og kost vs. forventning?
          </li>
          <li>
            <strong>Effektevaluering</strong> — har tiltakene faktisk redusert restrisikoen? (Nytt system uten opplæring
            kan f.eks. etterlate menneskelig risiko uendret.)
          </li>
          <li>
            <strong>Hendelser og avvik</strong> — faktiske hendelser og «nesten-ulykker». Hvis noe inntreffer som ROS sa
            var «lite sannsynlig», må sannsynlighet og matrise justeres.
          </li>
          <li>
            <strong>Endringer i trusselbildet</strong> — ny teknologi, arbeidsmåter, omorganisering, systemarkitektur;
            nye lover, forskrifter eller krav fra kunder/partnere.
          </li>
        </ol>

        <div className="mt-8 rounded-md border border-[#1a3d32]/25 bg-[#f4f7f5] p-4">
          <p className="text-sm font-medium text-[#1a3d32]">Utfyll skjemaet i Internkontroll</p>
          <p className="mt-1 text-xs text-neutral-600">
            Neste revisjonsdato, signaturhistorikk og endringslogg ligger i årsgjennomgang-fanen. Oppgaver fra
            handlingsplan opprettes ved leder-signatur som før.
          </p>
          <Link
            to="/internal-control?tab=annual&focus=yearskontroll"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#1a3d32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#142e26]"
          >
            Gå til årsgjennomgang / årskontroll
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <Link
            to="/internal-control?tab=ros"
            className="ml-3 text-sm font-medium text-[#1a3d32] underline"
          >
            ROS / risiko
          </Link>
        </div>
      </div>
    </div>
  )
}
