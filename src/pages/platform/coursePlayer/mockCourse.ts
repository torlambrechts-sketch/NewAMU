// Shared mock course used by the three course-player design previews. A small
// HMS-flavoured micro-course (text → quiz → reflection) gives every layout the
// same three module kinds to render so they can be compared head-to-head.

export type MockQuizQuestion = {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type MockReflectionPrompt = {
  id: string
  prompt: string
  placeholder: string
}

export type MockModule =
  | {
      id: string
      kind: 'text'
      title: string
      eyebrow: string
      durationMinutes: number
      lawRefs: string[]
      lead: string
      body: string[]
      keyTakeaways: string[]
      learningOutcomes: string[]
      coachIntro: string
      coachFact: { title: string; body: string }
    }
  | {
      id: string
      kind: 'quiz'
      title: string
      eyebrow: string
      durationMinutes: number
      lawRefs: string[]
      intro: string
      questions: MockQuizQuestion[]
      learningOutcomes: string[]
      coachIntro: string
      coachFact: { title: string; body: string }
    }
  | {
      id: string
      kind: 'reflection'
      title: string
      eyebrow: string
      durationMinutes: number
      lawRefs: string[]
      intro: string
      prompts: MockReflectionPrompt[]
      learningOutcomes: string[]
      coachIntro: string
      coachFact: { title: string; body: string }
    }

export type MockCourse = {
  id: string
  title: string
  subtitle: string
  audience: string
  totalMinutes: number
  modules: MockModule[]
}

export const MOCK_COURSE: MockCourse = {
  id: 'demo-internkontroll-1',
  title: 'Internkontroll i praksis',
  subtitle: 'En 12-minutters mikrolæring for HMS-ansvarlige',
  audience: 'For ledere, verneombud og HMS-ansvarlige',
  totalMinutes: 12,
  modules: [
    {
      id: 'm1-systematisk-hms',
      kind: 'text',
      title: 'Hva systematisk HMS-arbeid egentlig betyr',
      eyebrow: 'Modul 1 · Grunnlag',
      durationMinutes: 4,
      lawRefs: ['AML § 3-1', 'IK-f § 5'],
      lead:
        'Internkontroll handler ikke om perm-systemer eller signaturer på papir. Det handler om at virksomheten faktisk styrer egen risiko – og kan vise hvordan.',
      body: [
        'Arbeidsmiljøloven § 3-1 stiller krav om at arbeidsgiver skal sørge for systematisk helse-, miljø- og sikkerhetsarbeid. «Systematisk» er nøkkelordet: det er gjentakelsen, ikke dokumentet, som gir vern.',
        'Internkontrollforskriften § 5 lister syv konkrete krav. De som oftest svikter ved tilsyn er punkt 6 (risikovurdering) og punkt 7 (rutiner for å avdekke, rette opp og forebygge overtredelser).',
        'Tenk på det som en vanlig styringssløyfe: planlegg, gjør, sjekk, juster. Forskjellen i HMS er at sløyfen må være sporbar – tilsynet skal kunne lese hva dere har gjort, hvorfor, og hva dere skal gjøre videre.',
      ],
      keyTakeaways: [
        'Systematisk = gjentatt og sporbar, ikke nødvendigvis digitalt',
        'Pålegg-grunner ved tilsyn handler oftest om manglende risikovurdering',
        'Styringssløyfen plan-gjør-sjekk-juster må kunne dokumenteres',
      ],
      learningOutcomes: [
        'Forklare hva «systematisk HMS-arbeid» innebærer',
        'Peke på de to vanligste pålegg-grunnene fra Arbeidstilsynet',
        'Beskrive styringssløyfen i egne ord',
      ],
      coachIntro:
        'Hei, jeg er Anne – HMS-rådgiver. La oss starte enkelt: glem skjemaene en stund og tenk på rutinene dine.',
      coachFact: {
        title: 'Visste du?',
        body: '4 av 10 pålegg fra Arbeidstilsynet i 2024 gjaldt manglende eller mangelfull risikovurdering. Det er den enkleste seieren å hente hjem.',
      },
    },
    {
      id: 'm2-pålegg-quiz',
      kind: 'quiz',
      title: 'Hvor ligger ansvaret?',
      eyebrow: 'Modul 2 · Sjekk forståelsen',
      durationMinutes: 3,
      lawRefs: ['AML § 2-1', 'AML § 2-3'],
      intro:
        'Tre raske spørsmål. Du må ha minst 2 riktige for å gå videre. Du kan prøve på nytt så mange ganger du vil.',
      questions: [
        {
          id: 'q1',
          question: 'Hvem har det overordnede ansvaret for at internkontrollen fungerer?',
          options: [
            'Verneombudet',
            'Arbeidsgiver',
            'HMS-rådgiver eller bedriftshelsetjeneste',
            'Den enkelte ansatte',
          ],
          correctIndex: 1,
          explanation:
            'Arbeidsmiljøloven § 2-1 plasserer ansvaret entydig hos arbeidsgiver. Verneombud og BHT bidrar, men kan aldri overta ansvaret.',
        },
        {
          id: 'q2',
          question: 'Hva er den ansattes hovedplikt etter § 2-3?',
          options: [
            'Å gjennomføre risikovurderinger',
            'Å rapportere avvik og medvirke i HMS-arbeidet',
            'Å oppdatere HMS-håndboka',
            'Å delta i vernerunder hver måned',
          ],
          correctIndex: 1,
          explanation:
            '§ 2-3 krever at arbeidstaker medvirker, melder fra om feil/mangler og bruker påbudt verneutstyr. Det er ikke ansvar for å lage rutinene.',
        },
        {
          id: 'q3',
          question: 'Når må risikovurderingen oppdateres?',
          options: [
            'Én gang i året, uavhengig av endringer',
            'Når Arbeidstilsynet ber om det',
            'Ved endringer som påvirker risikoen, og minst ved jevne mellomrom',
            'Bare ved alvorlige hendelser',
          ],
          correctIndex: 2,
          explanation:
            'Internkontrollforskriften krever at risikovurderingen er oppdatert. Endringer i arbeid, utstyr eller bemanning utløser ny vurdering.',
        },
      ],
      learningOutcomes: [
        'Identifisere ansvarsfordelingen mellom arbeidsgiver og arbeidstaker',
        'Vite når risikovurderingen må oppdateres',
      ],
      coachIntro:
        'Tre raske kontrollspørsmål. Hopp tilbake i forrige modul hvis du trenger – det er ingen klokke som tikker.',
      coachFact: {
        title: 'Tips fra Anne',
        body: 'Hvis du nøler på spørsmål 2, husk regelen: «medvirke, melde, bruke». Det er alt § 2-3 krever av den ansatte.',
      },
    },
    {
      id: 'm3-refleksjon',
      kind: 'reflection',
      title: 'Bruk det på din egen avdeling',
      eyebrow: 'Modul 3 · I praksis',
      durationMinutes: 5,
      lawRefs: ['AML § 4-3', 'IK-f § 5 nr. 6'],
      intro:
        'Skriv kort. Det du skriver lagres bare på din egen profil og blir en del av kompetansebeviset.',
      prompts: [
        {
          id: 'p1',
          prompt:
            'Hvilken risiko i din avdeling er minst godt dekket av dagens rutiner?',
          placeholder: 'F.eks. håndtering av aggressive kunder ved skranken …',
        },
        {
          id: 'p2',
          prompt:
            'Hva er det enkleste tiltaket dere kan sette i verk innen 14 dager?',
          placeholder: 'F.eks. innføre to-personers regel etter kl. 20 …',
        },
      ],
      learningOutcomes: [
        'Knytte teorien til konkret risiko i egen avdeling',
        'Forplikte seg til ett tiltak med tidsfrist',
      ],
      coachIntro:
        'Siste etappe – og den viktigste. Det vi skriver her er det du faktisk husker om en måned.',
      coachFact: {
        title: 'Anne minner om',
        body: 'Et tiltak du forplikter deg til skriftlig blir gjennomført 3× oftere enn et du bare tenker på. Skriv kort, men skriv det.',
      },
    },
  ],
}

export function totalModuleCount(course: MockCourse): number {
  return course.modules.length
}

export function moduleTimeLabel(minutes: number): string {
  return `${minutes} min`
}
