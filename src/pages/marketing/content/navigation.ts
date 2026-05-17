// Nav and footer link map shared by MarketingNav + MarketingFooter.
// Every link points to a real route — no href="#" placeholders.

import { FEATURES } from './features'
import { FRAMEWORKS, frameworkSlug } from './compliance'

export const NAV_LINKS: Array<{ label: string; to: string }> = [
  { label: 'Produkt', to: '/#moduler' },
  { label: 'Compliance', to: '/compliance' },
  { label: 'Integrasjoner', to: '/integrasjoner' },
  { label: 'Pris', to: '/#pricing' },
  { label: 'Om oss', to: '/om-oss' },
]

export const FOOTER_PRODUCT = FEATURES.map((f) => ({
  label: f.name,
  to: `/features/${f.slug}`,
}))

export const FOOTER_COMPLIANCE: Array<{ label: string; to: string }> = [
  { label: 'Full lov-dekning', to: '/compliance' },
  ...FRAMEWORKS.filter((f) => ['Arbeidsmiljøloven', 'Internkontrollforskriften', 'GDPR', 'ISO 45001', 'Åpenhetsloven'].includes(f.short)).map(
    (f) => ({ label: f.short, to: `/compliance#${frameworkSlug(f.short)}` }),
  ),
]

export const FOOTER_COMPANY: Array<{ label: string; to: string; external?: boolean }> = [
  { label: 'Om oss', to: '/om-oss' },
  { label: 'Integrasjoner', to: '/integrasjoner' },
  { label: 'Logg inn', to: '/login' },
  { label: 'Opprett konto', to: '/signup' },
  { label: 'Kontakt', to: 'mailto:hei@klarert.com', external: true },
]

export const FOOTER_LEGAL: Array<{ label: string; to: string }> = [
  { label: 'Personvern', to: '/om-oss#personvern' },
  { label: 'Vilkår', to: '/om-oss#vilkar' },
  { label: 'Cookies', to: '/om-oss#cookies' },
]
