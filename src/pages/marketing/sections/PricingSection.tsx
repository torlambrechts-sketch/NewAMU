// Pricing — kept verbatim from the previous LandingPage (3 tiers: Demo / 690 NOK / Enterprise).

import { Link } from 'react-router-dom'
import { SectionHeader } from '../primitives/SectionHeader'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'
const CREAM = '#f5f0e8'

const TIERS = [
  {
    name: 'Prøv gratis',
    price: 'Demo',
    period: '',
    features: ['Alle moduler', 'Forhåndsutfylt data', '10 sekunder oppstart', 'Ingen registrering'],
    cta: 'Start demo',
    href: '/login?demo=1',
    highlight: false,
  },
  {
    name: 'Liten virksomhet',
    price: 'fra 690',
    period: 'kr/mnd',
    features: ['Opp til 50 ansatte', 'Alle moduler', 'EU-hosting (Supabase)', 'E-post support'],
    cta: 'Opprett konto',
    href: '/signup',
    highlight: true,
  },
  {
    name: 'Større virksomhet',
    price: 'Kontakt oss',
    period: '',
    features: ['Ubegrenset ansatte', 'SSO og tilgangsstyring', 'Onboarding og opplæring', 'Dedikert support'],
    cta: 'Ta kontakt',
    href: 'mailto:hei@klarert.com?subject=Enterprise%20Klarert',
    highlight: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-28" style={{ background: CREAM }}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <SectionHeader
          eyebrow="Pris"
          title="Enkle priser. Alle moduler inkludert."
          lede="Én pris dekker alle seks moduler. Ingen overraskelser, ingen tilleggsmoduler å kjøpe når et behov dukker opp."
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
