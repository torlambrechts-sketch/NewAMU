// Integration teaser on the landing page — honest about which are live vs planned.

import { Link } from 'react-router-dom'
import { INTEGRATIONS, STATUS_META } from '../content/integrations'
import { SectionHeader } from '../primitives/SectionHeader'
import { CREAM, FOREST, TEAL } from '../theme'

const TONE_BG: Record<'live' | 'soon' | 'planned', string> = {
  live: '#22c55e',
  soon: TEAL,
  planned: '#d4a84b',
}

export function IntegrationsTeaserSection() {
  const live = INTEGRATIONS.filter((i) => i.status === 'live')
  const phase2 = INTEGRATIONS.filter((i) => i.status === 'phase2')
  const planned = INTEGRATIONS.filter((i) => i.status === 'planned' || i.status === 'placeholder')

  return (
    <section className="py-20 md:py-28" style={{ background: CREAM }}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <SectionHeader
          eyebrow="Integrasjoner"
          title="Kobles til der det betyr noe"
          lede="Brønnøysund er i produksjon. BankID-signering kommer Q1 2026. Eco-Online, Altinn, Lovdata Pro og Feide SSO er planlagt. Vi forteller deg hva som er ekte og hva som er på veikartet — fordi det er forskjellen mellom et tilsyn og en demo."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { title: 'I produksjon', items: live, tone: 'live' as const },
            { title: 'Q1 2026', items: phase2, tone: 'soon' as const },
            { title: 'Planlagt', items: planned, tone: 'planned' as const },
          ].map((col) => (
            <div key={col.title} className="rounded-2xl border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: TONE_BG[col.tone] }} />
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: FOREST }}>
                  {col.title}
                </h3>
              </div>
              <ul className="space-y-2.5">
                {col.items.map((it) => (
                  <li key={it.name} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0 text-neutral-300">·</span>
                    <div>
                      <p className="font-medium" style={{ color: FOREST }}>{it.name}</p>
                      <p className="text-xs text-neutral-500">{STATUS_META[it.status].label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/integrasjoner"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-neutral-50"
            style={{ color: FOREST }}
          >
            Se alle integrasjoner og status
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
