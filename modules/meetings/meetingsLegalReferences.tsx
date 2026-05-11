// Legal-references banner shown on the meetings hub + analyse pages.
// The body explains *why* the meeting register matters under Norwegian
// labour + IK-f + ISO + GDPR regimes. Pure presentation.

import { Scale } from 'lucide-react'

export function MeetingsLegalReferences() {
  return (
    <section className="rounded-none border border-black/15 bg-[#f7f6f2] p-5 text-sm leading-relaxed text-neutral-800">
      <header className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
        <Scale className="h-3.5 w-3.5" aria-hidden />
        Rettsgrunnlag
      </header>
      <p>
        Møteregisteret samler lovpålagte møter på tvers av rammeverk og produserer
        protokoll, vedtakshistorikk og oppfølgingsoppgaver med revisjonsspor.
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        <li>
          <strong>AML § 7-2</strong> — arbeidsmiljøutvalg, herunder § 7-2 (2) årlige tema
          og § 7-2 (6) årsrapport.
        </li>
        <li>
          <strong>AML § 6-2</strong> — verneombudsmøter, kvartalsvis kadens.
        </li>
        <li>
          <strong>AML § 8-2 / § 15-1</strong> — drøftingsplikt ved omstilling.
        </li>
        <li>
          <strong>AML § 2A-7 (5)</strong> — varslingsutvalg.
        </li>
        <li>
          <strong>IK-forskriften § 5 nr. 7</strong> — systematisk dokumentasjon
          av møter, vedtak og oppfølging.
        </li>
        <li>
          <strong>Forskrift om org. ledelse § 3-2</strong> — minst 7 dagers
          innkallingsfrist.
        </li>
        <li>
          <strong>Likestillingsloven § 26 og § 26a</strong> — årlig drøfting,
          aktivitetsplikt og lønnskartlegging.
        </li>
        <li>
          <strong>Hovedavtalen § 9-3</strong> — bedriftsutvalg / drøftingsmøter.
        </li>
        <li>
          <strong>ISO 9001 / 14001 / 27001 / 45001 § 9.3</strong> — ledelsens
          gjennomgang.
        </li>
        <li>
          <strong>GDPR Art. 30 / 35</strong> — ROPA-årsgjennomgang og DPIA-møter.
        </li>
      </ul>
    </section>
  )
}
