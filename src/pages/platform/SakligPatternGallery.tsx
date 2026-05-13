// SakligPatternGallery — design-system-side for Saklig-stilen.
//
// «Saklig» (norsk: faktuell, profesjonell, men ikke kald) sitter
// mellom Vekst (varm + illustrert) og Styringssatser (strikt +
// styrerom). Mest av Vekst sin sjel — serif-overskrifter, små
// motifs, amber-aksent — men dropper rounded-3xl-pillow-kortene,
// store watermark-illustrasjoner, og lyrisk mikrokopi. Microcopy
// er direkte og praktisk; sans-serif body; rounded-2xl-kort med
// tynne border og mild skygge.
//
// Lever som platform-admin-flate sammen med VekstPatternGallery.

import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, Sparkles } from 'lucide-react'
import { ModuleSakligAmu } from '../wellbeing/layouts/saklig/ModuleSakligAmu'
import { ModuleSakligChecklists } from '../wellbeing/layouts/saklig/ModuleSakligChecklists'

const SERIF = "'Libre Baskerville', Georgia, serif"

export function SakligPatternGallery() {
  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-[#F2EBDA] p-0">
      <div className="bg-white px-4 py-10 sm:px-6 sm:py-12 md:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* ── Intro ─────────────────────────────────────────────── */}
          <header className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to="/platform-admin"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a3d32] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Platform-admin
              </Link>
              <Link
                to="/platform-admin/vekst-patterns"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden /> Sammenlign med Vekst
              </Link>
            </div>
            <span className="inline-block rounded-full bg-[#1a3d32]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a3d32]">
              Mønsterbibliotek · Saklig-stilen
            </span>
            <h1
              className="text-4xl font-bold leading-tight text-[#1a3d32] sm:text-5xl"
              style={{ fontFamily: SERIF }}
            >
              En stemme mellom Vekst og styrerommet
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-[#516760]">
              Saklig er for flater hvor leseren skal ta beslutninger raskt, men ikke kjenne seg
              avhørt. Vi beholder Vekst sine serif-overskrifter, amber-aksenten og de små motivene
              — men dropper rounded-3xl-pillow-kortene, watermark-illustrasjonene og den lyriske
              microcopyen. Resultat: kjenner igjen som Klarert, leses raskt som en saksframlegg.
            </p>

            {/* Design-token comparison */}
            <div className="mt-6 overflow-hidden rounded-xl border border-[#1a3d32]/10 bg-[#FAFAF7]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a3d32]/10 bg-white text-left text-[10px] uppercase tracking-wide text-[#516760]">
                    <th className="px-4 py-2 font-semibold" style={{ fontFamily: SERIF }}>
                      Aspekt
                    </th>
                    <th className="px-4 py-2 font-semibold" style={{ fontFamily: SERIF }}>
                      Vekst
                    </th>
                    <th className="px-4 py-2 font-semibold text-amber-800" style={{ fontFamily: SERIF }}>
                      Saklig
                    </th>
                    <th className="px-4 py-2 font-semibold" style={{ fontFamily: SERIF }}>
                      Styringssatser
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a3d32]/5">
                  {[
                    { aspect: 'Canvas', vekst: 'Cream #FAF6EE', saklig: 'Warm off-white #FAFAF7', styre: 'Hvit / nøytral' },
                    { aspect: 'Card-radius', vekst: 'rounded-3xl pillow', saklig: 'rounded-2xl', styre: 'rounded-md flat' },
                    { aspect: 'Skygge', vekst: 'Tung amber-glow', saklig: 'Mild grå skygge', styre: 'Ingen' },
                    { aspect: 'Hero-illustrasjon', vekst: 'Stor, dekorativ', saklig: 'Liten motif-chip', styre: 'Ingen' },
                    { aspect: 'Mikrokopi', vekst: 'Lyrisk, narrativ', saklig: 'Direkte, forklarende', styre: 'Saksframlegg-tørr' },
                    { aspect: 'Typografi', vekst: 'Serif på alt', saklig: 'Serif overskrifter + tall', styre: 'Serif H1, ellers sans' },
                    { aspect: 'Knapper', vekst: 'Runde piller', saklig: 'rounded-md', styre: 'rounded-md, flat' },
                  ].map((row) => (
                    <tr key={row.aspect}>
                      <td
                        className="bg-white px-4 py-2.5 font-medium text-[#1a3d32]"
                        style={{ fontFamily: SERIF }}
                      >
                        {row.aspect}
                      </td>
                      <td className="px-4 py-2.5 text-[#516760]">{row.vekst}</td>
                      <td className="bg-amber-50/40 px-4 py-2.5 font-medium text-amber-900">{row.saklig}</td>
                      <td className="px-4 py-2.5 text-[#516760]">{row.styre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </header>

          {/* ── Module 1 — AMU oversikt ───────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Modul-eksempel 1 · Oversikt"
              title="AMU & verneombud"
              body="Et oversiktsbilde med KPI-stripe, åpne vedtak fra siste møter, agenda for neste møte og en visuell sjekk på verneombud-dekning. Beholder Vekst sin serif-personlighet i overskriftene og motifene, men kortene er rounded-2xl med tynne border og tabellene er kompakte nok til å gi ledere et raskt overblikk."
            />
            <div className="rounded-3xl border border-[#1a3d32]/10 bg-[#1a3d32]/[0.03] p-2 sm:p-3">
              <div className="overflow-hidden rounded-2xl">
                <ModuleSakligAmu />
              </div>
            </div>
          </section>

          {/* ── Module 2 — Sjekklister-liste ──────────────────────── */}
          <section className="space-y-4">
            <SectionLabel
              eyebrow="Modul-eksempel 2 · Liste"
              title="Sjekklister & vernerunder"
              body="Saklig fungerer like godt på en tett, filtrerbar liste. Hero har samme rytme som AMU-modulen — eyebrow + serif H1 + KPI-strip — men content-flata gir plass til søk, filter-piller og en kompakt tabell med fremdriftsbarer og status-pills. Forfalt-rad markeres rose; klar-til-signering markeres amber slik at handlingsbehovet leses uten farge-shouting."
            />
            <div className="rounded-3xl border border-[#1a3d32]/10 bg-[#1a3d32]/[0.03] p-2 sm:p-3">
              <div className="overflow-hidden rounded-2xl">
                <ModuleSakligChecklists />
              </div>
            </div>
          </section>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <footer className="rounded-2xl border-2 border-amber-200 bg-white p-6">
            <h2
              className="text-lg font-bold text-[#1a3d32]"
              style={{ fontFamily: SERIF }}
            >
              Når bruke Saklig vs Vekst?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#516760]">
              Saklig er hverdagstunet for operative moduler — AMU-oversikt, sjekklister, vernerunder,
              avvik, oppgaver. Når leseren har en jobb å gjøre. Vekst er for flater hvor stemningen
              betyr noe — Arbeidsmiljøstrategi, onboarding, pulsmåling, story-cards.
              Styringssatser er for det formelle — styrerapporter, vedtaks-protokoller, tilsynssvar.
              De tre kan stå på samme produkt fordi de deler typografi (Libre Baskerville),
              akse-motifs, og forest-amber-paletten.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/platform-admin/vekst-patterns"
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden /> Vekst-mønster
              </Link>
              <Link
                to="/overview/arbeidsmiljostrategi"
                className="inline-flex items-center gap-1 rounded-md border border-[#1a3d32]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-amber-50"
              >
                Se Vekst i live <Sparkles className="h-3 w-3" aria-hidden />
              </Link>
              <Link
                to="/overview/arbeidsmiljostrategi/rapport?autoprint=1"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-[#1a3d32]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-amber-50"
              >
                Styringssatser-rapport <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">{eyebrow}</div>
      <h2
        className="mt-1 text-2xl font-bold leading-tight text-[#1a3d32] sm:text-3xl"
        style={{ fontFamily: SERIF }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#516760]">{body}</p>
    </div>
  )
}
