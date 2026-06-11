// Final-screen CTA banner — used on landing and at the bottom of every feature page.

import { Link } from 'react-router-dom'
import { FOREST, TEAL } from '../theme'

type Props = {
  heading?: string
  body?: string
  primaryLabel?: string
  primaryTo?: string
}

export function CtaBannerSection({
  heading = 'Klar for å erstatte mappene?',
  body = 'Start en gratis 30-dagerstest. Alle moduler. Ingen kredittkort. Eksport av data når som helst.',
  primaryLabel = 'Kom i gang',
  primaryTo = '/signup',
}: Props) {
  return (
    <section className="py-20 md:py-24" style={{ background: FOREST }}>
      <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
        <h2
          className="text-3xl font-bold tracking-tight text-white md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {heading}
        </h2>
        <p className="mt-4 text-white/60">{body}</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={primaryTo}
            className="inline-flex items-center justify-center rounded-md px-8 py-3.5 text-base font-semibold transition hover:opacity-90"
            style={{ background: TEAL, color: FOREST }}
          >
            {primaryLabel}
          </Link>
          <Link
            to="/demo"
            className="inline-flex items-center justify-center rounded-md border border-white/25 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
          >
            Be om demo
          </Link>
        </div>
      </div>
    </section>
  )
}
