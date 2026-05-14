// Hub page for the three course-player design previews. Lists each alternative
// with rationale, mental model, engagement device, and a "Åpne preview" CTA so
// the team can compare them side by side before we adopt one.

import { Link } from 'react-router-dom'
import { BookOpen, Film, Sparkles, ArrowRight } from 'lucide-react'

type Variant = {
  to: string
  eyebrow: string
  title: string
  oneLiner: string
  mentalModel: string
  engagement: string
  widthTarget: string
  accent: string
  icon: typeof BookOpen
}

const variants: Variant[] = [
  {
    to: '/platform-admin/course-player/focus',
    eyebrow: 'Alternativ 1',
    title: 'Focus Reader',
    oneLiner:
      'Typografi-først. Som å lese en velskrevet artikkel – med en stille fremdriftsstripe og bevisste pauser for refleksjon.',
    mentalModel: 'Stripe Docs / Medium / NYT Briefings',
    engagement:
      'Luftig lesetypografi, «Nøkkelpunkter»-pullquote, mikro-CTA i bunn («Du har 2 moduler igjen i dag»).',
    widthTarget: '760 px innhold · 1040 px med høyrekol.',
    accent: '#0e7490',
    icon: BookOpen,
  },
  {
    to: '/platform-admin/course-player/cinema',
    eyebrow: 'Alternativ 2',
    title: 'Cinema Card',
    oneLiner:
      'Modulen ligger på en lukket scene. Ambient bakgrunn, ett spørsmål om gangen, XP-belønning som flyter inn ved fullføring.',
    mentalModel: 'Headspace / Apple Keynote / Duolingo',
    engagement:
      'Steg-prikker, kort-overgang mellom moduler, animert +XP og strektelle ved riktig svar, tidsring i bunn.',
    widthTarget: '960 × 640 låst scene',
    accent: '#1a3d32',
    icon: Film,
  },
  {
    to: '/platform-admin/course-player/coach',
    eyebrow: 'Alternativ 3',
    title: 'Coach Sidekick',
    oneLiner:
      'Anne, HMS-rådgiveren, sitter ved siden av deg. Forklarer paragrafer, stiller kontrollspørsmål og oppsummerer hva du nettopp lærte.',
    mentalModel: 'Khan Academy / Copilot Chat / Babbel',
    engagement:
      'Persona med portrett, «Etter denne modulen kan du …»-sjekkliste, refleksjonsboks pinned ved siden av leksjonen.',
    widthTarget: '1100 px split 60 / 40',
    accent: '#a21caf',
    icon: Sparkles,
  },
]

export function PlatformCoursePlayerHubPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[2px] text-amber-400/90">
          E-læring · Designforslag
        </p>
        <h1 className="text-3xl font-semibold text-white">Ny kursspiller – tre alternativer</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-neutral-300">
          Dagens spiller bruker hele 1400 px, har sidemeny + modulrekkverk + HUD samtidig og leses som
          en admin-flate. Disse tre alternativene begrenser bredden, hever typografien og bygger
          engasjement på hver sin måte. Mock-data er en 12-minutters mikrolæring («Internkontroll i
          praksis») med tekst-, quiz- og refleksjonsmodul slik at alle tre kan vises side om side.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        {variants.map((v) => (
          <Link
            key={v.to}
            to={v.to}
            className="group flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-7 transition hover:border-amber-400/40 hover:bg-white/[0.07]"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex size-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${v.accent}25`, color: v.accent }}
              >
                <v.icon className="size-5" />
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[2px] text-neutral-500">
                  {v.eyebrow}
                </p>
                <h2 className="text-xl font-semibold text-white">{v.title}</h2>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-neutral-300">{v.oneLiner}</p>

            <dl className="space-y-3 border-t border-white/5 pt-4 text-xs">
              <div>
                <dt className="font-medium uppercase tracking-wide text-neutral-500">Mental modell</dt>
                <dd className="mt-0.5 text-neutral-300">{v.mentalModel}</dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-neutral-500">Engasjement</dt>
                <dd className="mt-0.5 text-neutral-300">{v.engagement}</dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-neutral-500">Bredde</dt>
                <dd className="mt-0.5 font-mono text-neutral-400">{v.widthTarget}</dd>
              </div>
            </dl>

            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 group-hover:text-amber-300">
              Åpne preview <ArrowRight className="size-4" />
            </span>
          </Link>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">UX-tester-notater</h3>
        <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-neutral-300 md:grid-cols-2">
          <li>
            <strong className="text-white">Hvor er jeg?</strong> Alle tre alternativene viser modulnummer
            og total fremdrift uten å konkurrere med leseinnholdet.
          </li>
          <li>
            <strong className="text-white">Én CTA per skjerm.</strong> Tilbakeknapper holder seg sekundære.
            Primær fortsett/fullfør er alltid den synlig viktigste handlingen.
          </li>
          <li>
            <strong className="text-white">Tastatur:</strong> Pil-høyre/venstre flytter mellom moduler i
            alle tre. Quiz låser opp Neste først etter bestått terskel.
          </li>
          <li>
            <strong className="text-white">Kontrast:</strong> Tekst er #0a0a0a på #fdfcf7 (Focus + Coach)
            eller #f3f4f6 på #0f172a (Cinema). Begge passerer AA på 16 px.
          </li>
        </ul>
      </section>
    </div>
  )
}
