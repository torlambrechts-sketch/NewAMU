/**
 * Generates supabase/migrations/20260802120001_survey_template_catalog_seed.sql
 * from src/data/surveyTemplates.ts + inline vendor/specialty stubs.
 * Run: node scripts/build-survey-catalog-seed.mjs
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outMigration = join(root, 'supabase/migrations/20260802120001_survey_template_catalog_seed.sql')

const entry = join(root, 'src/data/surveyTemplates.ts')
const tmp = join('/tmp', 'surveyTemplatesBundle.mjs')

execFileSync('npx', ['esbuild', entry, '--bundle', '--format=esm', '--platform=neutral', `--outfile=${tmp}`], {
  cwd: root,
  stdio: 'inherit',
})

const { ALL_SURVEY_TEMPLATES } = await import(`file://${tmp}`)

function toBody(questions) {
  return {
    version: 1,
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      required: q.required,
      subscale: q.subscale,
      anchors: q.anchors,
    })),
  }
}

const fromFile = ALL_SURVEY_TEMPLATES.map((t) => ({
  id: t.id,
  organization_id: null,
  is_system: true,
  name: t.name,
  short_name: t.shortName,
  description: t.description,
  source: t.source,
  use_case: t.useCase,
  category: t.category,
  audience: t.id.startsWith('tpl-') && t.category === 'custom' ? 'internal' : 'internal',
  estimated_minutes: t.estimatedMinutes,
  recommend_anonymous: t.recommendAnonymous,
  scoring_note: t.scoringNote,
  law_ref: t.category === 'safety' || t.category === 'wellbeing' ? 'AML § 4-3' : null,
  body: toBody(t.questions),
}))

const EXTRAS = [
  {
    id: 'tpl-qps-nordic',
    name: 'QPS Nordic 34+',
    short_name: 'QPS',
    description: 'Validert spørreskjema for psykososialt arbeidsmiljø. Dekker jobbkrav, kontroll, klima, ledelse.',
    source: 'Nordic',
    use_case: 'Hovedmåling (anbefalt hvert annet år).',
    category: 'wellbeing',
    audience: 'internal',
    estimated_minutes: 7,
    recommend_anonymous: true,
    scoring_note: 'Bruk fasit/normdata for QPS Nordic. Sammenlign delskalaer mot bransje.',
    law_ref: 'AML § 4-3',
    body: toBody(
      Array.from({ length: 5 }, (_, i) => ({
        id: `qps${i + 1}`,
        text: `Eksempel spørsmål ${i + 1} (full katalog i produksjon). Erstatt med importert spørsmålssett ved behov.`,
        type: 'likert_5',
        required: true,
        subscale: 'Generelt',
        anchors: { low: 'Svært uenig', high: 'Svært enig' },
      })),
    ),
  },
  {
    id: 'tpl-ark',
    name: 'ARK Arbeidsmiljø',
    short_name: 'ARK',
    description: 'Bredt validert instrument for norsk arbeidsliv. Også eNPS-linje og fysisk/organisatorisk miljø.',
    source: 'NTNU',
    use_case: 'Hovedmåling for større virksomheter.',
    category: 'safety',
    audience: 'internal',
    estimated_minutes: 12,
    recommend_anonymous: true,
    scoring_note: 'Følg ARK-veiledning for terskler og rapportering.',
    law_ref: 'AML § 4-3',
    body: toBody(
      Array.from({ length: 4 }, (_, i) => ({
        id: `ark${i + 1}`,
        text: `ARK — eksempelspørsmål ${i + 1} (erstatt med full ARK-pakke ved lisens).`,
        type: 'likert_5',
        required: true,
        anchors: { low: 'Svært uenig', high: 'Svært enig' },
      })),
    ),
  },
  {
    id: 'tpl-pulse',
    name: 'Pulsmåling 4 spm.',
    short_name: 'Puls',
    description: 'Kort puls mellom hovedmålinger — fanger endringer raskt.',
    source: 'Klarert',
    use_case: 'Kvartalsvis.',
    category: 'engagement',
    audience: 'internal',
    estimated_minutes: 1,
    recommend_anonymous: true,
    scoring_note: 'Sammenlign mot siste hovedmåling.',
    law_ref: null,
    body: toBody(
      [
        { id: 'p1', text: 'Hvordan vurderer du arbeidsmiljøet ditt akkurat nå?', type: 'likert_5', required: true },
        { id: 'p2', text: 'Føler du at du har tilstrekkelig støtte fra nærmeste leder?', type: 'likert_5', required: true },
        { id: 'p3', text: 'Hvor sannsynlig er det at du anbefaler oss som arbeidsplass? (0–10)', type: 'scale_10', required: true },
        { id: 'p4', text: 'Kort kommentar (valgfritt).', type: 'text', required: false },
      ],
    ),
  },
  {
    id: 'tpl-mobbing',
    name: 'Mobbing & trakassering (fordypning)',
    short_name: 'Mobbing',
    description: 'Brukes når hovedmålingen viser røde flagg. Krever sterk anonymitet.',
    source: 'Klarert',
    use_case: 'Oppfølging etter varsler.',
    category: 'safety',
    audience: 'internal',
    estimated_minutes: 6,
    recommend_anonymous: true,
    scoring_note: 'Kun aggregert rapportering. Svar under terskel skjules.',
    law_ref: 'AML § 4-3 (3)',
    body: toBody(
      [
        { id: 'mb1', text: 'Har du i løpet av siste 12 mnd. vært utsatt for uønsket atferd som har vart over tid?', type: 'yes_no', required: true },
        { id: 'mb2', text: 'Beskriv kort (valgfritt) — svar behandles konfidensielt.', type: 'text', required: false },
        { id: 'mb3', text: 'Hvordan opplever du muligheten til å si ifra?', type: 'likert_5', required: true },
      ],
    ),
  },
  {
    id: 'tpl-exit',
    name: 'Sluttundersøkelse',
    short_name: 'Exit',
    description: 'Til medarbeidere som slutter — forstå frafall.',
    source: 'Klarert',
    use_case: 'Ved oppsigelse.',
    category: 'engagement',
    audience: 'internal',
    estimated_minutes: 5,
    recommend_anonymous: true,
    scoring_note: 'Kobles til arbeidsflyt «utmelding».',
    law_ref: null,
    body: toBody(
      [
        { id: 'ex1', text: 'Hovedårsak til at du slutter (velg én):', type: 'single_select', required: true, options: ['Lønn', 'Leder', 'Kollegaer', 'Oppgavene', 'Helse', 'Annet'] },
        { id: 'ex2', text: 'Hva kunne vi gjort annerledes?', type: 'text', required: false },
        { id: 'ex3', text: 'Vil du anbefale oss? (0–10)', type: 'scale_10', required: true },
      ],
    ),
  },
  {
    id: 'tpl-onboarding',
    name: 'Onboarding 30 dager',
    short_name: 'Onboarding',
    description: '30 dager etter ansettelse — mottakelse og opplæring.',
    source: 'Klarert',
    use_case: 'Auto-utsending',
    category: 'wellbeing',
    audience: 'internal',
    estimated_minutes: 4,
    recommend_anonymous: false,
    scoring_note: 'Kobles til startdato.',
    law_ref: null,
    body: toBody(
      [
        { id: 'on1', text: 'Fikk du den opplæringen du trengte for jobben?', type: 'likert_5', required: true },
        { id: 'on2', text: 'Føler du deg inkludert i teamet?', type: 'likert_5', required: true },
        { id: 'on3', text: 'Hva var best / verst så langt?', type: 'text', required: false },
      ],
    ),
  },
  {
    id: 'ext-hms-egenerklaring',
    name: 'HMS-egenerklæring (leverandør)',
    short_name: 'HMS-eg',
    description: 'Standardisert egenerklæring for leverandører — internkontroll, opplæring, forsikring.',
    source: 'Klarert',
    use_case: 'Årlig fra underleverandører.',
    category: 'vendor',
    audience: 'external',
    estimated_minutes: 10,
    recommend_anonymous: false,
    scoring_note: 'Filvedlegg kan legges til i arbeidsflyt.',
    law_ref: 'IK-forskriften § 5',
    body: toBody(
      [
        { id: 'v1', text: 'Har virksomheten skriftlig HMS-system etter internkontrollforskriften?', type: 'yes_no', required: true },
        { id: 'v2', text: 'Bekreft at relevant personell er opplært i HMS for de tjenestene dere leverer.', type: 'yes_no', required: true },
        { id: 'v3', text: 'Har dere gyldig ansvarsforsikring?', type: 'single_select', required: true, options: ['Ja', 'Nei', 'Ordnes'] },
        { id: 'v4', text: 'Kort beskrivelse av sikker jobb-utførelse hos kunde (valgfritt).', type: 'text', required: false },
      ],
    ),
  },
  {
    id: 'ext-underentreprenor',
    name: 'Underentreprenør — byggeplass',
    short_name: 'UE bygg',
    description: 'SHA-plan, ID-kort, arbeidsforhold før oppstart på byggeplass.',
    source: 'Klarert',
    use_case: 'Bygg/anlegg.',
    category: 'vendor',
    audience: 'external',
    estimated_minutes: 15,
    recommend_anonymous: false,
    scoring_note: 'Krever signatur efter behov.',
    law_ref: 'Byggherreforskriften',
    body: toBody(
      [
        { id: 'u1', text: 'Er SHA-plan for arbeidet tilgjengelig og gjennomgått?', type: 'yes_no', required: true },
        { id: 'u2', text: 'Er ID-kort/seriøsitet verifisert?', type: 'yes_no', required: true },
        { id: 'u3', text: 'Risikonivå for arbeidet (1–10)', type: 'scale_10', required: true },
        { id: 'u4', text: 'Merknader / forbehold', type: 'text', required: false },
      ],
    ),
  },
  {
    id: 'ext-apenhetsloven',
    name: 'Etiske retningslinjer / menneskerettigheter',
    short_name: 'Åpenhet',
    description: 'Bekreftelse i tråd med åpenhetsloven — rettigheter og anstendige arbeidsforhold.',
    source: 'Klarert',
    use_case: 'Leverandørscreening.',
    category: 'compliance',
    audience: 'external',
    estimated_minutes: 6,
    recommend_anonymous: false,
    scoring_note: 'Dokumenter i revidering av leverandørregister.',
    law_ref: 'Åpenhetsloven § 4',
    body: toBody(
      [
        { id: 'a1', text: 'Er menneskerettigheter respektert i egen virksomhet og viktigste underleverandører?', type: 'yes_no', required: true },
        { id: 'a2', text: 'Har dere skriftlige retningslinjer for menneskerettigheter og rettferdig lønn?', type: 'yes_no', required: true },
        { id: 'a3', text: 'Beskriv kort hvordan dere følger opp underleverandører (valgfritt).', type: 'text', required: false },
      ],
    ),
  },
  {
    id: 'tpl-klarert-tilpasset',
    name: 'Tilpasset mal — start her',
    short_name: 'Ny mal',
    description: 'Tom eller nesten tom mal for å definere egne spørsmål og kriterier (kopier og tilpass).',
    source: 'Klarert',
    use_case: 'Egendefinerte undersøkelser.',
    category: 'custom',
    audience: 'both',
    estimated_minutes: 5,
    recommend_anonymous: true,
    scoring_note: 'Legg til spørsmål i byggeren etter opprettelse.',
    law_ref: null,
    body: { version: 1, questions: [] },
  },
]

function sqlEscape(s) {
  if (s == null) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

function sqlJson(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

const rows = [
  ...fromFile.map((r) => ({
    ...r,
    audience: r.audience === 'internal' ? 'internal' : r.audience,
  })),
  ...EXTRAS.map((e) => ({
    id: e.id,
    organization_id: null,
    is_system: true,
    name: e.name,
    short_name: e.short_name,
    description: e.description,
    source: e.source,
    use_case: e.use_case,
    category: e.category,
    audience: e.audience,
    estimated_minutes: e.estimated_minutes,
    recommend_anonymous: e.recommend_anonymous,
    scoring_note: e.scoring_note,
    law_ref: e.law_ref,
    body: typeof e.body === 'object' && !Array.isArray(e.body) ? e.body : e.body,
  })),
]

const valuesSql = rows
  .map(
    (r) =>
      `(${sqlEscape(r.id)}, NULL, true, ${sqlEscape(r.name)}, ${sqlEscape(r.short_name)}, ${sqlEscape(r.description)}, ${sqlEscape(r.source)}, ${sqlEscape(r.use_case)}, ${sqlEscape(r.category)}, ${sqlEscape(r.audience)}, ${r.estimated_minutes}, ${r.recommend_anonymous}, ${sqlEscape(r.scoring_note)}, ${sqlEscape(r.law_ref)}, ${sqlJson(r.body)})`,
  )
  .join(',\n')

const sql = `-- Seed survey_template_catalog from bundled definitions + specialty stubs.
-- Regenerate: node scripts/build-survey-catalog-seed.mjs

insert into public.survey_template_catalog (
  id,
  organization_id,
  is_system,
  name,
  short_name,
  description,
  source,
  use_case,
  category,
  audience,
  estimated_minutes,
  recommend_anonymous,
  scoring_note,
  law_ref,
  body
) values
${valuesSql}
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  source = excluded.source,
  use_case = excluded.use_case,
  category = excluded.category,
  audience = excluded.audience,
  estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous,
  scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref,
  body = excluded.body,
  updated_at = now();
`

writeFileSync(outMigration, sql, 'utf8')
console.log('Wrote', outMigration, `(${rows.length} rows)`)
