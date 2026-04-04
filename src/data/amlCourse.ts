/**
 * Arbeidsmiljøloven for ledere — komplett e-læringskurs
 *
 * Dekker AML kap. 2–7 med alle modul-typer:
 * text, image, video, flashcard, quiz, checklist, tips, on_job
 *
 * Bilder: Unsplash (fri lisens, illustrativt).
 * Video: YouTube-embeds (illustrativt — bytt til faktiske opplæringsvideoer i produksjon).
 */

import type { Course } from '../types/learning'

const NOW = new Date().toISOString()

export const AML_COURSE: Course = {
  id: 'c-aml-ledere',
  title: 'Arbeidsmiljøloven for ledere',
  description:
    'Et komplett kurs for ledere og mellomledere om rettigheter, plikter og ansvar etter Arbeidsmiljøloven (AML). Dekker systematisk HMS-arbeid, risikovurdering, verneombud, sykefraværsoppfølging og mer. Gjennomføring gir grunnlag for 40-timers HMS-kurs.',
  status: 'published',
  tags: ['AML', 'Ledelse', 'HMS', 'Obligatorisk', 'Arbeidsrett'],
  createdAt: NOW,
  updatedAt: NOW,
  modules: [

    // ── 1. Introduksjon og lederens ansvar ────────────────────────────────

    {
      id: 'aml-m01',
      title: 'Introduksjon — Lederens HMS-ansvar',
      order: 0,
      kind: 'text',
      durationMinutes: 6,
      content: {
        kind: 'text',
        body: `
<h2>Hva er Arbeidsmiljøloven?</h2>
<p>Arbeidsmiljøloven (AML) av 2005 er Norges viktigste lov for arbeidsliv. Den stiller krav til <strong>fysisk og psykososialt arbeidsmiljø</strong>, regulerer arbeidstid, vern mot diskriminering, verneorganisasjon og mye mer.</p>

<h3>Lovens formål (§1-1)</h3>
<p>Loven skal:</p>
<ul>
  <li>Sikre et arbeidsmiljø som gir grunnlag for en helsefremmende og meningsfylt arbeidssituasjon</li>
  <li>Gi full trygghet mot fysiske og psykiske skadevirkninger</li>
  <li>Bidra til et inkluderende arbeidsliv</li>
</ul>

<h3>Arbeidsgivers ansvar (§2-1)</h3>
<p>Arbeidsgiver <strong>kan ikke delegere bort det grunnleggende HMS-ansvaret</strong>. Som leder er du bindeleddet mellom eieren av virksomheten og den daglige HMS-etterlevelsen.</p>
<p>Loven opererer med begrepet <em>virksomheten</em>, men i praksis er det <strong>du som leder</strong> som svarer for at:</p>
<ol>
  <li>Kravene i loven er kjent og etterlevd i din avdeling</li>
  <li>Avvik registreres og følges opp</li>
  <li>Ansatte har det de trenger for å jobbe trygt og forsvarlig</li>
</ol>

<h3>Straffeansvar</h3>
<p>Brudd på AML kan medføre <strong>bøter eller fengsel inntil 2 år</strong> for arbeidsgiver og ledere som forsettlig eller uaktsomt overtrer loven (§ 19-1). Det er derfor ikke bare en etisk, men en juridisk forpliktelse å kjenne loven.</p>

<blockquote style="border-left:4px solid #1a3d32;padding:0.75rem 1rem;background:#f0f9f5;margin:1rem 0">
  <strong>Huskeregel:</strong> Som leder er du ikke bare «en ressurs» — du er en juridisk ansvarlig aktør. Arbeidstilsynet kan rette tilsyn direkte mot deg personlig.
</blockquote>
        `.trim(),
      },
    },

    // ── 2. Illustrasjon: lederrollen i HMS-systemet ───────────────────────

    {
      id: 'aml-m02',
      title: 'Lederens plass i HMS-systemet',
      order: 1,
      kind: 'image',
      durationMinutes: 3,
      content: {
        kind: 'image',
        imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=80',
        caption:
          'Ledere er bindeleddet mellom virksomhetens overordnede HMS-mål og den daglige praksisen på arbeidsplassen. Fra venstre: Toppledelse (HMS-policy) → Leder (implementering) → Ansatte (etterlevelse). Verneombudet er arbeidstakernes representant i dette systemet.',
      },
    },

    // ── 3. Sentrale begreper — flashkort ──────────────────────────────────

    {
      id: 'aml-m03',
      title: 'Sentrale AML-begreper',
      order: 2,
      kind: 'flashcard',
      durationMinutes: 8,
      content: {
        kind: 'flashcard',
        slides: [
          {
            id: 'fc01',
            front: 'Hva er «systematisk HMS-arbeid»?',
            back: 'Planlagt, gjennomført, kontrollert og forbedret arbeid for å oppfylle kravene i AML og internkontrollforskriften. Det er et løpende system — ikke enkelthandlinger.',
          },
          {
            id: 'fc02',
            front: 'Hvem er «arbeidsgiver» i AML §2-1?',
            back: 'Enhver som har ansatt arbeidstaker. Styringsretten og HMS-ansvaret følger rollen — ikke nødvendigvis tittel. En avdelingsleder er arbeidsgiver for sine ansatte.',
          },
          {
            id: 'fc03',
            front: 'Hva betyr «fullt forsvarlig arbeidsmiljø» (§4-1)?',
            back: 'Arbeidsmiljøet skal til enhver tid være fullt forsvarlig, vurdert ut fra en enkeltvis og samlet vurdering av faktorer i arbeidsmiljøet som kan innvirke på arbeidstakernes fysiske og psykiske helse og velferd.',
          },
          {
            id: 'fc04',
            front: 'Hva er et «avvik»?',
            back: 'Et avvik er ethvert brudd på krav fastsatt i eller i medhold av HMS-lovgivningen, eller interne rutiner. Inkluderer ulykker, nestenulykker og farlige forhold.',
          },
          {
            id: 'fc05',
            front: 'Hva er «psykososialt arbeidsmiljø» (§4-3)?',
            back: 'Faktorer knyttet til arbeidets innhold og organisering som kan påvirke mental helse: arbeidsmengde, autonomi, sosiale relasjoner, konflikter, trakassering og mer.',
          },
          {
            id: 'fc06',
            front: 'Hva menes med «internkontroll»?',
            back: 'Systematiske tiltak for å sikre at virksomhetens aktiviteter planlegges, organiseres, utføres og vedlikeholdes i samsvar med krav fastsatt i HMS-lovgivningen. Regulert av Internkontrollforskriften §5.',
          },
          {
            id: 'fc07',
            front: 'Hva er «individuell tilrettelegging» (§4-6)?',
            back: 'Arbeidsgiver har plikt til å iverksette nødvendige tiltak for å gjøre det mulig for en arbeidstaker med redusert arbeidsevne å beholde arbeidsplassen. Plikten er sterk, men ikke absolutt.',
          },
          {
            id: 'fc08',
            front: 'Hva er «Arbeidstilsynet»?',
            back: 'Statlig tilsynsorgan som fører kontroll med at AML og HMS-regelverk følges. Kan gi pålegg, stanse virksomhet og ilegge tvangsmulkt. Hjemlet i AML kap. 18.',
          },
          {
            id: 'fc09',
            front: 'Hva er «verneombud» (§6-1)?',
            back: 'Arbeidstakernes representant i HMS-saker. Velges av og blant arbeidstakerne. Skal ivareta arbeidstakernes interesser og se til at arbeidsmiljøkravene overholdes.',
          },
          {
            id: 'fc10',
            front: 'Hva er «AMU» (§7-1)?',
            back: 'Arbeidsmiljøutvalg — partssammensatt organ (50/50 arbeidsgiver/arbeidstaker) i virksomheter med 30+ ansatte. Behandler HMS-spørsmål og har rett til å avgi uttalelser.',
          },
        ],
      },
    },

    // ── 4. Systematisk HMS-arbeid — video ────────────────────────────────

    {
      id: 'aml-m04',
      title: 'Systematisk HMS-arbeid (§3-1 + IK-forskriften)',
      order: 3,
      kind: 'video',
      durationMinutes: 10,
      content: {
        kind: 'video',
        url: 'https://www.youtube.com/watch?v=s_DZzOR_a4I',
        caption:
          'Arbeidstilsynets introduksjonsvideo om internkontroll og systematisk HMS-arbeid. AML §3-1 krever at arbeidsgiver sørger for HMS-arbeid på alle plan i virksomheten, i samarbeid med arbeidstakerne og deres tillitsvalgte. Internkontrollforskriften §5 presiserer hva som må dokumenteres skriftlig. (Bytt til intern opplæringsvideo i produksjon.)',
      },
    },

    // ── 5. IK-forskriften §5 — tekst og krav ────────────────────────────

    {
      id: 'aml-m05',
      title: 'Hva krever §3-1 og IK-forskriften av deg?',
      order: 4,
      kind: 'text',
      durationMinutes: 7,
      content: {
        kind: 'text',
        body: `
<h2>AML §3-1 — Krav til systematisk HMS-arbeid</h2>
<p>Lovteksten slår fast at arbeidsgiver skal sørge for systematisk helse-, miljø- og sikkerhetsarbeid på <em>alle plan</em> i virksomheten. Dette gjøres i samarbeid med arbeidstakerne og deres tillitsvalgte.</p>

<h3>De åtte kravene (§3-1 nr. 2 + IK-f §5)</h3>
<table>
  <thead><tr><th>Krav</th><th>Hjemmel</th></tr></thead>
  <tbody>
    <tr><td>Fastsette HMS-mål</td><td>§3-1 nr. 2a / IK-f §5 nr. 1a</td></tr>
    <tr><td>Oversikt over ansvar og myndighet</td><td>IK-f §5 nr. 1b</td></tr>
    <tr><td>Kunnskap om lover og regler</td><td>IK-f §5 nr. 1c</td></tr>
    <tr><td>Kartlegge farer og risikovurdere</td><td>§3-1 nr. 2c / IK-f §5 nr. 2</td></tr>
    <tr><td>Handlingsplaner</td><td>IK-f §5 nr. 3</td></tr>
    <tr><td>Rutiner for avviksbehandling</td><td>§3-1 nr. 2e / IK-f §5 nr. 4</td></tr>
    <tr><td>Systematisk oppfølging av sykefravær</td><td>§3-1 nr. 2f</td></tr>
    <tr><td>Systematisk gjennomgang (årsgjennomgang)</td><td>IK-f §5 nr. 5</td></tr>
  </tbody>
</table>

<h3>Dokumentasjonskravet</h3>
<p>Alt HMS-arbeid som er nevnt over <strong>skal dokumenteres skriftlig</strong>. Det betyr ikke at du trenger tykke permer — et digitalt system som dette dekker kravet, forutsatt at dataene kan fremvises ved tilsyn.</p>

<h3>Lederens oppgave</h3>
<p>Som leder er du ansvarlig for at disse kravene er ivaretatt i din enhet:</p>
<ul>
  <li>Gjennomfør vernerunder etter plan</li>
  <li>Registrer og følg opp avvik umiddelbart</li>
  <li>Gjennomfør ROS-vurdering ved endringer</li>
  <li>Sørg for at ansatte kjenner sine rettigheter og plikter</li>
</ul>
        `.trim(),
      },
    },

    // ── 6. Risikovurdering — illustrasjon ────────────────────────────────

    {
      id: 'aml-m06',
      title: 'Risikovurdering — 5×5-matrisen',
      order: 5,
      kind: 'image',
      durationMinutes: 4,
      content: {
        kind: 'image',
        imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&q=80',
        caption:
          'En 5×5-risikomatrise (alvorlighetsgrad × sannsynlighet) er standard metodikk i Norge. Grønn sone (1–6): akseptabel risiko. Gul sone (8–12): moderat, tiltak vurderes. Rød sone (15–25): uakseptabel, strakstiltak kreves. Kartlegging gjøres i samarbeid med verneombudet og de ansatte (AML §3-1).',
      },
    },

    // ── 7. Risikovurdering — flashkort ────────────────────────────────────

    {
      id: 'aml-m07',
      title: 'Risikovurdering — nøkkelkort',
      order: 6,
      kind: 'flashcard',
      durationMinutes: 6,
      content: {
        kind: 'flashcard',
        slides: [
          {
            id: 'rf01',
            front: 'Hva er forskjellen på «fare» og «risiko»?',
            back: '«Fare» er et potensial for skade (f.eks. en glatt trapp). «Risiko» er sannsynligheten for at faren fører til skade multiplisert med konsekvensens alvor. Risiko = fare × eksponering.',
          },
          {
            id: 'rf02',
            front: 'Hvem skal delta i en risikovurdering?',
            back: 'AML §3-1 krever medvirkning fra arbeidstakerne og deres tillitsvalgte. Verneombudet skal alltid involveres. Ekstern bedriftshelsetjeneste kan bidra ved komplekse vurderinger.',
          },
          {
            id: 'rf03',
            front: 'Hva er «restrisiko»?',
            back: 'Gjenværende risiko etter at tiltak er iverksatt. Dokumenteres ved å gjøre en ny vurdering med ny alvorlighetsgrad og ny sannsynlighet. Beviser at tiltaket faktisk virker.',
          },
          {
            id: 'rf04',
            front: 'Hva utløser krav om ny ROS-vurdering?',
            back: 'Vesentlige endringer i virksomheten: ny teknologi, omorganisering, nye arbeidsoppgaver, nye ansatte, hendelser/avvik, eller regelmessig revisjon (typisk hvert 2–3 år).',
          },
          {
            id: 'rf05',
            front: 'Hva er SJA (Sikker Jobb Analyse)?',
            back: 'En kortfattet risikoanalyse gjennomført umiddelbart FØR en konkret, ikke-rutinepreget arbeidsoperasjon. Alle berørte arbeidstakere deltar. Sikrer at farer er identifisert og tiltak er på plass.',
          },
        ],
      },
    },

    // ── 8. Kunnsjekk §3-1 — quiz ─────────────────────────────────────────

    {
      id: 'aml-m08',
      title: 'Kunnsjekk: Systematisk HMS-arbeid (§3-1)',
      order: 7,
      kind: 'quiz',
      durationMinutes: 10,
      content: {
        kind: 'quiz',
        questions: [
          {
            id: 'q301',
            question: 'Hvem har det overordnede HMS-ansvaret etter AML §2-1?',
            options: [
              'Verneombudet',
              'Arbeidsgiver',
              'Arbeidstakerne i fellesskap',
              'HR-avdelingen',
            ],
            correctIndex: 1,
          },
          {
            id: 'q302',
            question: 'Hva er det minste antall ganger en virksomhet med 50+ ansatte MÅ avholde AMU-møter per år?',
            options: ['1 gang', '2 ganger', '4 ganger', '12 ganger'],
            correctIndex: 2,
          },
          {
            id: 'q303',
            question: 'AML §3-1 krever at HMS-arbeidet gjennomføres «i samarbeid med…»',
            options: [
              'Arbeidstilsynet',
              'Bedriftshelsetjenesten',
              'Arbeidstakerne og deres tillitsvalgte',
              'Styret i virksomheten',
            ],
            correctIndex: 2,
          },
          {
            id: 'q304',
            question: 'Hvilke av disse er IKKE en av de åtte kravene i IK-forskriften §5?',
            options: [
              'Fastsette HMS-mål',
              'Kartlegge farer og risikovurdere',
              'Registrere alle ansattes lønn',
              'Rutiner for avviksbehandling',
            ],
            correctIndex: 2,
          },
          {
            id: 'q305',
            question: 'Hva er konsekvensen av å forsettlig bryte AML-kravene (§19-1)?',
            options: [
              'Kun en advarsel fra Arbeidstilsynet',
              'Bøter eller fengsel inntil 2 år',
              'Administrativ irettesettelse internt',
              'Ingen straffeansvar — kun sivilrettslig ansvar',
            ],
            correctIndex: 1,
          },
          {
            id: 'q306',
            question: 'En leder oppdager en glatt trapp. Hva er den FØRSTE plikten etter AML?',
            options: [
              'Vente til neste vernerunde og registrere det der',
              'Informere styret skriftlig',
              'Iverksette umiddelbare tiltak og registrere avvik',
              'Spørre verneombudet om det er nødvendig å gjøre noe',
            ],
            correctIndex: 2,
          },
          {
            id: 'q307',
            question: 'Internkontrollforskriften krever at HMS-arbeidet dokumenteres…',
            options: [
              'Kun muntlig i personalmøter',
              'Skriftlig',
              'Bare dersom Arbeidstilsynet ber om det',
              'Én gang per år i årsrapporten',
            ],
            correctIndex: 1,
          },
          {
            id: 'q308',
            question: 'Hva er «psykososialt arbeidsmiljø» etter AML §4-3?',
            options: [
              'Ergonomi og fysisk belastning',
              'Støy og kjemisk eksponering',
              'Faktorer som kan påvirke arbeidstakernes mentale helse',
              'Utelukkende mobbing og trakassering',
            ],
            correctIndex: 2,
          },
          {
            id: 'q309',
            question: 'Verneombudets viktigste oppgave er:',
            options: [
              'Representere arbeidsgiver i tvister',
              'Ivareta arbeidstakernes interesser i HMS-saker',
              'Rapportere ansatte som bryter HMS-regler',
              'Signere alle ROS-vurderinger',
            ],
            correctIndex: 1,
          },
          {
            id: 'q310',
            question: 'Når skal det gjennomføres ny risikovurdering (ROS)?',
            options: [
              'Kun ved nyansettelser',
              'Aldri — én ROS holder for hele virksomhetens levetid',
              'Ved vesentlige endringer og regelmessig revisjon',
              'Bare etter ulykker som medfører sykefravær',
            ],
            correctIndex: 2,
          },
        ],
      },
    },

    // ── 9. Verneombud og AMU — tekst ──────────────────────────────────────

    {
      id: 'aml-m09',
      title: 'Verneombudet og AMU (§6–§7)',
      order: 8,
      kind: 'text',
      durationMinutes: 7,
      content: {
        kind: 'text',
        body: `
<h2>Verneombudet (§6-1 – §6-5)</h2>
<p>Alle virksomheter med 10 eller flere ansatte <strong>skal ha verneombud</strong>. I virksomheter med særlig risiko kan Arbeidstilsynet kreve verneombud uavhengig av størrelse.</p>

<h3>Verneombudets oppgaver (§6-2)</h3>
<ul>
  <li>Se til at arbeidsmiljøkravene er overholdt</li>
  <li>Ta opp spørsmål om arbeidsmiljøet med arbeidsgiver</li>
  <li>Ivareta arbeidstakernes interesser i HMS-saker</li>
  <li>Delta i vernerunder og kartlegginger</li>
</ul>

<h3>Verneombudets rettigheter</h3>
<ul>
  <li><strong>Stansingsrett (§6-3):</strong> Kan stanse farlig arbeid umiddelbart. Arbeidsgiver kan ikke overprøve stansen — kun Arbeidstilsynet kan gjøre dette.</li>
  <li><strong>Opplæring (§6-5):</strong> Krav på minst 40 timers HMS-opplæring. Arbeidsgiver betaler kostnader og lønn under opplæringen.</li>
  <li><strong>Vern mot gjengjeldelse:</strong> Kan ikke sies opp eller få reduserte betingelser som følge av vervet.</li>
</ul>

<h3>Lederens plikt overfor verneombudet</h3>
<blockquote style="border-left:4px solid #1a3d32;padding:0.75rem 1rem;background:#f0f9f5;margin:1rem 0">
  Som leder plikter du å <strong>samarbeide med verneombudet</strong>, gi dem nødvendig informasjon, gi dem tid til å utføre vervet, og ikke hindre dem i arbeidet.
</blockquote>

<h2>Arbeidsmiljøutvalget — AMU (§7-1 – §7-4)</h2>
<p>Virksomheter med <strong>30 eller flere ansatte</strong> skal ha AMU. Fra 1. januar 2024 er grensen senket — sjekk gjeldende regler.</p>

<h3>AMUs oppgaver (§7-2)</h3>
<ul>
  <li>Behandle spørsmål om bedriftshelsetjeneste</li>
  <li>Behandle planer om bygg, utstyr og produksjonsprosesser</li>
  <li>Behandle spørsmål om opplæring og instruksjon</li>
  <li>Behandle og evaluere HMS-systemer</li>
</ul>

<h3>AMU-møter</h3>
<p>AMU skal møtes minst <strong>4 ganger per år</strong>. Møtene dokumenteres med referat og gjøres tilgjengelig for alle ansatte.</p>
        `.trim(),
      },
    },

    // ── 10. Verneombud — flashkort ────────────────────────────────────────

    {
      id: 'aml-m10',
      title: 'Verneombud og AMU — hurtigtester',
      order: 9,
      kind: 'flashcard',
      durationMinutes: 5,
      content: {
        kind: 'flashcard',
        slides: [
          {
            id: 'vf01',
            front: 'Kan en leder velge bort verneombud i en liten bedrift?',
            back: 'Nei. Virksomheter med 10+ ansatte er lovpålagt å ha verneombud. For virksomheter med færre ansatte kan det avtales mellom partene.',
          },
          {
            id: 'vf02',
            front: 'Hva skjer hvis leder ignorerer et krav fra verneombudet?',
            back: 'Verneombudet kan bringe saken inn for AMU, Arbeidstilsynet eller bruke stansingsretten ved akutt fare. Ignorering kan utgjøre brudd på AML §6-2.',
          },
          {
            id: 'vf03',
            front: 'Hva er «stansingsretten» (§6-3) i praksis?',
            back: 'Verneombudet kan stanse arbeid som medfører umiddelbar fare for liv eller helse. Arbeidsgiver varsles umiddelbart. Kun Arbeidstilsynet kan oppheve stansen mot verneombudets vilje.',
          },
          {
            id: 'vf04',
            front: 'Hvem betaler for verneombudets 40-timers opplæring?',
            back: 'Arbeidsgiver betaler alle kostnader (kurs, reise, tapt arbeidsfortjeneste). Arbeidsgiver kan ikke nekte verneombudet nødvendig opplæring (§6-5).',
          },
          {
            id: 'vf05',
            front: 'Hva er «partssammensatt» i AMU-kontekst?',
            back: 'AMU skal ha lik representasjon fra arbeidsgiver og arbeidstaker (50/50). Leder og verneombud sitter typisk i AMU, og begge sider har stemmerett.',
          },
        ],
      },
    },

    // ── 11. Sykefravær og tilrettelegging — video ────────────────────────

    {
      id: 'aml-m11',
      title: 'Sykefravær og tilrettelegging (§4-6)',
      order: 10,
      kind: 'video',
      durationMinutes: 8,
      content: {
        kind: 'video',
        url: 'https://www.youtube.com/watch?v=Qu8LMbY0HZ4',
        caption:
          'NAVs opplæringsvideo om oppfølging av sykmeldte. AML §4-6 pålegger arbeidsgiver å iverksette tilrettelegging for ansatte med redusert arbeidsevne. Se også NAVs tidslinje: 4 uker (oppfølgingsplan), 7 uker (dialogmøte 1), 9 uker (melding til NAV). (Bytt til intern video i produksjon.)',
      },
    },

    // ── 12. Oppfølgingsplikter — sjekkliste ──────────────────────────────

    {
      id: 'aml-m12',
      title: 'Sjekkliste: Sykefraværsoppfølging (§4-6)',
      order: 11,
      kind: 'checklist',
      durationMinutes: 5,
      content: {
        kind: 'checklist',
        items: [
          { id: 'sl01', label: 'Dag 1–3: Ta kontakt med sykmeldt ansatt (telefonsamtale, vis omsorg)' },
          { id: 'sl02', label: 'Dag 4: Egenmelding avklart, eventuell sykemelding mottatt' },
          { id: 'sl03', label: 'Innen 4 uker: Oppfølgingsplan utarbeidet sammen med ansatt (AML §4-6 nr. 1)' },
          { id: 'sl04', label: 'Innen 7 uker: Dialogmøte 1 avholdt — leder og ansatt, ev. bedriftshelsetjeneste (AML §4-6 nr. 2)' },
          { id: 'sl05', label: 'Innen 9 uker: Meldt til NAV dersom arbeidsevnen fortsatt er nedsatt (sykmeldingsforskriften)' },
          { id: 'sl06', label: 'Innen 26 uker: Dialogmøte 2 med NAV dersom fortsatt sykmeldt' },
          { id: 'sl07', label: 'Kontinuerlig: Dokumenter alle tiltak og samtaler i HR-systemet' },
          { id: 'sl08', label: 'Husk: Tilretteleggingsplikten er sterk — bare varig umulighet fritar' },
          { id: 'sl09', label: 'Taushetsplikt: Medisinsk informasjon behandles konfidensielt (GDPR)' },
          { id: 'sl10', label: 'Avklar behov for aktiv sykmelding / gradert sykmelding med lege' },
        ],
      },
    },

    // ── 13. Lederens praktiske tips ──────────────────────────────────────

    {
      id: 'aml-m13',
      title: 'Praktiske tips for ledere',
      order: 12,
      kind: 'tips',
      durationMinutes: 4,
      content: {
        kind: 'tips',
        items: [
          'Hold alle medarbeidersamtaler dokumentert — de kan bli sentrale i en eventuell tvist om oppfølging.',
          'Bruk «nærværssamtaler» proaktivt — ta kontakt FØR sykmelding ved tegn på mistrivsel eller høy belastning.',
          'Aldri still spørsmål om diagnose — du har rett til å vite om arbeidstaker kan jobbe og hva som kreves for tilrettelegging, ikke hva personen feiler.',
          'Involver verneombudet tidlig — de er en ressurs, ikke en motstander.',
          'Dokumenter alt du gjør i sykefraværsoppfølgingen — «det er ikke gjort hvis det ikke er skrevet».',
          'Kjenn grensen for tilretteleggingsplikten: den gjelder inntil «det vil medføre uforholdsmessig stor belastning».',
          'Vurder gradert sykmelding og aktiv sykmelding — de reduserer kostnader for virksomheten og holder ansatte tilknyttet arbeidsplassen.',
          'Sørg for at alle ledere under deg kjenner §4-6-forpliktelsene — du er ansvarlig for at de etterlever loven i sine avdelinger.',
          'Bruk bedriftshelsetjenesten — de kan delta i dialogmøter og bistå med tilrettelegging.',
          'Husk: Å ignorere sykefravær er dyrere enn å følge opp. NAV refunderer sykepenger for de første 16 dagene, deretter tar NAV over.',
        ],
      },
    },

    // ── 14. Arbeidstid og hvile — tekst og bilde ─────────────────────────

    {
      id: 'aml-m14',
      title: 'Arbeidstid — regler du MUST kjenne (kap. 10)',
      order: 13,
      kind: 'text',
      durationMinutes: 6,
      content: {
        kind: 'text',
        body: `
<h2>Arbeidstidsreglene (AML kap. 10)</h2>
<p>Brudd på arbeidstidsreglene er en av de vanligste grunnene til pålegg fra Arbeidstilsynet. Som leder er det <strong>din plikt</strong> å planlegge arbeidet slik at reglene overholdes.</p>

<h3>Grensene du må huske</h3>
<table>
  <thead><tr><th>Regel</th><th>Grense</th><th>Hjemmel</th></tr></thead>
  <tbody>
    <tr><td>Alminnelig arbeidstid</td><td>9 timer per dag / 40 timer per uke</td><td>§10-4 (1)</td></tr>
    <tr><td>Gjennomsnittsberegning</td><td>Max 48 timer per uke over 8 uker</td><td>§10-5</td></tr>
    <tr><td>Overtid (samlet)</td><td>Max 10 timer per uke / 25 timer per 4 uker / 200 timer per år</td><td>§10-6</td></tr>
    <tr><td>Daglig hvile</td><td>Min 11 sammenhengende timer mellom arbeidsøkter</td><td>§10-8 (1)</td></tr>
    <tr><td>Ukentlig hvile</td><td>Min 35 sammenhengende timer per uke</td><td>§10-8 (2)</td></tr>
    <tr><td>Nattarbeid</td><td>Kun tillatt der arbeidets art gjør det nødvendig</td><td>§10-11</td></tr>
  </tbody>
</table>

<h3>Avvik gjennom tariffavtale</h3>
<p>Mange av reglene kan fravikes gjennom <strong>tariffavtale mellom arbeidsgiver og fagforening</strong>. Individuelle avtaler mellom leder og ansatt er vanligvis ikke tilstrekkelig.</p>

<h3>Lederens ansvar</h3>
<ul>
  <li>Sørg for at timeregistreringssystemet er oppdatert og korrekt</li>
  <li>Gi pålegg om overtid bare i nødsituasjoner — ikke som fast praksis</li>
  <li>Gjennomgå arbeidsbelastningen regelmessig med verneombudet</li>
</ul>

<blockquote style="border-left:4px solid #c9a227;padding:0.75rem 1rem;background:#fffbf0;margin:1rem 0">
  <strong>OBS:</strong> «Kultur for å jobbe mye» fritar ikke arbeidsgiver. Arbeidstilsynet aksepterer ikke «det er frivillig» som unnskyldning for systematiske brudd på hviletidsreglene.
</blockquote>
        `.trim(),
      },
    },

    // ── 15. Arbeidstid — illustrasjon ────────────────────────────────────

    {
      id: 'aml-m15',
      title: 'Arbeidstidsgrenser visuelt',
      order: 14,
      kind: 'image',
      durationMinutes: 2,
      content: {
        kind: 'image',
        imageUrl: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=900&q=80',
        caption:
          'Husk: 11 timer sammenhengende daglig hvile og 35 timer ukentlig hvile er absolutte minsterettigheter etter AML kap. 10. Overtid over grensene er et lovbrudd — ikke bare et ledelsesmessig spørsmål. Kontroller timeregistreringen regelmessig.',
      },
    },

    // ── 16. Diskriminering og likestilling — tekst ───────────────────────

    {
      id: 'aml-m16',
      title: 'Diskriminering og likestilling (kap. 13)',
      order: 15,
      kind: 'text',
      durationMinutes: 5,
      content: {
        kind: 'text',
        body: `
<h2>Vern mot diskriminering (AML kap. 13)</h2>
<p>AML forbyr diskriminering i arbeidsforhold på en rekke grunnlag. Som leder er du direkte ansvarlig for å sikre at din enhet ikke diskriminerer — verken åpenlyst eller indirekte.</p>

<h3>Diskrimineringsgrunnlag (§13-1)</h3>
<ul>
  <li>Politisk syn</li>
  <li>Medlemskap i arbeidstakerorganisasjon</li>
  <li>Alder</li>
  <li>Etnisitet, nasjonal opprinnelse, hudfarge, språk, religion, livssyn</li>
  <li>Kjønn, graviditet, permisjon ved fødsel/adopsjon</li>
  <li>Seksuell orientering, kjønnsidentitet, kjønnsuttrykk</li>
  <li>Nedsatt funksjonsevne</li>
</ul>

<h3>Forbud og unntak</h3>
<p>Forbudet gjelder <em>alle faser</em> av arbeidsforholdet: ansettelse, arbeidsoppgaver, lønns- og arbeidsvilkår, opplæring, forfremmelse og oppsigelse.</p>
<p>Unntak finnes for saklige krav til stillingen (f.eks. krav om norsk statsborgerskap for visse offentlige stillinger).</p>

<h3>Lederes særlige ansvar</h3>
<ul>
  <li>Bruk objektive kriterier ved ansettelse — dokumenter prosessen</li>
  <li>Gripe inn ved uønsket adferd mellom ansatte</li>
  <li>Nulltoleranse for trakassering (§13-1 nr. 2)</li>
  <li>Tilrettelegge for ansatte med nedsatt funksjonsevne</li>
</ul>

<blockquote style="border-left:4px solid #e11d48;padding:0.75rem 1rem;background:#fff1f2;margin:1rem 0">
  <strong>Viktig:</strong> Bevisbyrdereglene er snudd i diskrimineringssaker. Dersom arbeidstaker kan sannsynliggjøre at diskriminering har funnet sted, er det <em>du som arbeidsgiver</em> som må bevise at det ikke skjedde (§13-8).
</blockquote>
        `.trim(),
      },
    },

    // ── 17. Praktiske scenarier — on_job ─────────────────────────────────

    {
      id: 'aml-m17',
      title: 'Praktiske lederscenarier — oppgaver i hverdagen',
      order: 16,
      kind: 'on_job',
      durationMinutes: 15,
      content: {
        kind: 'on_job',
        tasks: [
          {
            id: 'oj01',
            title: 'Scenario 1: Ansatt varsler om trakassering',
            description:
              'En ansatt ber om et møte og forteller at en kollega gjentatte ganger har kommentert utseendet hennes på en nedverdigende måte. Hva gjør du? OPPGAVE: Noter stegene du vil ta de neste 48 timene, hvem du vil involvere, og hvilken lovbestemmelse som er relevant (hint: AML §4-3 og kap. 13).',
          },
          {
            id: 'oj02',
            title: 'Scenario 2: Verneombudet stapper et prosjekt',
            description:
              'Verneombudet stopper et hasteoppdrag fordi en stillasmontasje ikke er risikovurdert. Du er under tidspress fra kunden. OPPGAVE: Hva er dine juridiske handlingsalternativer? Hvem kan oppheve stansen? Beskriv hva du gjør de neste 2 timene.',
          },
          {
            id: 'oj03',
            title: 'Scenario 3: Planlegge vernerunde',
            description:
              'Du er ny leder og har ikke hatt vernerunde på 14 måneder. OPPGAVE: Lag en konkret plan for å gjennomføre en lovpålagt vernerunde innen 4 uker. Hvem inviterer du, hvilken sjekkliste bruker du, og hva gjør du med avvikene du finner?',
          },
          {
            id: 'oj04',
            title: 'Scenario 4: Ansatt har vært sykmeldt i 5 uker',
            description:
              'En ansatt er inne i uke 5 av sykmeldingen. Du har ikke hatt kontakt siden uke 2. OPPGAVE: Hva er du juridisk pliktig å gjøre NÅ? Hvilken frist gjelder? Hva kan skje dersom du ikke handler? (hint: §4-6 og 7-ukersmøtet)',
          },
          {
            id: 'oj05',
            title: 'Scenario 5: Arbeidstidsovertramp',
            description:
              'En prosjektleder i teamet ditt jobber systematisk 12-timers dager for å levere et prosjekt. Han sier at det er frivillig og at han er glad for muligheten. OPPGAVE: Er dette greit? Hva sier AML? Hva bør du gjøre — og dokumentere?',
          },
          {
            id: 'oj06',
            title: 'Scenario 6: Ansettelsesprosess',
            description:
              'Du skal ansette en ny avdelingsleder. En søker er gravid, en er over 60 år, og en er den mest kvalifiserte kandidaten. OPPGAVE: Hvilke rettslige krav gjelder? Hva kan og kan ikke vektlegges? Dokumenter ditt valg slik at det tåler granskning.',
          },
        ],
      },
    },

    // ── 18. Oppsigelse og stillingsvern — tekst ──────────────────────────

    {
      id: 'aml-m18',
      title: 'Oppsigelse og stillingsvern (kap. 15)',
      order: 17,
      kind: 'text',
      durationMinutes: 8,
      content: {
        kind: 'text',
        body: `
<h2>Stillingsvernet (AML kap. 15)</h2>
<p>Norsk arbeidsliv har et sterkt stillingsvern. Som leder er det avgjørende at du kjenner reglene FØR du iverksetter en oppsigelse — prosessfeil kan gjøre en gyldig oppsigelse ulovlig.</p>

<h3>Kravet om saklig grunn (§15-7)</h3>
<p>En oppsigelse er kun gyldig dersom den er <strong>saklig begrunnet</strong> i:</p>
<ul>
  <li>Virksomhetens forhold (nedbemanning, driftsinnskrenkning), eller</li>
  <li>Arbeidstakers forhold (utilfredsstillende arbeid, illojalitet, samarbeidsproblemer)</li>
</ul>

<h3>Prosedyrekravet — drøftingsmøte (§15-1)</h3>
<p>Før oppsigelse <em>besluttes</em> skal arbeidsgiver avholde et <strong>drøftingsmøte</strong> med arbeidstaker. Dette gjelder selv om utfallet virker åpenbart.</p>
<ul>
  <li>Kall inn skriftlig i god tid</li>
  <li>Arbeidstaker har rett til å ha med rådgiver/tillitsvalgt</li>
  <li>Dokumenter møtet med referat signert av begge parter</li>
</ul>

<h3>Særlig vern — tider og grupper</h3>
<table>
  <thead><tr><th>Situasjon</th><th>Vern</th></tr></thead>
  <tbody>
    <tr><td>Sykdom (§15-8)</td><td>Oppsigelsesvern de første 12 månedene av sykefraværet</td></tr>
    <tr><td>Graviditet (§15-9)</td><td>Ufravikelig oppsigelsesforbud under graviditet</td></tr>
    <tr><td>Foreldrepermisjon (§15-9)</td><td>Sterkt vern under og etter permisjon</td></tr>
    <tr><td>Militærtjeneste (§15-10)</td><td>Oppsigelsesvern under tjenesten</td></tr>
  </tbody>
</table>

<h3>Konsekvenser av ulovlig oppsigelse</h3>
<p>Domstolene kan kjenne oppsigelsen <strong>ugyldig og pålegge gjeninnsettelse</strong>, i tillegg til å tilkjenne arbeidstaker erstatning for lønnstap og ikke-økonomisk skade. Slike saker er svært kostbare for virksomheten — og kan skade omdømmet alvorlig.</p>
        `.trim(),
      },
    },

    // ── 19. Kunnsjekk 2 — Quiz: Sykefravær og oppsigelse ─────────────────

    {
      id: 'aml-m19',
      title: 'Kunnsjekk 2: Tilrettelegging og stillingsvern',
      order: 18,
      kind: 'quiz',
      durationMinutes: 8,
      content: {
        kind: 'quiz',
        questions: [
          {
            id: 'q401',
            question: 'Når skal oppfølgingsplanen for sykmeldte ansatte senest være utarbeidet?',
            options: ['Innen 1 uke', 'Innen 4 uker', 'Innen 3 måneder', 'Kun ved 100% sykmelding'],
            correctIndex: 1,
          },
          {
            id: 'q402',
            question: 'Kan en leder spørre en ansatt om diagnosen ved sykefraværsoppfølging?',
            options: [
              'Ja, alltid',
              'Ja, men kun ved fravær over 14 dager',
              'Nei — lederen har ikke rett til å kjenne diagnosen',
              'Ja, men kun med skriftlig samtykke',
            ],
            correctIndex: 2,
          },
          {
            id: 'q403',
            question: 'En gravid ansatt søker på en intern lederstilling. Hva er riktig?',
            options: [
              'Graviditeten kan vektlegges negativt',
              'Graviditeten er et diskrimineringsgrunnlag og kan ikke vektlegges',
              'Leder kan kreve at hun venter til etter permisjonen',
              'Graviditeten er bare relevant ved tunge jobber',
            ],
            correctIndex: 1,
          },
          {
            id: 'q404',
            question: 'Hva er et «drøftingsmøte» etter AML §15-1?',
            options: [
              'Et sosialt møte mellom leder og tillitsvalgt',
              'Et obligatorisk møte FØR oppsigelse besluttes, der partene diskuterer grunnlaget',
              'Et møte der oppsigelsen overleveres formelt',
              'Et møte med Arbeidstilsynet ved tvist',
            ],
            correctIndex: 1,
          },
          {
            id: 'q405',
            question: 'En ansatt sykmeldes fra dag 1 i oppsigelsestiden. Hva gjelder?',
            options: [
              'Oppsigelsestiden suspenderes automatisk',
              'Oppsigelsestiden løper normalt — sykdommen stopper den ikke',
              'Oppsigelsen er automatisk ugyldig',
              'Ansatt kan velge selv om oppsigelsestiden skal løpe',
            ],
            correctIndex: 1,
          },
          {
            id: 'q406',
            question: 'Hva er minimumsoppsigelsestid for en ansatt med 5 års ansiennitet (§15-3)?',
            options: ['2 uker', '1 måned', '2 måneder', '3 måneder'],
            correctIndex: 2,
          },
          {
            id: 'q407',
            question: 'Hvilken §15 gir særlig vern mot oppsigelse for ansatte under sykdom?',
            options: ['§15-6', '§15-7', '§15-8', '§15-10'],
            correctIndex: 2,
          },
        ],
      },
    },

    // ── 20. Oppsummering og huskeliste ────────────────────────────────────

    {
      id: 'aml-m20',
      title: 'Oppsummering og lederens huskeliste',
      order: 19,
      kind: 'other',
      durationMinutes: 5,
      content: {
        kind: 'other',
        title: 'Din AML-huskeliste som leder',
        body: `
<h2>Du har fullført kurset — her er det viktigste å ta med</h2>

<h3>🏛️ Juridisk ansvar</h3>
<ul>
  <li>Du kan ikke delegere bort det grunnleggende HMS-ansvaret (§2-1)</li>
  <li>Brudd på AML kan gi personlig straffeansvar (§19-1)</li>
  <li>Arbeidstilsynet kan rette tilsyn mot deg som leder</li>
</ul>

<h3>📋 Systematisk HMS</h3>
<ul>
  <li>Gjennomfør vernerunder etter plan — dokumenter funn og tiltak</li>
  <li>Hold ROS-vurderinger oppdatert, særlig ved endringer</li>
  <li>Involver verneombudet i alt HMS-arbeid</li>
  <li>Gjennomfør årsgjennomgang med skriftlig resultat</li>
</ul>

<h3>🤝 Verneombud og AMU</h3>
<ul>
  <li>Samarbeid aktivt — verneombudet er en ressurs, ikke en motstander</li>
  <li>Gi verneombudet tid, ressurser og informasjon de trenger</li>
  <li>Respekter stansingsretten — ikke overstyr uten lovhjemmel</li>
</ul>

<h3>🏥 Sykefravær</h3>
<ul>
  <li>Ta kontakt tidlig — ikke vent til formelle frister</li>
  <li>Oppfølgingsplan innen 4 uker, dialogmøte innen 7 uker</li>
  <li>Spør aldri om diagnose</li>
  <li>Tilrettelegg aktivt og dokumenter alt</li>
</ul>

<h3>⏰ Arbeidstid</h3>
<ul>
  <li>Max 9 timer per dag, 40 timer per uke som utgangspunkt</li>
  <li>11 timers daglig hvile er absolutt minimum</li>
  <li>Overtid krever saklig grunn og har klare grenser</li>
</ul>

<h3>⚖️ Oppsigelse</h3>
<ul>
  <li>Alltid drøftingsmøte FØR beslutning (§15-1)</li>
  <li>Saklig grunn er absolutt krav (§15-7)</li>
  <li>Spesielle verneperioder for gravide, syke og permitterte</li>
</ul>

<blockquote style="border-left:4px solid #1a3d32;padding:1rem 1.25rem;background:#f0f9f5;margin:1.5rem 0;border-radius:0.5rem">
  <strong>Gratulerer! 🎓</strong><br>
  Du har gjennomgått et komplett kurs i Arbeidsmiljøloven for ledere. Husk at loven oppdateres — sjekk lovdata.no jevnlig og delta på oppfriskningskurs. Dette kurset erstatter ikke juridisk rådgivning.
</blockquote>
        `.trim(),
      },
    },

    // ── 21. Avsluttende test — stor quiz ─────────────────────────────────

    {
      id: 'aml-m21',
      title: 'Avsluttende kompetansetest — AML for ledere',
      order: 20,
      kind: 'quiz',
      durationMinutes: 20,
      content: {
        kind: 'quiz',
        questions: [
          {
            id: 'final01',
            question: 'Hva er formålet med Arbeidsmiljøloven (§1-1)?',
            options: [
              'Maksimere produktivitet i norsk næringsliv',
              'Sikre helsefremmende arbeidsmiljø og trygghet mot skadevirkninger',
              'Regulere lønnsnivå og tariffavtaler',
              'Beskytte virksomheter mot ulovlig konkurranse',
            ],
            correctIndex: 1,
          },
          {
            id: 'final02',
            question: 'Hvem kan etter AML ha personlig straffeansvar for HMS-brudd?',
            options: [
              'Kun daglig leder / administrerende direktør',
              'Kun verneombudet',
              'Arbeidsgiver og ledere som forsettlig eller uaktsomt bryter loven',
              'Ingen — kun virksomheten som juridisk enhet',
            ],
            correctIndex: 2,
          },
          {
            id: 'final03',
            question: 'Hva krever AML §3-1 at systematisk HMS-arbeid skal gjøres I SAMARBEID med?',
            options: [
              'Arbeidstilsynet og lokale myndigheter',
              'Arbeidstakerne og deres tillitsvalgte',
              'Styret og revisor',
              'NAV og bedriftshelsetjenesten',
            ],
            correctIndex: 1,
          },
          {
            id: 'final04',
            question: 'Hva er «restrisiko» i en ROS-vurdering?',
            options: [
              'Risiko som aldri kan elimineres',
              'Risikoen som gjenstår etter at tiltak er iverksatt',
              'Risiko som ikke er vurdert ennå',
              'Risiko knyttet til restpartier kjemikalier',
            ],
            correctIndex: 1,
          },
          {
            id: 'final05',
            question: 'Hva kan en leder IKKE gjøre mot en ansatt som bruker sin stansingsrett (§6-3)?',
            options: [
              'Be om begrunnelse for stansen',
              'Varsle overordnet leder',
              'Kontakte Arbeidstilsynet',
              'Si opp den ansatte fordi de brukte stansingsretten',
            ],
            correctIndex: 3,
          },
          {
            id: 'final06',
            question: 'Innen hvilken frist MÅ oppfølgingsplan for sykmeldt ansatt være utarbeidet?',
            options: ['2 uker', '4 uker', '8 uker', '3 måneder'],
            correctIndex: 1,
          },
          {
            id: 'final07',
            question: 'En leder nekter en ansatt å bruke fleksitid uten begrunnelse. Hvilken rettighet er potensielt brutt?',
            options: [
              'AML §4-3 (psykososialt arbeidsmiljø)',
              'Tariffavtalens bestemmelser om fleksitid',
              'AML §2-1 (arbeidsgivers ansvar)',
              'AML §15-7 (oppsigelse)',
            ],
            correctIndex: 1,
          },
          {
            id: 'final08',
            question: 'Hva er minimumslengde på daglig hvile mellom to arbeidsøkter (§10-8)?',
            options: ['8 timer', '9 timer', '11 timer', '12 timer'],
            correctIndex: 2,
          },
          {
            id: 'final09',
            question: 'Kan en arbeidsgiver inngå individuell avtale med en ansatt om å fravike overtidsgrensene i §10-6?',
            options: [
              'Ja, skriftlig avtale mellom partene er alltid tilstrekkelig',
              'Nei — overtidsgrensene kan kun fravikes gjennom tariffavtale',
              'Ja, men bare for ledere og nøkkelpersonell',
              'Nei — overtidsgrensene er absolutte og kan aldri fravikes',
            ],
            correctIndex: 1,
          },
          {
            id: 'final10',
            question: 'Hva er hovedregelen om bevisbyrd i diskrimineringssaker (§13-8)?',
            options: [
              'Arbeidstaker bærer fullt bevisbyrde',
              'Bevisbyrden er delt likt mellom partene',
              'Dersom arbeidstaker sannsynliggjør diskriminering, går bevisbyrden over på arbeidsgiver',
              'Arbeidsgiver har alltid bevisbyrden i alle arbeidssaker',
            ],
            correctIndex: 2,
          },
          {
            id: 'final11',
            question: 'En virksomhet med 50 ansatte har ikke hatt AMU-møte på 8 måneder. Hva er problemet?',
            options: [
              'Ingenting — AMU-møte er ikke lovpålagt',
              'Brudd på §7-2 — AMU skal møtes minst 4 ganger per år',
              'Kun et problem dersom verneombudet klager',
              'AMU trenger bare møte dersom det er HMS-saker til behandling',
            ],
            correctIndex: 1,
          },
          {
            id: 'final12',
            question: 'Hva skjer med oppsigelsestiden ved sykmelding ETTER at oppsigelse er gitt (§15-8)?',
            options: [
              'Oppsigelsestiden suspenderes automatisk under sykdom',
              'Oppsigelsestiden løper normalt — sykdom stopper den ikke',
              'Ansatt kan velge om oppsigelsestiden skal suspenderes',
              'Oppsigelsen er ugyldig dersom ansatt sykmeldes innen 3 dager',
            ],
            correctIndex: 1,
          },
          {
            id: 'final13',
            question: 'Hva er et «drøftingsmøte» etter §15-1, og NÅR skal det holdes?',
            options: [
              'Et møte etter at oppsigelsen er gitt, for å gi ansatt mulighet til å svare',
              'Et obligatorisk møte FØR beslutning om oppsigelse tas',
              'Et møte med Arbeidstilsynet ved tvist om oppsigelse',
              'Et møte mellom tillitsvalgte og arbeidsgiver om tariffspørsmål',
            ],
            correctIndex: 1,
          },
          {
            id: 'final14',
            question: 'Internkontrollforskriften §5 krever at HMS-arbeidet:',
            options: [
              'Kun dokumenteres muntlig i møtereferater',
              'Dokumenteres skriftlig i en HMS-håndbok eller digitalt system',
              'Dokumenteres kun dersom Arbeidstilsynet krever det',
              'Dokumenteres hvert tredje år i en årsrapport',
            ],
            correctIndex: 1,
          },
          {
            id: 'final15',
            question: 'Hva er den VIKTIGSTE lærdommen fra dette kurset?',
            options: [
              'HMS er HR-avdelingens ansvar, ikke lederens',
              'AML-brudd har kun sivilrettslige konsekvenser',
              'Som leder er du en juridisk ansvarlig aktør med personlig straffeansvar',
              'Verneombudet er ansvarlig for all HMS-dokumentasjon',
            ],
            correctIndex: 2,
          },
        ],
      },
    },
  ],
}
