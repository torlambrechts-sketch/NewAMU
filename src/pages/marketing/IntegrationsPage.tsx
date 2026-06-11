// /integrasjoner — honest tiered list with detail per integration.

import { INTEGRATIONS, STATUS_META, type IntegrationStatus } from './content/integrations'
import { SeoHead } from './primitives/SeoHead'
import { SectionHeader } from './primitives/SectionHeader'
import { CtaBannerSection } from './sections/CtaBannerSection'
import { CREAM, FOREST, TEAL } from './theme'

const TONE_COLOR: Record<IntegrationStatus, string> = {
  live: '#22c55e',
  phase2: TEAL,
  planned: '#d4a84b',
  placeholder: '#9ca3af',
}

export function IntegrationsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: 'Klarert integrasjoner',
        itemListElement: INTEGRATIONS.map((it, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: it.name,
          description: it.description,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Klarert', item: 'https://app.klarert.com/' },
          { '@type': 'ListItem', position: 2, name: 'Integrasjoner', item: 'https://app.klarert.com/integrasjoner' },
        ],
      },
    ],
  }

  return (
    <>
      <SeoHead
        title="Integrasjoner — Klarert | BankID, Brønnøysund, Altinn, Eco-Online"
        description="Klarert kobles til Brønnøysund, BankID, Altinn, Eco-Online, Lovdata Pro og Feide. Vi forteller deg hva som er live og hva som er roadmap."
        canonical="https://app.klarert.com/integrasjoner"
        jsonLd={jsonLd}
      />

      <section style={{ background: FOREST }} className="pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
            Integrasjoner
          </p>
          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Kobles til der det betyr noe
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Brønnøysund er i produksjon. BankID-signering kommer Q1 2026. Eco-Online, Altinn,
            Lovdata Pro og Feide SSO er planlagt. Vi forteller deg hva som faktisk er i
            produksjon — ikke bare hva som ligger på veikartet.
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Status"
            title="Alle integrasjoner, ærlig status"
            lede="Vi viser status åpent fordi forskjellen mellom 'live' og 'planlagt' kan være forskjellen mellom et tilsyn og en demo."
          />
          <div className="mt-12 space-y-4">
            {INTEGRATIONS.map((it) => {
              const meta = STATUS_META[it.status]
              return (
                <article
                  key={it.name}
                  className="grid items-start gap-4 rounded-2xl border border-neutral-200 p-6 md:grid-cols-[200px_1fr_120px]"
                  style={{ background: '#fbf9f3' }}
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{it.category}</p>
                    <h3 className="mt-1 text-lg font-semibold" style={{ color: FOREST }}>{it.name}</h3>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: FOREST }}>{it.description}</p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{it.detail}</p>
                  </div>
                  <div className="md:text-right">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                      style={{ background: `${TONE_COLOR[it.status]}22`, color: TONE_COLOR[it.status] }}
                    >
                      <span className="size-1.5 rounded-full" style={{ background: TONE_COLOR[it.status] }} />
                      {meta.label}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24" style={{ background: CREAM }}>
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <SectionHeader
            eyebrow="API-tilgang"
            title="Bygg dine egne koblinger"
            lede="Enterprise-kunder får tilgang til Klarerts read/write-API for å integrere mot eksisterende HR-, lønns- og rapporteringssystemer."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'REST + Row Level Security',
                body: 'Direkte tilgang til Supabase REST-API. RLS sikrer at API-nøkler kun kan lese det organisasjonen din skal se.',
              },
              {
                title: 'Webhooks',
                body: 'Hendelsesutsending (ny sak, ferdig kurs, signert sjekkliste). Skjema er på plass; aktivering kommer sammen med Slack-integrasjonen.',
              },
              {
                title: 'CSV-eksport',
                body: 'Alle moduler har innebygd CSV-eksport av data fra dashbordet. Brukes til revisjon, månedsrapport og dataflytting.',
              },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-neutral-200 bg-white p-6">
                <h3 className="text-sm font-semibold" style={{ color: FOREST }}>{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBannerSection
        heading="Mangler en integrasjon du trenger?"
        body="Vi prioriterer integrasjoner basert på hva kundene faktisk trenger. Si fra hva som mangler, så har det en reell sjanse til å havne på veikartet."
        primaryLabel="Be om en integrasjon"
        primaryTo="/demo"
      />
    </>
  )
}
