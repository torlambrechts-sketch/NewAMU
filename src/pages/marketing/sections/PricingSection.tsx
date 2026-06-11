// Pricing — 3 tiers (gratis prøve / 690 NOK / Enterprise). H3.5: copy
// anchored to outcomes (timer spart, revisjonsklar dokumentasjon) instead of
// module counts, and the dead /login?demo=1 CTA replaced with /signup (the
// demo query param was never handled by AuthPage).

import { Link } from 'react-router-dom'
import { SectionHeader } from '../primitives/SectionHeader'
import { CREAM, FOREST, TEAL } from '../theme'

const TIERS = [
  {
    name: 'Prøv gratis i 30 dager',
    price: 'Gratis',
    period: '',
    features: [
      'Alle moduler — full funksjonalitet',
      'Ferdige maler: kom i gang samme dag',
      'Ingen betalingskort, ingen binding',
      'Behold alt du har lagt inn ved kjøp',
    ],
    cta: 'Start gratis prøveperiode',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Liten virksomhet',
    price: 'fra 690',
    period: 'kr/mnd · per organisasjon',
    features: [
      'Spar timer hver måned: frister, møter og oppfølging purres automatisk',
      'Revisjonsklar dokumentasjon når Arbeidstilsynet spør — ikke ukene før',
      'Én pris, alle moduler — opp til 50 ansatte',
      'EU-hosting · support innen 1 virkedag',
    ],
    cta: 'Opprett konto',
    href: '/signup',
    highlight: true,
  },
  {
    name: 'Større virksomhet',
    price: 'Kontakt oss',
    period: '',
    features: [
      'Ubegrenset antall ansatte',
      'SSO og tilgangsstyring',
      'Innføring og opplæring for HMS-teamet',
      'Dedikert kundestøtte',
    ],
    cta: 'Ta kontakt',
    href: '/kontakt',
    highlight: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-28" style={{ background: CREAM }}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <SectionHeader
          eyebrow="Pris"
          title="Hva koster det å slippe å jakte på dokumentasjon?"
          lede="Pris per organisasjon — ikke per modul, ikke per bruker. Typisk sparer en HMS-ansvarlig flere timer i uken på automatiske frister, møtereferater og revisjonsklar dokumentasjon."
        />
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-3">
          {TIERS.map(({ name, price, period, features, cta, href, highlight }) => (
            <div
              key={name}
              className={`flex flex-col rounded-2xl p-6 ${highlight ? 'shadow-lg' : 'border border-neutral-200 bg-white'}`}
              style={highlight ? { background: FOREST } : {}}
            >
              <h3 className={`text-sm font-semibold uppercase tracking-wide ${highlight ? 'text-white/60' : 'text-neutral-500'}`}>{name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${highlight ? 'text-white' : ''}`} style={!highlight ? { color: FOREST } : {}}>
                  {price}
                </span>
                {period && <span className={`text-sm ${highlight ? 'text-white/60' : 'text-neutral-500'}`}>{period}</span>}
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0" style={{ color: TEAL }}>✓</span>
                    <span className={highlight ? 'text-white/80' : 'text-neutral-700'}>{f}</span>
                  </li>
                ))}
              </ul>
              {href.startsWith('mailto') ? (
                <a
                  href={href}
                  className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition ${highlight ? 'hover:opacity-90' : 'border border-neutral-300 hover:bg-neutral-50'}`}
                  style={highlight ? { background: TEAL, color: FOREST } : {}}
                >
                  {cta}
                </a>
              ) : (
                <Link
                  to={href}
                  className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition ${highlight ? 'hover:opacity-90' : 'border border-neutral-300 hover:bg-neutral-50'}`}
                  style={highlight ? { background: TEAL, color: FOREST } : {}}
                >
                  {cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
