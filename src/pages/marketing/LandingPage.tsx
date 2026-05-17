// Root marketing landing page — composes 8 sections, owns the SEO head.

import { FEATURES } from './content/features'
import { SeoHead } from './primitives/SeoHead'
import { HeroSection } from './sections/HeroSection'
import { FrameworkBadgesSection } from './sections/FrameworkBadgesSection'
import { ModuleFeatureSection } from './sections/ModuleFeatureSection'
import { ComplianceTeaserSection } from './sections/ComplianceTeaserSection'
import { IntegrationsTeaserSection } from './sections/IntegrationsTeaserSection'
import { AboutTeaserSection } from './sections/AboutTeaserSection'
import { PricingSection } from './sections/PricingSection'
import { CtaBannerSection } from './sections/CtaBannerSection'

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Klarert',
  url: 'https://app.klarert.com',
  description:
    'Norsk plattform for HMS, internkontroll og etterlevelse med seks moduler — oppgaver, sjekklister, varslinger, dokumenter, e-læring og undersøkelser. Bygget på arbeidsmiljøloven og internkontrollforskriften.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'nb-NO',
  offers: {
    '@type': 'Offer',
    price: '690',
    priceCurrency: 'NOK',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      billingDuration: 'P1M',
    },
  },
  publisher: {
    '@type': 'Organization',
    name: 'Klarert',
    url: 'https://klarert.com',
  },
}

export function LandingPage() {
  return (
    <>
      <SeoHead
        title="Klarert — Norsk HMS- og internkontrollsystem, ferdig kodet"
        description="HMS-system bygget på arbeidsmiljøloven og internkontrollforskriften. Seks moduler, ni rammeverk dekket, data i EU. Prøv gratis i 30 dager."
        canonical="https://app.klarert.com/"
        jsonLd={JSON_LD}
      />
      <HeroSection />
      <FrameworkBadgesSection />
      {FEATURES.map((f, i) => (
        <ModuleFeatureSection key={f.slug} feature={f} index={i} />
      ))}
      <ComplianceTeaserSection />
      <IntegrationsTeaserSection />
      <AboutTeaserSection />
      <PricingSection />
      <CtaBannerSection />
    </>
  )
}
