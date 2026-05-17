// Post-build prerender for marketing routes.
// For each route under /features/*, /compliance, /integrasjoner, /om-oss, /endringer
// generates dist/<path>/index.html with route-specific <title>, meta, OG/Twitter
// and JSON-LD baked in. The body still loads the SPA bundle, so client-side
// React hydration / navigation continues to work — but social previews,
// non-JS crawlers and link unfurlers see the right metadata immediately.
//
// Run automatically after `vite build` via the postbuild npm script.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const SITE = 'https://app.klarert.com'
const OG_IMAGE = `${SITE}/og-image.svg`

function ld(graph) {
  return { '@context': 'https://schema.org', '@graph': graph }
}

function breadcrumb(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.item ? { item: it.item } : {}),
    })),
  }
}

const FEATURE_BREADCRUMB = [
  { name: 'Klarert', item: `${SITE}/` },
  { name: 'Funksjoner' },
]

function featureLd(slug, name, description) {
  return ld([
    {
      '@type': 'Product',
      name: `Klarert ${name}`,
      description,
      brand: { '@type': 'Brand', name: 'Klarert' },
      category: 'BusinessApplication',
    },
    breadcrumb([...FEATURE_BREADCRUMB, { name, item: `${SITE}/features/${slug}` }]),
  ])
}

// Mirror of metaTitle/metaDescription in src/pages/marketing/content/features.ts
// + the page-level <SeoHead> props on Compliance/Integrations/About/Endringer.
const ROUTES = [
  {
    path: '/features/oppgaver',
    title: 'Oppgaver — Klarert | Tverrgående tiltaksinnboks for HMS',
    description:
      'Samle alle åpne tiltak fra HMS, sjekklister, varsling og AMU i én lovpålagt arbeidsflyt med digital signering og full sporbarhet.',
    jsonLd: featureLd(
      'oppgaver',
      'Oppgaver',
      'Samle alle åpne tiltak fra HMS, sjekklister, varsling og AMU i én lovpålagt arbeidsflyt med digital signering og full sporbarhet.',
    ),
  },
  {
    path: '/features/sjekklister',
    title: 'Sjekklister — Klarert | Vernerunder med risikoscore',
    description:
      'Strukturerte vernerunder og samsvarssjekker med risikomatrise (1–25), multi-signering og automatisk avviksoppretting. AML- og ISO 45001-maler innebygd.',
    jsonLd: featureLd(
      'sjekklister',
      'Sjekklister',
      'Strukturerte vernerunder og samsvarssjekker med risikomatrise (1–25), multi-signering og automatisk avviksoppretting.',
    ),
  },
  {
    path: '/features/varslinger',
    title: 'Varslinger — Klarert | AML kap. 2A + GDPR Art. 33',
    description:
      'Anonym varsling og GDPR-brudd i ett system. Taushetsplikt og oppbevaring kodet på databasenivå. 5-dagers bekreftelse, 6-ukers undersøkelsesfrist.',
    jsonLd: featureLd(
      'varslinger',
      'Varslinger',
      'Anonym varsling og GDPR-brudd i ett system. Taushetsplikt og oppbevaring kodet på databasenivå.',
    ),
  },
  {
    path: '/features/dokumenter',
    title: 'Dokumenter — Klarert | Versjonert HMS-håndbok og prosedyrer',
    description:
      'Wiki-basert HMS-håndbok og internkontrolldokumentasjon med revisjonshistorikk, skjema-drevne maler og frister på gjennomgang.',
    jsonLd: featureLd(
      'dokumenter',
      'Dokumenter',
      'Wiki-basert HMS-håndbok og internkontrolldokumentasjon med revisjonshistorikk, skjema-drevne maler og frister på gjennomgang.',
    ),
  },
  {
    path: '/features/laering',
    title: 'E-læring — Klarert | HMS-grunnopplæring og sertifikatsporing',
    description:
      'Lovpålagt HMS-kurs (40 timer) for ledere og verneombud, samt brann, førstehjelp og egne kurs. Sertifikatutløp som førsteklasses filter.',
    jsonLd: featureLd(
      'laering',
      'E-læring',
      'Lovpålagt HMS-kurs (40 timer) for ledere og verneombud. Sertifikatutløp som førsteklasses filter.',
    ),
  },
  {
    path: '/features/undersokelser',
    title: 'Undersøkelser — Klarert | AMU-puls og egenerklæringer fra leverandører',
    description:
      'Pulsundersøkelser, AML §4-2-kartlegging, exit-intervjuer og egenerklæringer etter Åpenhetsloven. Anonyme svar, aggregerbar innsikt.',
    jsonLd: featureLd(
      'undersokelser',
      'Undersøkelser',
      'Pulsundersøkelser, AML §4-2-kartlegging, exit-intervjuer og egenerklæringer etter Åpenhetsloven.',
    ),
  },
  {
    path: '/etterlevelse',
    title: 'Etterlevelse (compliance) — Klarert | Arbeidsmiljøloven, IK-f, GDPR, ISO 45001, Åpenhetsloven',
    description:
      '9 rammeverk og 80+ paragrafer kartlagt mot konkrete moduler. Se hvordan Klarert dekker etterlevelse — på engelsk: compliance — av arbeidsmiljøloven, internkontrollforskriften, GDPR og ISO 45001.',
    jsonLd: ld([
      breadcrumb([
        { name: 'Klarert', item: `${SITE}/` },
        { name: 'Etterlevelse', item: `${SITE}/etterlevelse` },
      ]),
    ]),
  },
  {
    path: '/integrasjoner',
    title: 'Integrasjoner — Klarert | BankID, Brønnøysund, Altinn, Eco-Online',
    description:
      'Klarert kobles til Brønnøysund, BankID, Altinn, Eco-Online, Lovdata Pro og Feide. Vi forteller deg hva som er live og hva som er roadmap.',
    jsonLd: ld([
      breadcrumb([
        { name: 'Klarert', item: `${SITE}/` },
        { name: 'Integrasjoner', item: `${SITE}/integrasjoner` },
      ]),
    ]),
  },
  {
    path: '/om-oss',
    title: 'Om Klarert | Norsk plattform for HMS, internkontroll og etterlevelse',
    description:
      'Klarert er bygget for norske virksomheter — av folk som har sittet i AMU-møter. Norsk-først, lovverket innebygd, data i EU. Les hele historien.',
    jsonLd: ld([
      {
        '@type': 'Organization',
        name: 'Klarert',
        url: 'https://klarert.com',
        description:
          'Norsk plattform for HMS, internkontroll og etterlevelse — bygget på arbeidsmiljøloven og internkontrollforskriften.',
        address: { '@type': 'PostalAddress', addressCountry: 'NO' },
        email: 'hei@klarert.com',
      },
      breadcrumb([
        { name: 'Klarert', item: `${SITE}/` },
        { name: 'Om oss', item: `${SITE}/om-oss` },
      ]),
    ]),
  },
  {
    path: '/endringer',
    title: 'Endringer — Klarert | Lovendringer og oppdaterte maler',
    description:
      'Når arbeidsmiljøloven, IK-forskriften eller GDPR endres oppdaterer vi systemmalene og forklarer hva som har skjedd. Komplett endringslogg.',
    jsonLd: ld([
      breadcrumb([
        { name: 'Klarert', item: `${SITE}/` },
        { name: 'Endringer', item: `${SITE}/endringer` },
      ]),
    ]),
  },
  {
    path: '/demo',
    title: 'Be om demo — Klarert | 20 minutter, ingen salgsdeck',
    description:
      'Vi viser deg hvordan Klarert dekker akkurat ditt rammeverk. 20 minutter, ingen salgsdeck, ingen budsjettspørsmål.',
    jsonLd: ld([
      breadcrumb([
        { name: 'Klarert', item: `${SITE}/` },
        { name: 'Be om demo', item: `${SITE}/demo` },
      ]),
    ]),
  },
]

function replaceTagContent(html, regex, replacement) {
  return html.replace(regex, replacement)
}

function applyMeta(template, route) {
  const canonical = `${SITE}${route.path}`
  let html = template

  html = replaceTagContent(html, /<title>[\s\S]*?<\/title>/, `<title>${route.title}</title>`)

  const setMeta = (name, value) => {
    const re = new RegExp(`(<meta\\s+(?:name|property)="${name}"\\s+content=")[^"]*(")`, 'g')
    html = html.replace(re, `$1${value.replace(/"/g, '&quot;')}$2`)
  }

  setMeta('description', route.description)
  setMeta('og:title', route.title)
  setMeta('og:description', route.description)
  setMeta('og:url', canonical)
  setMeta('og:image', OG_IMAGE)
  setMeta('twitter:title', route.title)
  setMeta('twitter:description', route.description)
  setMeta('twitter:image', OG_IMAGE)

  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonical}" />`,
  )

  if (route.jsonLd) {
    const tag = `\n    <script type="application/ld+json" data-route-schema>\n${JSON.stringify(route.jsonLd, null, 2)}\n    </script>\n  `
    html = html.replace(/<\/head>/, `${tag}</head>`)
  }

  return html
}

function main() {
  const template = readFileSync(join(DIST, 'index.html'), 'utf8')
  let count = 0
  for (const route of ROUTES) {
    const html = applyMeta(template, route)
    const targetDir = join(DIST, route.path)
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(targetDir, 'index.html'), html)
    count++
  }
  console.log(`prerender: wrote ${count} route HTML files`)
}

main()
