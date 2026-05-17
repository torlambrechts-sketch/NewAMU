// Etterlevelse teaser on the landing page — links to /etterlevelse for full coverage.

import { Link } from 'react-router-dom'
import { FRAMEWORKS } from '../content/compliance'
import { SectionHeader } from '../primitives/SectionHeader'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'

export function ComplianceTeaserSection() {
  const totalParagraphs = FRAMEWORKS.reduce((sum, f) => sum + f.paragraphs.length, 0)

  return (
    <section id="etterlevelse-teaser" className="py-20 md:py-28" style={{ background: FOREST }}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <SectionHeader
          eyebrow="Etterlevelse"
          title="Bygget på norsk lov, ikke tilpasset etterpå"
          lede={`${FRAMEWORKS.length} rammeverk og ${totalParagraphs}+ paragrafer er kartlagt mot konkrete moduler. Hver mal har en lovreferanse som peker tilbake til kilden — så tilsynet får svaret det leter etter.`}
          tone="dark"
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FRAMEWORKS.slice(0, 6).map((f) => (
            <div
              key={f.short}
              className="rounded-2xl border p-5"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-base font-bold text-white">{f.short}</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                  {f.paragraphs.length} §
                </span>
              </div>
              <p className="text-xs uppercase tracking-widest text-white/45">{f.full}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/etterlevelse"
            className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ background: TEAL, color: FOREST }}
          >
            Se hele dekningsmatrisen
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
