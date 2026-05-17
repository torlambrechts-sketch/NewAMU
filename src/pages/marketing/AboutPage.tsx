// /om-oss — mission, principles, contact, basic privacy/terms anchors.

import { SeoHead } from './primitives/SeoHead'
import { SectionHeader } from './primitives/SectionHeader'
import { CtaBannerSection } from './sections/CtaBannerSection'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'
const CREAM = '#f5f0e8'

const TEAM = [
  {
    initials: 'TL',
    bg: '#a78bfa',
    name: 'Tor Lambrechts',
    role: 'Daglig leder · grunnlegger',
    bio: 'Tidligere HMS-leder i industri. Bygger Klarert fordi han var lei av å lete etter dokumenter klokka 23 før tilsynet kom.',
  },
  {
    initials: 'NK',
    bg: '#34d399',
    name: 'Navn følger',
    role: 'Teknisk leder',
    bio: 'Hovedansvar for plattformarkitektur, sikkerhet og at databasenivå-RLS faktisk fanger det den skal fange.',
  },
  {
    initials: 'AR',
    bg: '#fbbf24',
    name: 'Navn følger',
    role: 'Compliance-rådgiver',
    bio: 'Verneombud og AML-spesialist. Sørger for at malene speiler faktisk norsk praksis — ikke bare lovteksten.',
  },
]

const PRINCIPLES = [
  {
    title: 'Norsk-først',
    body: 'Vi bygger for norske virksomheter og norsk lov. Engelsk oversettelse kommer på sikt — men vi velger heller et system som faktisk forstår norsk HMS, enn et system som forstår tjue land overfladisk.',
  },
  {
    title: 'Lovverket innebygd',
    body: 'Hver mal har en lovreferanse. Hver workflow har en hjemmel. Compliance skal være en del av hvordan systemet fungerer — ikke et spørreskjema vi sender deg etterpå.',
  },
  {
    title: 'Ingen mørke mønstre',
    body: 'Data kan eksporteres når som helst. Avbestillinger gjelder umiddelbart. Vi spør ikke om kortinformasjon for en prøvetest. Tillit er den eneste varige posisjonen i compliance-bransjen.',
  },
  {
    title: 'EU-data, ingen unntak',
    body: 'Klarert kjører på Supabase i Frankfurt og Stockholm. Vi sender ikke persondata utenfor EU. Hvis du trenger dokumentert databehandlingsavtale (DPA), har vi det klart fra første dag.',
  },
]

export function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Klarert',
        url: 'https://klarert.com',
        description:
          'Norsk HMS- og compliance-plattform bygget på arbeidsmiljøloven og internkontrollforskriften.',
        address: { '@type': 'PostalAddress', addressCountry: 'NO' },
        email: 'hei@klarert.com',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Klarert', item: 'https://app.klarert.com/' },
          { '@type': 'ListItem', position: 2, name: 'Om oss', item: 'https://app.klarert.com/om-oss' },
        ],
      },
    ],
  }

  return (
    <>
      <SeoHead
        title="Om Klarert | Norsk compliance-plattform for HMS og arbeidsmiljø"
        description="Klarert er bygget for norske virksomheter — av folk som har sittet i AMU-møter. Norsk-først, lovverket innebygd, EU-data. Les hele historien."
        canonical="https://app.klarert.com/om-oss"
        jsonLd={jsonLd}
      />

      <section style={{ background: FOREST }} className="pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
            Om oss
          </p>
          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Compliance vi selv ville stolt på
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Klarert ble til fordi vi var lei av compliance-systemer som har lest om norsk
            arbeidsmiljølov, men ikke forstått den. Vi har bygget plattformen vi selv hadde
            ønsket oss tilbake da vi satt på den andre siden av AMU-bordet.
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Hvorfor Klarert"
            title="Bygget av folk som har vært der"
            align="left"
          />
          <div className="mt-10 space-y-5 text-base leading-relaxed text-neutral-700">
            <p>
              Verneombud, HMS-ledere og daglige ledere bruker fortsatt for mye tid på å lete
              etter dokumenter, huske frister og forklare sammenhengen mellom moduler. Det
              meste handler ikke om at folk ikke vil — det handler om at verktøyene er bygget
              for å samle inn data, ikke for å hjelpe deg med å løse problemet.
            </p>
            <p>
              Klarert tar et annet utgangspunkt: hva slags system ville en god HMS-leder ha
              bygget hvis hun hadde tid? Et som vet om sin egen kontekst. Som forstår at en
              "kritisk" på en vernerunde skal bli et "tiltak" i en innboks. Som husker at
              sertifikatet utløp samme dag som den ansatte ble overført til en annen avdeling
              — og likevel beholder den opprinnelige konteksten for tilsynet.
            </p>
            <p>
              Vi er en liten gruppe basert i Norge. Vi tar én betalingsmetode (faktura eller
              kort i NOK), én valuta og én juridisk konfigurasjon — den norske. Det er en
              bevisst begrensning: vi vil heller være best på ett marked enn middelmådige på
              mange.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-white" aria-labelledby="team-heading">
        <div className="mx-auto max-w-5xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Teamet"
            title="Folk du faktisk får snakke med"
            lede="Klarert er bygget av en liten gruppe i Norge. Du får tilgang til oss — ikke et anonymt support-team."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TEAM.map((member) => (
              <article key={member.role} className="rounded-2xl border border-neutral-200 p-6 text-center">
                <div
                  className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ background: member.bg }}
                  aria-hidden
                >
                  {member.initials}
                </div>
                <h3 className="text-base font-semibold" style={{ color: FOREST }}>{member.name}</h3>
                <p className="text-xs uppercase tracking-widest text-neutral-500">{member.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{member.bio}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-neutral-400">
            Faktiske bilder erstatter initialene når kalenderen tillater det.
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28" style={{ background: CREAM }}>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Prinsipper"
            title="Fire ting vi ikke gir på"
            lede="Disse fire prinsippene er ikke markedsføringsfraser. De er valg vi har gjort i koden — og som du kan teste oss på."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-2xl border border-neutral-200 bg-white p-7">
                <h3
                  className="text-xl font-bold tracking-tight"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}
                >
                  {p.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <SectionHeader eyebrow="Kontakt" title="Snakk med oss" align="left" />
          <div className="mt-8 space-y-4 text-base leading-relaxed text-neutral-700">
            <p>
              Generelle spørsmål, demo-forespørsler og partnerskap:{' '}
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:hei@klarert.com">
                hei@klarert.com
              </a>
            </p>
            <p>
              Personvern, GDPR og databehandlingsavtaler:{' '}
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:personvern@klarert.com">
                personvern@klarert.com
              </a>
            </p>
            <p>
              Sikkerhet og rapportering av sårbarheter:{' '}
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:sikkerhet@klarert.com">
                sikkerhet@klarert.com
              </a>
            </p>
          </div>
        </div>
      </section>

      <section id="personvern" className="py-16 md:py-20" style={{ background: CREAM }}>
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <SectionHeader eyebrow="Personvern" title="Hvordan vi håndterer data" align="left" />
          <div className="mt-8 space-y-4 text-sm leading-relaxed text-neutral-700">
            <p>
              <strong>Behandlingsansvarlig:</strong> kundens organisasjon. Klarert er
              databehandler. Full databehandlingsavtale (DPA) sendes på forespørsel.
            </p>
            <p>
              <strong>Datasenter:</strong> Supabase EU-region (Frankfurt + Stockholm). Persondata
              forlater ikke EU.
            </p>
            <p>
              <strong>Tilgangskontroll:</strong> Row Level Security som primær mekanisme.
              Applikasjonen kan ikke ved et uhell gi tilgang som den ikke skulle hatt.
            </p>
            <p>
              <strong>Oppbevaring:</strong> håndhevet per modul — 5 år for varslingssaker
              (AML), minst 5 år for yrkesskade (folketrygdloven), 30 år for kjemikalieeksponering.
            </p>
            <p>
              <strong>Sletting:</strong> du kan eksportere all data når som helst og be om
              sletting ved oppsigelse.
            </p>
            <p className="rounded-xl border border-neutral-200 bg-white p-4 text-xs text-neutral-500">
              Dette er en oppsummering. Full personvernerklæring sendes på forespørsel til{' '}
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:personvern@klarert.com">
                personvern@klarert.com
              </a>{' '}— og publiseres her første gang en kunde ber om det.
            </p>
          </div>
        </div>
      </section>

      <section id="vilkar" className="py-16 md:py-20 bg-white">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <SectionHeader eyebrow="Vilkår" title="Det viktigste i to setninger" align="left" />
          <div className="mt-8 space-y-4 text-sm leading-relaxed text-neutral-700">
            <p>
              Du eier dataene dine. Vi gjør plattformen tilgjengelig i bytte mot abonnementet.
              Hvis du sier opp, kan du eksportere alt og vi sletter resten innen 90 dager
              (med unntak av data som lovverket pålegger oss å oppbevare).
            </p>
            <p>
              Fullstendige vilkår tilgjengelig på forespørsel — ta kontakt på{' '}
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:hei@klarert.com">
                hei@klarert.com
              </a>.
            </p>
          </div>
        </div>
      </section>

      <section id="cookies" className="py-16 md:py-20" style={{ background: CREAM }}>
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <SectionHeader eyebrow="Cookies" title="Vi bruker så få som mulig" align="left" />
          <div className="mt-8 space-y-4 text-sm leading-relaxed text-neutral-700">
            <p>
              Nødvendige cookies for innlogging og økt-håndtering. Ingen tredjeparts
              annonse-cookies, ingen sporing på tvers av nettsteder.
            </p>
            <p>
              Vi bruker Vercel Web Analytics (anonymisert, aggregert) for å forstå hvilke
              sider folk bruker. Ingen IP-adresser lagres.
            </p>
          </div>
        </div>
      </section>

      <CtaBannerSection
        heading="Vil du snakke direkte?"
        body="Vi tar gjerne en uforpliktende prat — uten salgspresentasjoner, og uten å spørre om budsjettet ditt først."
        primaryLabel="Send e-post"
        primaryTo="/signup"
      />
    </>
  )
}
