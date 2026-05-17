// Dynamic /features/:slug page — one component, six content slugs.
// Unknown slug renders NotFound; valid slug pulls from features content table.

import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { FEATURES, featureBySlug, type ModuleFeature } from './content/features'
import { SeoHead } from './primitives/SeoHead'
import { BrowserMockup } from './primitives/BrowserMockup'
import { ModuleMockup } from './primitives/ModuleMockup'
import { LawRefChip } from './primitives/LawRefChip'
import { SectionHeader } from './primitives/SectionHeader'
import { CtaBannerSection } from './sections/CtaBannerSection'
import { NotFound } from '../NotFound'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'
const CREAM = '#f5f0e8'

export function FeaturePage() {
  const { slug } = useParams<{ slug: string }>()
  const feature = slug ? featureBySlug(slug) : undefined

  const jsonLd = useMemo(() => {
    if (!feature) return undefined
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          name: `Klarert ${feature.name}`,
          description: feature.metaDescription,
          brand: { '@type': 'Brand', name: 'Klarert' },
          category: 'BusinessApplication',
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Klarert', item: 'https://app.klarert.com/' },
            { '@type': 'ListItem', position: 2, name: 'Funksjoner' },
            { '@type': 'ListItem', position: 3, name: feature.name, item: `https://app.klarert.com/features/${feature.slug}` },
          ],
        },
      ],
    }
  }, [feature])

  if (!feature) return <NotFound />

  return (
    <>
      <SeoHead
        title={feature.metaTitle}
        description={feature.metaDescription}
        canonical={`https://app.klarert.com/features/${feature.slug}`}
        jsonLd={jsonLd}
      />
      <FeatureHero feature={feature} />
      <FeatureMockupSection feature={feature} />
      <FeatureCapabilities feature={feature} />
      <FeatureStandout feature={feature} />
      <FeatureLawCoverage feature={feature} />
      <FeatureRelated feature={feature} />
      <CtaBannerSection />
    </>
  )
}

function FeatureHero({ feature }: { feature: ModuleFeature }) {
  return (
    <section style={{ background: FOREST }} className="pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
          {feature.eyebrow}
        </p>
        <h1
          className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {feature.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
          {feature.longDescription}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-md px-7 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ background: TEAL, color: FOREST }}
          >
            Prøv gratis 30 dager
          </Link>
          <a
            href="mailto:hei@klarert.com?subject=Demo%20av%20Klarert"
            className="inline-flex items-center justify-center rounded-md border border-white/25 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Be om demo
          </a>
        </div>
      </div>
    </section>
  )
}

function FeatureMockupSection({ feature }: { feature: ModuleFeature }) {
  return (
    <section className="-mt-6 pb-16 md:-mt-10 md:pb-20" style={{ background: FOREST }}>
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <figure aria-label={`Skjermbilde av ${feature.name}-modulen i Klarert`}>
          <BrowserMockup url={`app.klarert.com/${feature.slug}`}>
            <ModuleMockup slug={feature.slug} />
          </BrowserMockup>
          <figcaption className="sr-only">{feature.lede}</figcaption>
        </figure>
      </div>
    </section>
  )
}

function FeatureCapabilities({ feature }: { feature: ModuleFeature }) {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <SectionHeader
          eyebrow="Kapabiliteter"
          title={`Dette dekker ${feature.name.toLowerCase()}`}
          lede={feature.lede}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {feature.capabilities.map((c) => (
            <article
              key={c.title}
              className="rounded-2xl border border-neutral-200 p-6 transition-shadow hover:shadow-md"
              style={{ background: '#fbf9f3' }}
            >
              <div
                className="mb-3 flex size-9 items-center justify-center rounded-lg text-sm font-bold"
                style={{ background: TEAL, color: FOREST }}
              >
                ✓
              </div>
              <h3 className="mb-2 text-base font-semibold" style={{ color: FOREST }}>{c.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{c.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureStandout({ feature }: { feature: ModuleFeature }) {
  return (
    <section className="py-20 md:py-24" style={{ background: CREAM }}>
      <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
          Det som er annerledes
        </p>
        <h2
          className="text-3xl font-bold tracking-tight md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}
        >
          {feature.standoutTitle}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-700 md:text-lg">
          {feature.standoutBody}
        </p>
      </div>
    </section>
  )
}

function FeatureLawCoverage({ feature }: { feature: ModuleFeature }) {
  return (
    <section className="py-20 md:py-24 bg-white">
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <SectionHeader
          eyebrow="Hjemmel"
          title="Hvilke lover dette dekker"
          lede="Hver mal og hvert workflow-skritt i Klarert har en konkret lovreferanse. Når tilsynet spør, har du svaret."
        />
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {feature.lawRefs.map((r) => (
            <LawRefChip key={r.short} lawRef={r} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/compliance"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: FOREST }}
          >
            Se hele dekningsmatrisen
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function FeatureRelated({ feature }: { feature: ModuleFeature }) {
  const related = feature.related
    .map((slug) => FEATURES.find((f) => f.slug === slug))
    .filter((f): f is ModuleFeature => Boolean(f))
  return (
    <section className="py-20 md:py-24" style={{ background: CREAM }}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <SectionHeader
          eyebrow="Resten av plattformen"
          title="Fungerer sammen med"
          lede="Klarert er én plattform med felles brukere, tilganger og datakilde. Disse modulene snakker direkte med hverandre."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((r) => (
            <Link
              key={r.slug}
              to={`/features/${r.slug}`}
              className="block rounded-2xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                {r.eyebrow}
              </p>
              <h3 className="mt-1 text-base font-semibold" style={{ color: FOREST }}>{r.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{r.lede}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: FOREST }}>
                Les mer <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
