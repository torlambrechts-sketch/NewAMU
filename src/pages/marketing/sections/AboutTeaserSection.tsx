// About teaser — short mission + founder line, full bio at /om-oss.

import { Link } from 'react-router-dom'
import { FOREST, TEAL } from '../theme'

export function AboutTeaserSection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
          Om Klarert
        </p>
        <h2
          className="text-center text-3xl font-bold leading-tight tracking-tight md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}
        >
          Vi bygger etterlevelse vi selv ville stolt på
        </h2>
        <div className="mx-auto mt-8 max-w-2xl space-y-4 text-base leading-relaxed text-neutral-700">
          <p>
            Klarert er bygget for norske virksomheter — av folk som har sittet i AMU-møter,
            skrevet vernerunderapporter for hånd og forklart Arbeidstilsynet hva som mangler.
            Vi tror etterlevelse ikke skal være en mappestruktur du oppdaterer kvartalsvis.
            Det skal være en del av hvordan systemet fungerer.
          </p>
          <p>
            Plattformen er bygget i Norge, kjører på Supabase i EU og styres av Row Level Security
            på databasenivå — ikke av «vær så snill, ikke gjør dette»-regler i koden. Tre prinsipper
            følger gjennom hele systemet: <span className="font-semibold" style={{ color: FOREST }}>norsk-først</span>,{' '}
            <span className="font-semibold" style={{ color: FOREST }}>lovverket innebygd</span> og{' '}
            <span className="font-semibold" style={{ color: FOREST }}>ingen mørke mønstre</span>.
          </p>
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/om-oss"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: FOREST }}
          >
            Hele historien
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
