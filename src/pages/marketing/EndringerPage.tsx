// /endringer — public changelog of platform updates and law changes.
// The single highest-leverage piece of content for the compliance audience:
// proof the system is maintained as the law evolves.

import { Link } from 'react-router-dom'
import { CHANGELOG, CATEGORY_META, type ChangeEntry } from './content/endringer'
import { SeoHead } from './primitives/SeoHead'
import { SectionHeader } from './primitives/SectionHeader'
import { CtaBannerSection } from './sections/CtaBannerSection'
import { FOREST, TEAL, CREAM } from './theme'

function formatDate(iso: string): string {
  const months = [
    'januar', 'februar', 'mars', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'desember',
  ]
  const [y, m, d] = iso.split('-')
  return `${parseInt(d, 10)}. ${months[parseInt(m, 10) - 1]} ${y}`
}

function ChangeCard({ entry }: { entry: ChangeEntry }) {
  const meta = CATEGORY_META[entry.category]
  return (
    <article className="grid gap-4 rounded-2xl border border-neutral-200 p-6 md:grid-cols-[180px_1fr] md:p-7" style={{ background: '#fbf9f3' }}>
      <div>
        <time dateTime={entry.date} className="text-sm font-bold" style={{ color: FOREST }}>
          {formatDate(entry.date)}
        </time>
        <div className="mt-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${meta.tone}18`, color: meta.tone }}
          >
            <span className="size-1.5 rounded-full" style={{ background: meta.tone }} />
            {meta.label}
          </span>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold tracking-tight" style={{ color: FOREST }}>
          {entry.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">{entry.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {entry.modules?.map((m) => (
            <span key={m} className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 font-medium" style={{ color: FOREST }}>
              {m}
            </span>
          ))}
          {entry.lawRef && (
            <span className="rounded-full px-2.5 py-1 font-medium" style={{ background: FOREST, color: 'white' }}>
              {entry.lawRef}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Klarert', item: 'https://app.klarert.com/' },
        { '@type': 'ListItem', position: 2, name: 'Endringer', item: 'https://app.klarert.com/endringer' },
      ],
    },
  ],
}

export function EndringerPage() {
  const sorted = [...CHANGELOG].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <SeoHead
        title="Endringer — Klarert | Lovendringer og oppdaterte maler"
        description="Når arbeidsmiljøloven, IK-forskriften eller GDPR endres oppdaterer vi systemmalene og forklarer hva som har skjedd. Komplett endringslogg."
        canonical="https://app.klarert.com/endringer"
        jsonLd={JSON_LD}
      />

      <section style={{ background: FOREST }} className="pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
            Endringer
          </p>
          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Når loven endres, endrer vi systemet
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Vi overvåker arbeidsmiljøloven, internkontrollforskriften, GDPR og Likestillingsloven.
            Når noe endres, oppdaterer vi systemmalene og forklarer hva som har skjedd —
            slik at du slipper å lese Lovdata for å holde tritt.
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <SectionHeader
            eyebrow={`${sorted.length} oppføringer`}
            title="Komplett endringslogg"
            lede="Nyeste først. Lovendringer og mal-oppdateringer merkes tydelig så du kan vurdere konsekvens for din virksomhet."
          />
          <div className="mt-12 space-y-4">
            {sorted.map((e) => (
              <ChangeCard key={`${e.date}-${e.title}`} entry={e} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20" style={{ background: CREAM }}>
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h2
            className="text-2xl font-bold tracking-tight md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}
          >
            Vil du varsles om endringer?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-700">
            Kunder får en kort månedsoppsummering på e-post av hva som har endret seg —
            både i produktet og i lovverket. Ingen «visste du at»-markedsføring, bare det
            som faktisk angår deg.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md px-7 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ background: FOREST, color: 'white' }}
          >
            Bli kunde
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <CtaBannerSection
        heading="Klar for å la systemet holde tritt?"
        body="Start gratis. Vi gir beskjed når loven endres — du gjør HMS-arbeidet."
        primaryLabel="Kom i gang"
        primaryTo="/signup"
      />
    </>
  )
}
