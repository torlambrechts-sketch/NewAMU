// /etterlevelse — comprehensive coverage of the 9 frameworks, 2 packs, audit story, FAQ.

import { Link } from 'react-router-dom'
import { FRAMEWORKS, PACKS, FAQ } from './content/compliance'
import { FEATURES } from './content/features'
import { SeoHead } from './primitives/SeoHead'
import { SectionHeader } from './primitives/SectionHeader'
import { CtaBannerSection } from './sections/CtaBannerSection'
import { CREAM, FOREST, TEAL } from './theme'

export function CompliancePage() {
  const totalParagraphs = FRAMEWORKS.reduce((sum, f) => sum + f.paragraphs.length, 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Klarert', item: 'https://app.klarert.com/' },
          { '@type': 'ListItem', position: 2, name: 'Etterlevelse', item: 'https://app.klarert.com/etterlevelse' },
        ],
      },
    ],
  }

  return (
    <>
      <SeoHead
        title="Etterlevelse (compliance) — Klarert | Arbeidsmiljøloven, IK-f, GDPR, ISO 45001, Åpenhetsloven"
        description={`${FRAMEWORKS.length} rammeverk og ${totalParagraphs}+ paragrafer kartlagt mot konkrete moduler. Se hvordan Klarert dekker etterlevelse — på engelsk: compliance — av arbeidsmiljøloven, internkontrollforskriften, GDPR og ISO 45001.`}
        canonical="https://app.klarert.com/etterlevelse"
        jsonLd={jsonLd}
      />

      <section style={{ background: FOREST }} className="pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
            Etterlevelse
          </p>
          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Bygget på norsk lov, ikke tilpasset etterpå
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Hver mal og hvert trinn i arbeidsflyten har en lovreferanse som peker tilbake til kilden.
            Etterlevelse — eller compliance, som mange bransjer kaller det — er ikke en sjekkliste.
            Det er arkitekturen. Her er hva som faktisk dekkes.
          </p>
          <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-4">
            {[
              { v: String(FRAMEWORKS.length), l: 'Rammeverk' },
              { v: `${totalParagraphs}+`, l: 'Paragrafer' },
              { v: '2', l: 'Pakker for etterlevelse' },
            ].map((s) => (
              <div key={s.l} className="border-l-2 pl-3 text-left" style={{ borderColor: TEAL }}>
                <dt className="text-3xl font-bold text-white">{s.v}</dt>
                <dd className="mt-0.5 text-xs uppercase tracking-widest text-white/50">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Rammeverk"
            title="Lovverkene Klarert er bygget på"
            lede="Trykk på et rammeverk for å se hvilke paragrafer som dekkes og hvilke moduler som adresserer dem."
          />
          <div className="mt-14 space-y-6">
            {FRAMEWORKS.map((f) => (
              <article
                key={f.short}
                id={f.slug}
                className="rounded-2xl border border-neutral-200 p-6 md:p-8"
                style={{ background: '#fbf9f3' }}
              >
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <h3 className="text-2xl font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}>
                      {f.short}
                    </h3>
                    <p className="mt-1 text-xs uppercase tracking-widest text-neutral-500">{f.full}</p>
                    <p className="mt-4 text-sm leading-relaxed text-neutral-700">{f.summary}</p>
                  </div>
                  <div className="md:col-span-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Paragrafer</p>
                    <ul className="mt-2 space-y-1.5">
                      {f.paragraphs.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-neutral-700">
                          <span className="mt-1 size-1 shrink-0 rounded-full" style={{ background: TEAL }} />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="md:col-span-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Moduler som dekker</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {f.modulesCovering.map((slug) => {
                        const module = FEATURES.find((mod) => mod.slug === slug)
                        if (!module) return null
                        return (
                          <Link
                            key={slug}
                            to={`/features/${slug}`}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium transition-colors hover:border-neutral-400"
                            style={{ color: FOREST }}
                          >
                            {module.name}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28" style={{ background: CREAM }}>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Pakker"
            title="To pakker for etterlevelse, alle modulene"
            lede="Pakkene oversetter kjente kravsett til konkrete maler og trinn i arbeidsflyten. Du kan kjøre én eller begge samtidig."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {PACKS.map((p) => (
              <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-7">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                  {p.id}
                </p>
                <h3 className="mt-2 text-xl font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}>
                  {p.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{p.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.frameworks.map((fw) => (
                    <span
                      key={fw}
                      className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-medium"
                      style={{ color: FOREST }}
                    >
                      {fw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Hvordan vi tenker"
            title="Tilsynsklar arkitektur fra dag én"
            lede="Tre prinsipper styrer hvordan vi har bygget systemet."
          />
          <ul className="mt-12 space-y-6">
            {[
              {
                title: 'Signaturer og revisjonsspor er førsteklasses',
                body: 'Hver statusendring loggføres med tidsstempel og bruker. Sjekklister, sertifikater og dokumenter har full revisjonshistorikk. BankID-signering er på vei (Q1 2026); enkel digital signering er aktiv i dag.',
              },
              {
                title: 'Lovkrav er kodet, ikke beskrevet',
                body: 'Tidsfrister for varsling (5 dager til bekreftelse, 6 uker til undersøkelse) er en del av arbeidsflyten, ikke en setning i en prosedyre. Oppbevaringsregler (5 år for varsling, 30 år for kjemikalieeksponering) håndheves på databasenivå.',
              },
              {
                title: 'Anonymitet ved arkitektur',
                body: 'Varslingsmodulen bruker Row Level Security som primær tilgangskontroll. Anonyme felter er ulesbare etter lukking — koden tillater ikke at noen ved et uhell logger varsleren.',
              },
            ].map((p) => (
              <li key={p.title} className="flex gap-4">
                <span
                  className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: FOREST, color: 'white' }}
                >
                  ✓
                </span>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: FOREST }}>{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20 md:py-28" style={{ background: CREAM }}>
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <SectionHeader
            eyebrow="Vanlige spørsmål"
            title="Spørsmål vi får om etterlevelse"
          />
          <dl className="mt-12 space-y-5">
            {FAQ.map((entry) => (
              <details
                key={entry.question}
                className="group rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold" style={{ color: FOREST }}>
                  {entry.question}
                  <span className="shrink-0 text-xl transition-transform group-open:rotate-45" style={{ color: TEAL }}>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{entry.answer}</p>
              </details>
            ))}
          </dl>
        </div>
      </section>

      <CtaBannerSection
        heading="Vil du se hvordan ditt rammeverk dekkes?"
        body="Be om en 20-minutters demo der vi går gjennom din pakke — AML, IK-f, ISO 45001 eller noe annet."
        primaryLabel="Be om demo"
        primaryTo="/demo"
      />
    </>
  )
}
