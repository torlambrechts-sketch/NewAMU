// Nav and footer link map shared by MarketingNav + MarketingFooter.
// Every link points to a real route — no href="#" placeholders.
//
// Static labels are resolved through i18n at render time: the builders take
// the `t` function so the marketing chrome follows the active locale.
// Feature and framework names stay literal — they come from content data.

import { FEATURES } from './features'
import { FRAMEWORKS, frameworkSlug } from './compliance'

type TFn = (key: string) => string

export type MarketingLink = { label: string; to: string; external?: boolean }

export function getNavLinks(t: TFn): MarketingLink[] {
  return [
    { label: t('marketing.nav.product'), to: '/#moduler' },
    { label: t('marketing.nav.compliance'), to: '/etterlevelse' },
    { label: t('marketing.nav.integrations'), to: '/integrasjoner' },
    { label: t('marketing.nav.pricing'), to: '/#pricing' },
    { label: t('marketing.nav.contact'), to: '/kontakt' },
  ]
}

// Feature names come from content data — kept literal (translated with the
// feature content in a later step).
export const FOOTER_PRODUCT: MarketingLink[] = FEATURES.map((f) => ({
  label: f.name,
  to: `/features/${f.slug}`,
}))

export function getFooterCompliance(t: TFn): MarketingLink[] {
  return [
    { label: t('marketing.footer.fullCoverage'), to: '/etterlevelse' },
    // Framework names are proper nouns (Norwegian statutes / ISO standards) —
    // not translated.
    ...FRAMEWORKS.filter((f) =>
      ['Arbeidsmiljøloven', 'Internkontrollforskriften', 'GDPR', 'ISO 45001', 'Åpenhetsloven'].includes(
        f.short,
      ),
    ).map((f) => ({ label: f.short, to: `/etterlevelse#${frameworkSlug(f.short)}` })),
  ]
}

export function getFooterCompany(t: TFn): MarketingLink[] {
  return [
    { label: t('marketing.footer.about'), to: '/om-oss' },
    { label: t('marketing.footer.changes'), to: '/endringer' },
    { label: t('marketing.nav.integrations'), to: '/integrasjoner' },
    { label: t('marketing.footer.requestDemo'), to: '/demo' },
    { label: t('marketing.footer.contactUs'), to: '/kontakt' },
    { label: t('marketing.nav.login'), to: '/login' },
    { label: t('marketing.footer.signup'), to: '/signup' },
  ]
}

export function getFooterLegal(t: TFn): MarketingLink[] {
  return [
    { label: t('marketing.footer.privacy'), to: '/om-oss#personvern' },
    { label: t('marketing.footer.terms'), to: '/om-oss#vilkar' },
    { label: t('marketing.footer.cookies'), to: '/om-oss#cookies' },
  ]
}
