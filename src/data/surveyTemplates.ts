/**
 * Pre-built survey templates based on validated, widely-used instruments.
 *
 * NOTE: These are faithful representations of the published instruments for
 * professional/organizational use. Organizations should verify licensing
 * requirements for commercial deployment. Academic/non-commercial use is
 * generally permitted under the instruments' original terms.
 */

export type TemplateQuestionType =
  | 'likert_5'   // 1 (Strongly disagree) – 5 (Strongly agree)
  | 'likert_7'   // 1 (Never) – 7 (Always/Every day) — used by UWES
  | 'scale_10'   // 0–10 scale (eNPS)
  | 'yes_no'     // Binary yes/no
  | 'text'       // Free-text open question

export type MandatoryLawCode = 'AML_4_3' | 'AML_4_4' | 'AML_6_2'

export type TemplateQuestion = {
  id: string
  text: string
  type: TemplateQuestionType
  required: boolean
  /** Lovkrav fra mal — erstatter tekstanalyse ved import */
  is_mandatory?: boolean
  mandatory_law?: MandatoryLawCode
  /** Optional subscale grouping label */
  subscale?: string
  /** Scale anchor labels */
  anchors?: { low: string; high: string }
}

export type SurveyTemplate = {
  id: string
  name: string
  shortName: string
  description: string
  /** Research basis / source */
  source: string
  /** Typical use case */
  useCase: string
  /** Approximate completion time in minutes */
  estimatedMinutes: number
  /** Whether the instrument recommends anonymity */
  recommendAnonymous: boolean
  questions: TemplateQuestion[]
  /** Scoring guidance shown to admins */
  scoringNote: string
  /** Category for grouping in UI */
  category: 'wellbeing' | 'engagement' | 'safety' | 'performance' | 'custom'
}

// ─── UWES-9 (Utrecht Work Engagement Scale — short version) ──────────────────
// Schaufeli, Bakker & Salanova (2006). The measurement of work engagement
// with a short questionnaire. Educational and Psychological Measurement, 66(4).

export const TEMPLATE_UWES: SurveyTemplate = {
  id: 'tpl-uwes',
  name: 'Utrecht Work Engagement Scale (UWES-9)',
  shortName: 'UWES-9',
  description: 'Måler arbeidsengasjement langs tre dimensjoner: Vigor (vitalitet), Dedication (dedikasjon) og Absorption (fordypning). Validert i mer enn 30 land.',
  source: 'Schaufeli, Bakker & Salanova (2006)',
  useCase: 'Kartlegge medarbeidernes arbeidsengasjement og oppdage burnout-risiko.',
  estimatedMinutes: 5,
  recommendAnonymous: true,
  category: 'wellbeing',
  scoringNote: 'Beregn gjennomsnitt per subscale (Vigor: Q1,Q2,Q3 · Dedication: Q4,Q5,Q6 · Absorption: Q7,Q8,Q9). Totalscore = snitt alle 9. Skala 0–6 (0=Aldri, 6=Alltid). Benchmark: >4.0 = høyt engasjement.',
  questions: [
    { id: 'uwes1', text: 'Jeg føler meg sprudlende av energi på jobb.', type: 'likert_7', required: true, subscale: 'Vigor', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes2', text: 'Jeg er sterk og energisk på jobb.', type: 'likert_7', required: true, subscale: 'Vigor', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes3', text: 'Når jeg er på jobb, orker jeg å jobbe i lange perioder.', type: 'likert_7', required: true, subscale: 'Vigor', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes4', text: 'Jeg synes jobben min er full av mening og hensikt.', type: 'likert_7', required: true, subscale: 'Dedication', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes5', text: 'Jeg er begeistret over jobben min.', type: 'likert_7', required: true, subscale: 'Dedication', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes6', text: 'Jobben min er inspirerende for meg.', type: 'likert_7', required: true, subscale: 'Dedication', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes7', text: 'Når jeg jobber intenst, føler jeg lykke.', type: 'likert_7', required: true, subscale: 'Absorption', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes8', text: 'Jeg er fordypet i jobben min.', type: 'likert_7', required: true, subscale: 'Absorption', anchors: { low: 'Aldri', high: 'Alltid' } },
    { id: 'uwes9', text: 'Jeg kommer i en slags "flyt" når jeg jobber.', type: 'likert_7', required: true, subscale: 'Absorption', anchors: { low: 'Aldri', high: 'Alltid' } },
  ],
}

// ─── Google re:Work — Team Effectiveness (Project Aristotle) ─────────────────
// Based on the five factors identified in Google's Project Aristotle (2016).
// Reference: rework.withgoogle.com/guides/understanding-team-effectiveness

export const TEMPLATE_GOOGLE_REWORK: SurveyTemplate = {
  id: 'tpl-google-rework',
  name: 'Google re:Work — Teameffektivitet',
  shortName: 're:Work',
  description: 'Basert på Google Project Aristotle-studien. Måler de fem faktorene som forutsier høytytende team: Psykologisk trygghet, Pålitelighet, Struktur & klarhet, Mening og Effekt.',
  source: 'Google re:Work / Project Aristotle (2016)',
  useCase: 'Evaluere teamdynamikk og identifisere hvilken av de fem Aristotle-faktorene som trenger styrking.',
  estimatedMinutes: 7,
  recommendAnonymous: true,
  category: 'performance',
  scoringNote: 'Beregn snitt per faktor (skala 1–5). Faktorgrenser: Psykologisk trygghet: Q1–Q3 · Pålitelighet: Q4–Q5 · Struktur & klarhet: Q6–Q7 · Mening: Q8–Q9 · Effekt: Q10–Q11. Benchmark: 3.5+ per faktor = sunt team.',
  questions: [
    // Psychological Safety
    { id: 'rw1', text: 'Hvis jeg gjør en feil i dette teamet, brukes det ikke mot meg.', type: 'likert_5', required: true, subscale: 'Psykologisk trygghet', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'rw2', text: 'Teammedlemmene er i stand til å ta opp vanskelige problemer og utfordringer.', type: 'likert_5', required: true, subscale: 'Psykologisk trygghet', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'rw3', text: 'Ingen i teamet ville handle på en måte som bevisst undergraver innsatsen min.', type: 'likert_5', required: true, subscale: 'Psykologisk trygghet', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    // Dependability
    { id: 'rw4', text: 'Teammedlemmene leverer på det de lover.', type: 'likert_5', required: true, subscale: 'Pålitelighet', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'rw5', text: 'Jeg kan stole på at teammedlemmene gjør god kvalitet i arbeidet.', type: 'likert_5', required: true, subscale: 'Pålitelighet', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    // Structure & Clarity
    { id: 'rw6', text: 'Teamet har tydelige mål, roller og planer.', type: 'likert_5', required: true, subscale: 'Struktur & klarhet', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'rw7', text: 'Prosessene for beslutningstaking i teamet er effektive.', type: 'likert_5', required: true, subscale: 'Struktur & klarhet', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    // Meaning
    { id: 'rw8', text: 'Arbeidet jeg gjør i dette teamet er meningsfullt for meg.', type: 'likert_5', required: true, subscale: 'Mening', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'rw9', text: 'Å jobbe i dette teamet gir meg mulighet til å bruke mine styrker.', type: 'likert_5', required: true, subscale: 'Mening', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    // Impact
    { id: 'rw10', text: 'Jeg tror teamets arbeid har en positiv effekt på organisasjonen.', type: 'likert_5', required: true, subscale: 'Effekt', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'rw11', text: 'Teamets arbeid bidrar positivt til organisasjonens mål og verdier.', type: 'likert_5', required: true, subscale: 'Effekt', anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    // Open
    { id: 'rw12', text: 'Hva kan teamet gjøre annerledes for å fungere enda bedre?', type: 'text', required: false },
  ],
}

// ─── eNPS (Employee Net Promoter Score) ──────────────────────────────────────
// Adapted from F. Reichheld (2003) NPS concept for employee context.

export const TEMPLATE_ENPS: SurveyTemplate = {
  id: 'tpl-enps',
  name: 'Employee Net Promoter Score (eNPS)',
  shortName: 'eNPS',
  description: 'To kjernesporsmål som måler lojalitet og anbefaling som arbeidsgiver. Rask å svare på (under 2 min). Beregn eNPS = % Promoters (9–10) minus % Detractors (0–6).',
  source: 'F. Reichheld (2003) / Adapted for employee experience',
  useCase: 'Rask pulsundersøkelse for å fange medarbeidernes lojalitet og anbefalingsvillighet. Egnet for månedlig/kvartalsvis kjøring.',
  estimatedMinutes: 2,
  recommendAnonymous: true,
  category: 'engagement',
  scoringNote: 'eNPS = (Antall Promoters ÷ totalt) × 100 − (Antall Detractors ÷ totalt) × 100. Promoters: 9–10 · Passives: 7–8 · Detractors: 0–6. Score −100 til +100. Bransjenorm: +10 regnes som godt, +50 er fremragende.',
  questions: [
    { id: 'enps1', text: 'Hvor sannsynlig er det at du vil anbefale [organisasjon] som arbeidsplass til en venn eller kollega? (0 = Svært usannsynlig, 10 = Svært sannsynlig)', type: 'scale_10', required: true, anchors: { low: 'Svært usannsynlig (0)', high: 'Svært sannsynlig (10)' } },
    { id: 'enps2', text: 'Hva er den viktigste grunnen til scoren din?', type: 'text', required: false },
    { id: 'enps3', text: 'Hva er det én ting organisasjonen kan gjøre bedre for deg som ansatt?', type: 'text', required: false },
  ],
}

// ─── Edmondson Psychological Safety Survey (7-question) ──────────────────────
// Amy C. Edmondson (1999). "Psychological Safety and Learning Behavior in Work Teams".
// Administrative Science Quarterly, 44(2).

export const TEMPLATE_EDMONDSON: SurveyTemplate = {
  id: 'tpl-edmondson',
  name: 'Psykologisk trygghet — Edmondson 7-spørsmål',
  shortName: 'Edmondson PS',
  description: 'Amy Edmondsons originale 7-spørs­mål for psykologisk trygghet i team. Mye brukt i forskning og organisasjonsutvikling globalt. Grunnlaget for Google Aristotle-studien.',
  source: 'Edmondson, A.C. (1999). Administrative Science Quarterly, 44(2), 350–383.',
  useCase: 'Kartlegge om teammedlemmer føler seg trygge nok til å ta mellommenneskelig risiko — ytre meninger, innrømme feil, stille «dumme» spørsmål.',
  estimatedMinutes: 4,
  recommendAnonymous: true,
  category: 'safety',
  scoringNote: 'Reverser Q4 og Q7 (6 − score). Beregn snitt av alle 7. Skala 1–5. Benchmark: <3.0 = lav trygghet · 3.0–3.8 = moderat · >3.8 = høy trygghet. Legg til fritekst for kvalitative funn.',
  questions: [
    { id: 'ed1', text: 'Hvis du gjør en feil i dette teamet, holdes det ofte mot deg.', type: 'likert_5', required: true, anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'ed2', text: 'Teammedlemmene er i stand til å ta opp vanskelige problemer og utfordringer.', type: 'likert_5', required: true, anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'ed3', text: 'Folk i dette teamet avviser noen ganger andre fordi de er annerledes.', type: 'likert_5', required: true, anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'ed4', text: 'Det er trygt å ta en risiko i dette teamet.', type: 'likert_5', required: true, anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'ed5', text: 'Det er vanskelig å be andre i dette teamet om hjelp.', type: 'likert_5', required: true, anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'ed6', text: 'Ingen i teamet ville bevisst handle på en måte som undergraver innsatsen min.', type: 'likert_5', required: true, anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'ed7', text: 'Mine unike ferdigheter og talenter verdsettes og brukes i dette teamet.', type: 'likert_5', required: true, anchors: { low: 'Helt uenig', high: 'Helt enig' } },
    { id: 'ed8', text: 'Hva er ett konkret tiltak som ville økt den psykologiske tryggheten i teamet ditt?', type: 'text', required: false },
  ],
}

// ─── HMS-klimamåling (custom Norwegian HSE climate) ──────────────────────────

export const TEMPLATE_HMS_CLIMATE: SurveyTemplate = {
  id: 'tpl-hms-climate',
  name: 'HMS-klimamåling (norsk tilpasset)',
  shortName: 'HMS-klima',
  description: 'Norsk tilpasset undersøkelse av sikkerhetsklima etter Internkontrollforskriften og AML §4-3. Kartlegger om HMS-kulturen er reell og ikke bare formell.',
  source: 'Tilpasset IK-forskriften og AML §4-3 / Arbeidstilsynets veiledninger',
  useCase: 'Årlig HMS-klimamåling som del av systematisk HMS-arbeid (IK-f §5 nr. 5).',
  estimatedMinutes: 6,
  recommendAnonymous: true,
  category: 'safety',
  scoringNote: 'Skala 1–5. Gjennomsnitt under 3.5 på enkeltspørsmål bør prioriteres i handlingsplan. Resultater dokumenteres som del av årsgjennomgang (IK-f §5 nr. 5).',
  questions: [
    {
      id: 'hc1',
      text: 'Ledelsen tar HMS-arbeid på alvor og prioriterer det aktivt.',
      type: 'likert_5',
      required: true,
      mandatory_law: 'AML_4_3',
      subscale: 'Ledelsesforpliktelse',
      anchors: { low: 'Svært uenig', high: 'Svært enig' },
    },
    {
      id: 'hc2',
      text: 'Jeg vet hvem jeg skal kontakte hvis jeg observerer en sikkerhetsrisiko.',
      type: 'likert_5',
      required: true,
      mandatory_law: 'AML_4_3',
      subscale: 'Systemer og rutiner',
      anchors: { low: 'Svært uenig', high: 'Svært enig' },
    },
    {
      id: 'hc3',
      text: 'Avvik og nestenulykker meldes alltid uten frykt for konsekvenser.',
      type: 'likert_5',
      required: true,
      mandatory_law: 'AML_4_3',
      subscale: 'Avvikskultur',
      anchors: { low: 'Svært uenig', high: 'Svært enig' },
    },
    {
      id: 'hc4',
      text: 'Jeg har fått nødvendig HMS-opplæring for arbeidet jeg gjør.',
      type: 'likert_5',
      required: true,
      mandatory_law: 'AML_4_3',
      subscale: 'Opplæring',
      anchors: { low: 'Svært uenig', high: 'Svært enig' },
    },
    {
      id: 'hc5',
      text: 'Verneombudet er synlig og lett tilgjengelig.',
      type: 'likert_5',
      required: true,
      mandatory_law: 'AML_4_3',
      subscale: 'Verneorganisasjon',
      anchors: { low: 'Svært uenig', high: 'Svært enig' },
    },
    {
      id: 'hc6',
      text: 'Arbeidsmengden og tidspress skaper ikke uakseptable risikoer.',
      type: 'likert_5',
      required: true,
      mandatory_law: 'AML_4_3',
      subscale: 'Psykososialt',
      anchors: { low: 'Svært uenig', high: 'Svært enig' },
    },
    {
      id: 'hc7',
      text: 'Utstyr og arbeidsplassen er i orden og trygg å bruke.',
      type: 'likert_5',
      required: true,
      mandatory_law: 'AML_4_3',
      subscale: 'Fysisk arbeidsmiljø',
      anchors: { low: 'Svært uenig', high: 'Svært enig' },
    },
    { id: 'hc8', text: 'Hva er det viktigste vi kan forbedre for å styrke HMS-kulturen?', type: 'text', required: false },
  ],
}

// ─── All templates ────────────────────────────────────────────────────────────

export const ALL_SURVEY_TEMPLATES: SurveyTemplate[] = [
  TEMPLATE_UWES,
  TEMPLATE_GOOGLE_REWORK,
  TEMPLATE_ENPS,
  TEMPLATE_EDMONDSON,
  TEMPLATE_HMS_CLIMATE,
]

export const TEMPLATE_CATEGORIES: { id: SurveyTemplate['category']; label: string; description: string }[] = [
  { id: 'wellbeing',   label: 'Trivsel og velvære',        description: 'Burnout, arbeidsengasjement, stressnivå' },
  { id: 'engagement',  label: 'Engasjement og lojalitet',  description: 'eNPS, medarbeiderlojalitet, anbefaling' },
  { id: 'safety',      label: 'Psykologisk trygghet / HMS', description: 'Sikkerhetsklima, trygghet for å ytre seg' },
  { id: 'performance', label: 'Team og ytelse',            description: 'Teameffektivitet, samarbeid, klarhet' },
  { id: 'custom',      label: 'Egendefinert',              description: 'Bygg dine egne spørsmål fra bunnen av' },
]
