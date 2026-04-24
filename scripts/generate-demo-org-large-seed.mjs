/**
 * Generates supabase/migrations/archive/20260513120000_demo_org_large_seed.sql
 * Run: node scripts/generate-demo-org-large-seed.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEMO = '00000000-0000-4000-a000-000000000001'
const now = '2026-01-15T12:00:00.000Z'

const firstNames = [
  'Anne',
  'Bjørn',
  'Camilla',
  'David',
  'Eva',
  'Frode',
  'Guro',
  'Hanne',
  'Ingrid',
  'Jens',
  'Kari',
  'Lars',
  'Marte',
  'Nils',
  'Ole',
  'Per',
  'Ragnhild',
  'Siri',
  'Thomas',
  'Unni',
  'Vegard',
  'Wenche',
  'Yngve',
  'Åse',
  'Berit',
  'Cecilie',
  'Dag',
  'Eirik',
  'Frida',
  'Geir',
  'Hilde',
  'Ida',
  'Jon',
  'Knut',
  'Lise',
  'Magnus',
  'Nina',
  'Oda',
  'Pål',
  'Rune',
  'Siv',
  'Tor',
  'Ulf',
  'Vibeke',
  'Willy',
  'Astrid',
  'Bente',
  'Christian',
  'Dorte',
  'Espen',
  'Fredrik',
  'Grete',
  'Henrik',
  'Inger',
  'Jørgen',
  'Kirsten',
  'Leif',
  'Mona',
]
const lastNames = [
  'Andersen',
  'Berg',
  'Christensen',
  'Dahl',
  'Eriksen',
  'Fredriksen',
  'Gran',
  'Hansen',
  'Iversen',
  'Johnsen',
  'Karlsen',
  'Lund',
  'Moen',
  'Nilsen',
  'Olsen',
  'Pedersen',
  'Qvist',
  'Rasmussen',
  'Strand',
  'Thorsen',
  'Ulriksen',
  'Vik',
  'Wiik',
  'Ødegård',
  'Aas',
  'Bakke',
  'Eide',
  'Foss',
  'Haug',
  'Lie',
  'Myhre',
  'Næss',
  'Rønning',
  'Solberg',
  'Tangen',
]

const units = [
  { id: 'u-all', name: 'Hele organisasjonen', kind: 'division', color: '#1a3d32', parentId: null },
  { id: 'u-tech', name: 'Teknologi', kind: 'department', color: '#0284c7', parentId: 'u-all' },
  { id: 'u-people', name: 'Personal og HMS', kind: 'department', color: '#7c3aed', parentId: 'u-all' },
  { id: 'u-ops', name: 'Drift og produksjon', kind: 'department', color: '#d97706', parentId: 'u-all' },
  { id: 'u-sales', name: 'Salg og marked', kind: 'department', color: '#059669', parentId: 'u-all' },
  { id: 'u-finance', name: 'Økonomi', kind: 'department', color: '#4f46e5', parentId: 'u-all' },
  { id: 'u-dev', name: 'Utvikling', kind: 'team', color: '#0369a1', parentId: 'u-tech' },
  { id: 'u-design', name: 'Design', kind: 'team', color: '#0891b2', parentId: 'u-tech' },
  { id: 'u-infra', name: 'Plattform / drift IT', kind: 'team', color: '#0e7490', parentId: 'u-tech' },
  { id: 'u-prod-a', name: 'Produksjon linje A', kind: 'team', color: '#b45309', parentId: 'u-ops' },
  { id: 'u-prod-b', name: 'Produksjon linje B', kind: 'team', color: '#c2410c', parentId: 'u-ops' },
  { id: 'u-warehouse', name: 'Lager og logistikk', kind: 'team', color: '#a16207', parentId: 'u-ops' },
]

const unitPool = ['u-dev', 'u-design', 'u-infra', 'u-people', 'u-ops', 'u-prod-a', 'u-prod-b', 'u-warehouse', 'u-sales', 'u-finance']
const unitNames = Object.fromEntries(units.map((u) => [u.id, u.name]))

const employees = []
for (let i = 0; i < 58; i++) {
  const fn = firstNames[i % firstNames.length]
  const ln = lastNames[(i * 3) % lastNames.length]
  const id = `e${i + 1}`
  const uid = unitPool[i % unitPool.length]
  const suffix = i > 8 ? String(i + 1) : ''
  const emailLocal = `${fn.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.${ln.toLowerCase()}${i > 8 ? i : ''}`
  const email = `${emailLocal}@demo.atics.no`
  const isLead = i < 12
  employees.push({
    id,
    name: i > 8 ? `${fn} ${ln} (${i + 1})` : `${fn} ${ln}`,
    email,
    phone: `+47 9${String(10_000_000 + i).slice(1)}`,
    jobTitle:
      i === 0
        ? 'Konserndirektør'
        : isLead
          ? i < 4
            ? 'Avdelingsleder'
            : i < 8
              ? 'Teamleder'
              : 'Fagleder'
          : i % 5 === 0
            ? 'Senioringeniør'
            : i % 5 === 1
              ? 'Operatør'
              : i % 5 === 2
                ? 'Saksbehandler'
                : i % 5 === 3
                  ? 'Selger'
                  : 'Koordinator',
    role: isLead ? 'Leder' : 'Fagmedarbeider',
    unitId: uid,
    unitName: unitNames[uid],
    reportsToId: i === 0 ? undefined : i < 12 ? 'e1' : `e${((i - 1) % 12) + 1}`,
    location: i % 3 === 0 ? 'Oslo' : i % 3 === 1 ? 'Bergen' : 'Trondheim',
    employmentType: 'permanent',
    startDate: `20${15 + (i % 8)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
    active: true,
    createdAt: now,
    updatedAt: now,
  })
}
employees[0].unitId = 'u-all'
employees[0].unitName = 'Hele organisasjonen'
employees[0].reportsToId = undefined

for (let i = 1; i < employees.length; i++) {
  const r = employees[i].reportsToId
  if (r) {
    const boss = employees.find((x) => x.id === r)
    if (boss) employees[i].reportsToName = boss.name
  }
}

const groups = [
  { id: 'g-all', name: 'Alle ansatte', description: 'Hele virksomheten', scope: { kind: 'all' }, createdAt: now, updatedAt: now },
  { id: 'g-tech', name: 'Teknologi', description: '', scope: { kind: 'units', unitIds: ['u-tech'] }, createdAt: now, updatedAt: now },
  {
    id: 'g-ops',
    name: 'Produksjon og drift',
    description: '',
    scope: { kind: 'units', unitIds: ['u-ops', 'u-prod-a', 'u-prod-b', 'u-warehouse'] },
    createdAt: now,
    updatedAt: now,
  },
  { id: 'g-hms', name: 'HMS og personal', description: '', scope: { kind: 'units', unitIds: ['u-people'] }, createdAt: now, updatedAt: now },
]

const settings = {
  orgName: 'Demo Industri AS',
  employeeCount: 58,
  orgNumber: '000000000',
  hasCollectiveAgreement: true,
  collectiveAgreementName: 'LO/NHO',
  industrySector: 'Industri og teknologi',
  approvedTaskSignerEmployeeIds: ['e1', 'e2', 'e3', 'e4'],
}

const orgUnits = units.map((u) => ({
  id: u.id,
  name: u.name,
  kind: u.kind,
  color: u.color,
  parentId: u.parentId,
  createdAt: now,
  updatedAt: now,
}))

const organisationPayload = { settings, units: orgUnits, employees, groups }

const taskModules = ['general', 'council', 'hse', 'org_health', 'learning', 'members']
const taskStatuses = ['todo', 'in_progress', 'done']
const taskTitles = [
  'Gjennomfør AMU-oppfølging sykefravær Q1',
  'Oppdater ROS for lager — nye truckløyper',
  'Vernerunde oppfølging: verneutstyr linje B',
  'Revisjon av brannøvelse — dokumentasjon',
  'Kurs: maskinsikring for nye operatører',
  'Oppfølgingsmøte etter anonym melding',
  'Kartlegg ergonomi kontorfløy',
  'SJA vedlikehold tak — godkjenning',
  'Synkroniser NAV A-melding med fraværsstatistikk',
  'Forbered årsgjennomgang internkontroll',
  'Kjemikalieinventar — oppdatere datablad',
  'BHT-avtale fornyelse — utkast',
  'Inspeksjon ekstern — tiltaksliste',
  'Varslingssak #104 — intervju planlegging',
  'Undersøkelse: psykososialt miljø — lukking',
  'Handlingsplan lav psykologisk trygghet',
  'Digital tilgangsstyring — revisjon',
  'Avvik: nestenulykke truck — rotårsak',
  'Oppdater førstehjelpskurs utløp',
  'Prosjekt: støyvakter produksjon',
  'AML-indikator oppfølging — kvartalsrapport',
  'Kontraktør PPE-sjekk — lager',
  'Risikovurdering ny maskin — frist',
  'Møteinnkalling verneråd april',
]

const tasks = taskTitles.map((title, i) => {
  const emp = employees[5 + (i % 20)]
  const st = taskStatuses[i % 3]
  const d = new Date(2026, 2 + (i % 4), 10 + (i % 15))
  return {
    id: `demo-task-${i + 1}`,
    title,
    description: `Demonstrasjonsoppgave ${i + 1} for demo-konto.`,
    status: st,
    assignee: emp.name,
    assigneeEmployeeId: emp.id,
    ownerRole: i % 2 === 0 ? 'HMS' : 'Leder',
    leaderEmployeeId: 'e4',
    leaderName: employees[3].name,
    dueDate: d.toISOString().slice(0, 10),
    createdAt: now,
    module: taskModules[i % taskModules.length],
    sourceType: 'manual',
    requiresManagementSignOff: i % 4 === 0,
  }
})

const tasksPayload = {
  tasks,
  auditLog: tasks.slice(0, 5).map((t, i) => ({
    id: `demo-audit-${i}`,
    at: now,
    action: 'created',
    taskId: t.id,
    message: `Oppgave opprettet (demo seed): ${t.title}`,
  })),
}

const repMembers = [
  { id: 'lm1', name: 'Ledelse — leder', side: 'leadership', officeRole: 'leadership_chair', source: 'appointment', startedAt: '2024-06-01', termUntil: '2026-05-31', trainingChecklist: {} },
  { id: 'lm2', name: 'Ledelse — nestleder', side: 'leadership', officeRole: 'leadership_deputy', source: 'appointment', startedAt: '2024-06-01', termUntil: '2026-05-31', trainingChecklist: {} },
  { id: 'lm3', name: 'Ledelse — medlem', side: 'leadership', officeRole: 'leadership_member', source: 'appointment', startedAt: '2024-06-01', termUntil: '2026-05-31', trainingChecklist: {} },
  { id: 'em1', name: `${employees[13].name}`, side: 'employee', officeRole: 'employee_chair', source: 'election', startedAt: '2024-08-01', termUntil: '2026-05-31', employeeId: 'e14', trainingChecklist: {} },
  { id: 'em2', name: `${employees[14].name}`, side: 'employee', officeRole: 'employee_deputy', source: 'election', startedAt: '2024-08-01', termUntil: '2026-05-31', employeeId: 'e15', trainingChecklist: {} },
  { id: 'em3', name: `${employees[15].name}`, side: 'employee', officeRole: 'employee_member', source: 'election', startedAt: '2024-08-01', termUntil: '2026-05-31', employeeId: 'e16', trainingChecklist: {} },
]

const representativesPayload = {
  settings: { seatsPerSide: 3, requireChairAndDeputy: true },
  elections: [
    {
      id: 'rep-el-open',
      title: 'Suppleringsvalg arbeidstakerrepresentant 2026',
      description: 'Ett sete ledig etter permisjon.',
      anonymous: true,
      status: 'open',
      seatsToFill: 1,
      candidates: [
        { id: 'rc1', name: employees[20].name, voteCount: 5 },
        { id: 'rc2', name: employees[21].name, voteCount: 3 },
      ],
      votesCastTotal: 8,
      createdAt: now,
      openedAt: now,
      periodId: 'p1',
    },
    {
      id: 'rep-el-closed',
      title: 'Valg arbeidstakerrepresentanter 2024',
      description: 'Fullt valg for perioden.',
      anonymous: false,
      status: 'closed',
      seatsToFill: 3,
      candidates: [
        { id: 'oc1', name: employees[13].name, voteCount: 24 },
        { id: 'oc2', name: employees[14].name, voteCount: 19 },
        { id: 'oc3', name: employees[15].name, voteCount: 12 },
      ],
      votesCastTotal: 55,
      createdAt: '2024-05-01T10:00:00.000Z',
      openedAt: '2024-05-02T10:00:00.000Z',
      closedAt: '2024-05-20T16:00:00.000Z',
      periodId: 'p1',
    },
  ],
  members: repMembers,
  periods: [{ id: 'p1', label: '2024–2026', startDate: '2024-06-01', endDate: '2026-05-31' }],
  auditTrail: [
    { id: 'ra1', at: now, action: 'election_created', message: 'Demodata: representasjon med åpne og avsluttede valg.', meta: { demo: true } },
  ],
  voterTokens: {},
}

function rosRow(suffix, activity, hazard, sev, lik) {
  const id = `r-${suffix}`
  return {
    id,
    activity,
    hazard,
    existingControls: 'Rutiner og opplæring',
    severity: sev,
    likelihood: lik,
    riskScore: sev * lik,
    proposedMeasures: 'Følg opp i handlingsplan',
    responsible: employees[3].name,
    dueDate: '2026-06-30',
    status: 'open',
  }
}

const internalControlPayload = {
  rosAssessments: [
    {
      id: 'demo-ros-prod',
      title: 'ROS — Produksjon hall A–B',
      department: 'Drift og produksjon',
      assessedAt: '2026-01-10',
      assessor: employees[7].name,
      rosCategory: 'general',
      rows: [
        rosRow('prod-truck', 'Truckkjøring', 'Kollisjon / klemming', 4, 3),
        rosRow('prod-lift', 'Løft', 'Belastning', 3, 3),
        rosRow('prod-stoy', 'Støy', 'Hørselsskade', 3, 4),
      ],
      signatures: [],
      locked: false,
      revisionVersion: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-ros-chem',
      title: 'ROS — Kjemikaliehåndtering lager',
      department: 'Lager',
      assessedAt: '2025-11-20',
      assessor: employees[3].name,
      rosCategory: 'general',
      rows: [rosRow('chem-1', 'Oppløsningsmidler', 'Hud/åndevei', 4, 2), rosRow('chem-2', 'Spill', 'Miljø/brann', 3, 2)],
      signatures: [],
      locked: true,
      revisionVersion: 1,
      createdAt: '2025-11-20T10:00:00.000Z',
      updatedAt: now,
    },
    {
      id: 'demo-ros-office',
      title: 'ROS — Kontor og møterom',
      department: 'Administrasjon',
      assessedAt: '2025-09-01',
      assessor: employees[3].name,
      rosCategory: 'general',
      rows: [rosRow('off-1', 'Skjermarbeid', 'Belastning', 3, 3)],
      signatures: [],
      locked: false,
      revisionVersion: 1,
      createdAt: '2025-09-01T08:00:00.000Z',
      updatedAt: now,
    },
  ],
  annualReviews: [
    {
      id: 'demo-ar-2026',
      year: 2026,
      reviewedAt: '2026-01-05',
      reviewer: employees[0].name,
      summary: '',
      nextReviewDue: '2027-12-31',
      status: 'draft',
      locked: false,
      sections: {
        goalsLastYearAchieved: 'partial',
        goalsLastYearComment: 'HMS-mål delvis nådd; forbedre vernerunder.',
        deviationsReview: 'Åpne avvik reduseres.',
        rosReview: 'Tre ROS under revisjon.',
        sickLeaveReview: 'Fravær innenfor bransjesnitt.',
        goalsNextYear: 'Digital sporing av inspeksjoner.',
      },
      actionPlanDrafts: [],
      signatures: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-ar-2025',
      year: 2025,
      reviewedAt: '2025-12-15',
      reviewer: employees[0].name,
      summary: '',
      nextReviewDue: '2026-12-31',
      status: 'locked',
      locked: true,
      sections: {
        goalsLastYearAchieved: 'yes',
        goalsLastYearComment: 'Fullført.',
        deviationsReview: 'Ingen kritiske avvik åpne.',
        rosReview: 'Oppdatert.',
        sickLeaveReview: 'Oppfølging etter rutine.',
        goalsNextYear: 'Øke deltakelse i undersøkelser.',
      },
      actionPlanDrafts: [],
      signatures: [],
      createdAt: '2025-12-15T10:00:00.000Z',
      updatedAt: '2025-12-15T10:00:00.000Z',
    },
  ],
  auditTrail: [{ id: 'ica1', at: now, action: 'init', message: 'Internkontroll demodata (stor bedrift).', meta: { demo: true } }],
}

const defaultQs = [
  { id: 'q1', text: 'Hvordan vurderer du det psykososiale miljøet?', type: 'likert_5', required: true, subscale: 'Psykologisk trygghet — generelt' },
  { id: 'q2', text: 'Kan du si fra om problemer uten frykt?', type: 'likert_5', required: true, subscale: 'Psykologisk trygghet — si fra' },
  { id: 'q3', text: 'Forslag til forbedring?', type: 'text', required: false },
]

const surveys = [
  { id: 'sv-open', title: 'Arbeidsmiljøpulse vår 2026', description: 'Åpen undersøkelse', anonymous: true, status: 'open', questions: defaultQs, createdAt: now, openedAt: now, targetGroupId: 'g-all', targetGroupLabel: 'Alle ansatte' },
  { id: 'sv-closed', title: 'Trivsel høst 2025', description: 'Lukket', anonymous: true, status: 'closed', questions: defaultQs, createdAt: '2025-09-01T08:00:00.000Z', openedAt: '2025-09-05T08:00:00.000Z', closedAt: '2025-10-01T18:00:00.000Z' },
  { id: 'sv-draft', title: 'Ledertilfredshet (utkast)', description: '', anonymous: false, status: 'draft', questions: defaultQs, createdAt: now },
]

const responses = []
const responseTokens = {}
for (let i = 0; i < 42; i++) {
  const tok = `tok-${i}`
  const hasText = i % 7 === 0
  responses.push({
    id: `resp-${i}`,
    surveyId: 'sv-closed',
    answers: { q1: 3 + (i % 3), q2: 3 + ((i + 1) % 3), q3: hasText ? 'Bedre pauserom' : '' },
    anonymousTextProvided: { q3: hasText },
    submittedAt: new Date(2025, 8, 10 + (i % 15), 10 + (i % 8)).toISOString(),
    responseToken: tok,
  })
  responseTokens[tok] = ['sv-closed']
}

const navReports = []
for (let m = 0; m < 8; m++) {
  const d = new Date(2025, 4 + m, 1)
  navReports.push({
    id: `nav-${m}`,
    periodLabel: d.toLocaleString('no-NO', { month: 'long', year: 'numeric' }),
    periodStart: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10),
    periodEnd: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10),
    sickLeavePercent: 3.2 + (m % 4) * 0.4,
    selfCertifiedDays: 80 + m * 5,
    documentedSickDays: 55 + m * 3,
    employeeCount: 58,
    notes: 'Illustrativt aggregat for demo.',
    sourceNote: 'Manuell / demo',
    createdAt: d.toISOString(),
  })
}

const laborMetricKeys = [
  'work_environment_assessment',
  'risk_assessment_ros',
  'near_miss_reports',
  'whistleblower_cases',
  'training_hours_hms',
]
const laborMetrics = laborMetricKeys.map((metricKey, i) => {
  const ps = new Date(2025, (i % 4) * 3, 1)
  const pe = new Date(2025, (i % 4) * 3 + 2, 28)
  return {
    id: `lm-${i}`,
    periodStart: ps.toISOString().slice(0, 10),
    periodEnd: pe.toISOString().slice(0, 10),
    metricKey,
    value: 60 + i * 7,
    unit: i % 2 === 0 ? 'score' : 'percent',
    notes: 'Demo',
    createdAt: now,
  }
})

const amlKinds = ['near_miss', 'psychosocial', 'harassment_discrimination', 'work_injury_illness', 'other']
const anonymousAmlReports = amlKinds.map((kind, i) => ({
  id: `aml-${i}`,
  kind,
  submittedAt: new Date(2025, 10 + (i % 2), 5 + i).toISOString(),
  detailsIndicated: i % 2 === 0,
  urgency: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
}))

const orgHealthPayload = {
  surveys,
  responses,
  navReports,
  laborMetrics,
  auditTrail: [{ id: 'oha1', at: now, action: 'survey_created', message: 'Organisasjonshelse demodata.', meta: { demo: true } }],
  responseTokens,
  anonymousAmlReports,
}

const SAFETY_ROUND_TEMPLATE_ID = 'vernerunde-standard-v1'

function emptyChecklist() {
  return { chk1: 'ok', chk2: 'ok', chk3: 'issue' }
}

const hsePayload = {
  safetyRounds: [
    {
      id: 'demo-sr-prod',
      title: 'Vernerunde — Produksjon linje A',
      conductedAt: '2026-01-12T09:00',
      location: 'Hall A',
      conductedBy: employees[7].name,
      department: 'Produksjon linje A',
      checklistTemplateId: SAFETY_ROUND_TEMPLATE_ID,
      items: emptyChecklist(),
      itemDetails: {},
      notes: 'Funnet slitasje merking — bestilt nye.',
      status: 'approved',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-sr-lager',
      title: 'Vernerunde — Lager',
      conductedAt: '2025-12-05T13:00',
      location: 'Lager øst',
      conductedBy: employees[3].name,
      checklistTemplateId: SAFETY_ROUND_TEMPLATE_ID,
      items: { chk1: 'ok', chk2: 'ok', chk3: 'ok' },
      itemDetails: {},
      notes: '',
      status: 'in_progress',
      createdAt: '2025-12-05T10:00:00.000Z',
      updatedAt: now,
    },
    {
      id: 'demo-sr-kontor',
      title: 'Vernerunde — Kontorfløy',
      conductedAt: '2025-10-01T11:00',
      location: 'Oslo hovedkontor',
      conductedBy: employees[3].name,
      checklistTemplateId: SAFETY_ROUND_TEMPLATE_ID,
      items: { chk1: 'ok', chk2: 'na', chk3: 'ok' },
      itemDetails: {},
      notes: '',
      status: 'approved',
      createdAt: '2025-10-01T08:00:00.000Z',
      updatedAt: now,
    },
  ],
  inspections: [1, 2, 3, 4].map((n) => ({
    id: `demo-insp-${n}`,
    title: `${n === 1 ? 'Intern' : n === 2 ? 'Ekstern' : 'Revisjon'} inspeksjon Q${n}`,
    kind: n === 2 ? 'external' : 'internal',
    conductedAt: `2025-${String(8 + n).padStart(2, '0')}-15`,
    location: n % 2 === 0 ? 'Bergen' : 'Oslo',
    responsibleName: employees[3 + n].name,
    responsibleEmployeeId: employees[3 + n].id,
    subjectLabel: n % 2 === 0 ? 'Lager' : 'Produksjon',
    concreteFindings: [
      { id: `f-${n}-1`, description: 'Merknad: orden og rydding', status: 'open', createdAt: now },
      { id: `f-${n}-2`, description: 'Forbedringspunkt: verneutstyr', status: 'open', createdAt: now },
    ],
    attachments: [],
    protocolSignatures: [],
    locked: n > 2,
    findingTasksSynced: false,
    createdAt: now,
    updatedAt: now,
  })),
  incidents: [1, 2, 3, 4, 5].map((n) => ({
    id: `demo-inc-${n}`,
    kind: 'near_miss',
    category: 'physical',
    formTemplate: 'standard',
    severity: n === 1 ? 'critical' : n === 2 ? 'high' : 'medium',
    occurredAt: `2025-${String(11 + (n % 2)).padStart(2, '0')}-${10 + n}T14:00:00`,
    location: 'Produksjon',
    departmentId: 'u-prod-a',
    department: 'Produksjon linje A',
    description: `Nestenulykke / avvik demo #${n}`,
    immediateActions: 'Stoppet prosess, informert leder.',
    reportedBy: employees[15 + n].name,
    reportedByEmployeeId: employees[15 + n].id,
    nearestLeaderEmployeeId: 'e5',
    status: n % 2 === 0 ? 'investigating' : 'action_pending',
    createdAt: now,
    updatedAt: now,
  })),
  sjaAnalyses: [1, 2, 3].map((n) => ({
    id: `demo-sja-${n}`,
    title: `SJA — Vedlikehold tak sektor ${n}`,
    jobDescription: 'Arbeid i høyden, stillas.',
    location: 'Hall B',
    department: 'Drift',
    departmentId: 'u-ops',
    plannedAt: `2026-02-${5 + n}T08:00:00`,
    conductedBy: employees[4].name,
    workLeaderEmployeeId: 'e5',
    participantEmployeeIds: ['e14', 'e15'],
    participants: `${employees[14].name}, ${employees[15].name}`,
    rows: [
      {
        id: `sjar-${n}`,
        step: 'Tilkomst',
        hazard: 'Fall',
        consequence: 'Alvorlig personskade',
        existingControls: 'Stillas sertifisert',
        additionalMeasures: 'Ekstra sikring',
        responsible: employees[4].name,
      },
    ],
    status: n === 1 ? 'approved' : 'draft',
    conclusion: n === 1 ? 'Godkjent med merknad.' : '',
    signatures: [],
    involvesHotWork: n === 2,
    requiresLoto: n === 2,
    createdAt: now,
    updatedAt: now,
  })),
  trainingRecords: employees.slice(3, 15).map((e, i) => ({
    id: `tr-${i}`,
    employeeName: e.name,
    employeeId: e.id,
    department: e.unitName ?? '',
    role: e.role,
    trainingKind: i % 3 === 0 ? 'hms_40hr' : i % 3 === 1 ? 'first_aid' : 'fire_warden',
    completedAt: `2025-${String((i % 9) + 1).padStart(2, '0')}-10`,
    expiresAt: i % 2 === 0 ? '2028-01-01' : undefined,
    provider: 'Demo Opplæring AS',
    createdAt: now,
    updatedAt: now,
  })),
  sickLeaveCases: [0, 1, 2, 3].map((i) => {
    const sf = new Date(2025, 10 + i, 5 + i).toISOString().slice(0, 10)
    return {
      id: `demo-sl-${i}`,
      employeeName: employees[20 + i].name,
      employeeId: employees[20 + i].id,
      department: employees[20 + i].unitName ?? '',
      departmentId: employees[20 + i].unitId,
      managerName: employees[3].name,
      managerEmployeeId: 'e4',
      absenceType: i % 2 === 0 ? 'medical_certificate' : 'self_reported',
      sickFrom: sf,
      status: i === 0 ? 'active' : i === 1 ? 'partial' : 'returning',
      sicknessDegree: i === 1 ? 50 : 100,
      accommodationNotes: '',
      portalMessages: [],
      milestones: [],
      consentRecorded: true,
      createdAt: now,
      updatedAt: now,
    }
  }),
  checklistTemplates: [],
  auditTrail: [{ id: 'h1', at: now, action: 'module_init', entityType: 'system', entityId: 'hse', summary: 'HSE demodata utvidet' }],
}

const cats = ['work_environment', 'health_safety', 'management', 'ethics', 'policy_violation']
const workplaceReportingPayload = {
  cases: cats.map((category, i) => ({
    id: `wpc-${i}`,
    createdAt: new Date(2025, 9 + (i % 3), 3 + i).toISOString(),
    updatedAt: now,
    category,
    status: i === 0 ? 'received' : i === 1 ? 'triage' : i === 2 ? 'in_progress' : 'closed',
    title: `Demo sak: ${category}`,
    description: 'Kort beskrivelse av henvendelsen (demodata).',
    details: { locationOrUnit: employees[10 + i].unitName },
    confidential: i === 4,
    createdByUserId: '00000000-0000-0000-0000-000000000000',
  })),
}

const reportBuilderPayload = {
  templates: [
    {
      id: 'demo-rpt-1',
      name: 'KPI — drift og oppgaver',
      createdAt: now,
      updatedAt: now,
      modules: [
        { id: 'm1', kind: 'kpi', title: 'Aktive ansatte', datasetKey: 'org_overview', valuePath: 'activeEmployees', subtitle: 'Registrert' },
        { id: 'm2', kind: 'kpi', title: 'Oppgaver totalt', datasetKey: 'tasks_by_status', valuePath: 'total', subtitle: 'Kanban' },
        { id: 'm3', kind: 'bar', title: 'Status', datasetKey: 'tasks_by_status', seriesKeys: ['todo', 'in_progress', 'done'] },
      ],
    },
    {
      id: 'demo-rpt-2',
      name: 'Oversikt sykefravær (sammendrag)',
      createdAt: now,
      updatedAt: now,
      modules: [
        { id: 'm4', kind: 'table', title: 'Oppgaver', datasetKey: 'tasks_table', rowKeys: ['title', 'status', 'assignee'] },
        { id: 'm5', kind: 'donut', title: 'Fordeling', datasetKey: 'tasks_by_status', segmentsPath: '' },
      ],
    },
  ],
}

const costSettingsPayload = { hourlyRateNok: 720, hoursPerDay: 7.5, enabled: true }
const workspacePayload = { users: {} }

function sqlJson(obj) {
  return JSON.stringify(obj).replace(/'/g, "''")
}

const meetingPayload = (m) => sqlJson(m)

const meetings = [
  {
    id: 'demo-cm-1',
    title: 'AMU ordinært Q1 2026',
    startsAt: '2026-03-10T09:00:00',
    location: 'Møterom Orion / Teams',
    agendaItems: [
      { id: 'a1', title: 'Godkjenning innkalling', notes: '', order: 0 },
      { id: 'a2', title: 'HMS-statistikk og fravær', notes: '', order: 1 },
      { id: 'a3', title: 'Årshjul og risiko', notes: '', order: 2 },
    ],
    status: 'planned',
    preparationNotes: 'Distribuer tall fra NAV-rapport.',
    preparationChecklist: [
      { id: 'p1', label: 'Agenda sendt', done: true },
      { id: 'p2', label: 'Materiell HMS', done: false },
    ],
    auditTrail: [{ id: 'at1', at: now, kind: 'note', text: 'Møte opprettet (demo seed).', author: 'System' }],
    quarterSlot: 1,
    governanceYear: 2026,
    createdAt: now,
  },
  {
    id: 'demo-cm-2',
    title: 'AMU ordinært Q4 2025',
    startsAt: '2025-12-05T13:00:00',
    location: 'Hovedkontoret',
    agendaItems: [{ id: 'b1', title: 'Årsoppsummering', notes: '', order: 0 }],
    status: 'completed',
    minutes: 'Referat godkjent.',
    preparationNotes: '',
    preparationChecklist: [
      { id: 'p1', label: 'Agenda sendt', done: true },
      { id: 'p2', label: 'Materiell HMS', done: true },
    ],
    auditTrail: [
      { id: 'at2', at: '2025-12-05T16:00:00', kind: 'decision', text: 'Vedtak: oppdatere vernerunde-plan.', author: 'Referent' },
    ],
    quarterSlot: 4,
    governanceYear: 2025,
    createdAt: '2025-11-01T10:00:00.000Z',
  },
  {
    id: 'demo-cm-3',
    title: 'Ekstraordinært møte — reorganisering',
    startsAt: '2026-01-22T10:00:00',
    location: 'Teams',
    agendaItems: [{ id: 'c1', title: 'Informasjon og drøfting AML § 16-1', notes: '', order: 0 }],
    status: 'planned',
    preparationNotes: '',
    preparationChecklist: [],
    auditTrail: [],
    governanceYear: 2026,
    createdAt: now,
  },
]

let sql = `-- Large demo tenant seed: 58 employees, multiple departments, rich module payloads.
-- Demo org: ${DEMO}

update public.organizations
set name = 'Demo Industri AS'
where id = '${DEMO}'::uuid;

-- Council: replace demo org rows with richer dataset
delete from public.council_meetings where organization_id = '${DEMO}'::uuid;
delete from public.council_elections where organization_id = '${DEMO}'::uuid;
delete from public.council_board_members where organization_id = '${DEMO}'::uuid;
delete from public.council_compliance_items where organization_id = '${DEMO}'::uuid;

insert into public.council_board_members (id, organization_id, name, role, elected_at, term_until)
values
  ('cbm-l1', '${DEMO}'::uuid, '${employees[12].name.replace(/'/g, "''")}', 'leader', '2024-06-01', '2026-05-31'),
  ('cbm-d1', '${DEMO}'::uuid, '${employees[13].name.replace(/'/g, "''")}', 'deputy', '2024-06-01', '2026-05-31'),
  ('cbm-m1', '${DEMO}'::uuid, '${employees[14].name.replace(/'/g, "''")}', 'member', '2024-06-01', '2026-05-31'),
  ('cbm-m2', '${DEMO}'::uuid, '${employees[15].name.replace(/'/g, "''")}', 'member', '2024-06-01', '2026-05-31'),
  ('cbm-m3', '${DEMO}'::uuid, '${employees[16].name.replace(/'/g, "''")}', 'member', '2024-06-01', '2026-05-31');

insert into public.council_elections (id, organization_id, title, status, candidates, created_at, closed_at, winner_candidate_id)
values
  (
    'cel-2027',
    '${DEMO}'::uuid,
    'Valg arbeidstakerrepresentanter 2027',
    'open',
    '${sqlJson([
      { id: 'c1', name: employees[17].name, voteCount: 8 },
      { id: 'c2', name: employees[18].name, voteCount: 5 },
      { id: 'c3', name: employees[19].name, voteCount: 3 },
    ])}'::jsonb,
    now(),
    null,
    null
  ),
  (
    'cel-2024',
    '${DEMO}'::uuid,
    'Valg 2024 (avsluttet)',
    'closed',
    '${sqlJson([
      { id: 'x1', name: employees[13].name, voteCount: 22 },
      { id: 'x2', name: employees[14].name, voteCount: 18 },
    ])}'::jsonb,
    '2024-05-01T10:00:00Z',
    '2024-05-20T16:00:00Z',
    'x1'
  );

`

for (const m of meetings) {
  sql += `insert into public.council_meetings (id, organization_id, payload) values ('${m.id}', '${DEMO}'::uuid, '${meetingPayload(m)}'::jsonb);\n`
}

const complianceRows = [
  ['dc1', 'AMU etablert og sammensatt', 'Sikre representasjon og møtefrekvens.', 'AML kap. 7', true, 'Oppfylt i demo.', 1],
  ['dc2', 'Verneombud og verneområder', 'Dekning dokumentert.', 'AML §§ 6-1–6-4', true, '', 2],
  ['dc3', 'Informasjon og drøfting', 'Prosesser ved endring.', 'AML § 16-1', false, '', 3],
  ['dc4', 'HMS-system og risiko', 'ROS og årshjul.', 'AML §§ 3-1, 5-1', false, '', 4],
  ['dc5', 'Opplæring verneombud', '40-timers krav fulgt.', 'AML § 3-5', true, '', 5],
  ['dc6', 'Bedriftshelsetjeneste', 'Avtale aktiv.', 'Internkontroll', true, '', 6],
  ['dc7', 'Avviksbehandling', 'Kanban-kø.', 'IK-f § 5', false, '', 7],
  ['dc8', 'Varslingskanal', 'Testet kvartalsvis.', 'AML kap. 2A', true, '', 8],
]

for (const [id, title, desc, law, done, notes, ord] of complianceRows) {
  sql += `insert into public.council_compliance_items (organization_id, id, title, description, law_ref, done, notes, is_custom, sort_order)
  values ('${DEMO}'::uuid, '${id}', '${title.replace(/'/g, "''")}', '${desc.replace(/'/g, "''")}', '${law.replace(/'/g, "''")}', ${done}, '${notes.replace(/'/g, "''")}', false, ${ord});\n`
}

const payloads = [
  ['organisation', organisationPayload],
  ['tasks', tasksPayload],
  ['representatives', representativesPayload],
  ['internal_control', internalControlPayload],
  ['org_health', orgHealthPayload],
  ['hse', hsePayload],
  ['workplace_reporting', workplaceReportingPayload],
  ['report_builder', reportBuilderPayload],
  ['cost_settings', costSettingsPayload],
  ['workspace', workspacePayload],
]

for (const [key, payload] of payloads) {
  sql += `
insert into public.org_module_payloads (organization_id, module_key, payload)
values ('${DEMO}'::uuid, '${key}', '${sqlJson(payload)}'::jsonb)
on conflict (organization_id, module_key) do update set
  payload = excluded.payload,
  updated_at = now();
`
}

const outPath = join(__dirname, '../supabase/migrations/archive/20260513120000_demo_org_large_seed.sql')
writeFileSync(outPath, sql, 'utf8')
console.log('Wrote', outPath)
