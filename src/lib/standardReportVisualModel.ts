import type { StandardReportId } from '../data/standardReports'

export type VisualKpi = { id: string; label: string; value: string | number; hint?: string }
export type VisualBar = { id: string; title: string; items: { label: string; value: number }[] }
export type VisualDonut = { id: string; title: string; segments: { label: string; value: number }[] }
export type VisualTable = { id: string; title: string; columns: string[]; rows: Record<string, string | number | null | undefined>[] }

export type StandardReportVisualModel = {
  kpis: VisualKpi[]
  bars: VisualBar[]
  donuts: VisualDonut[]
  tables: VisualTable[]
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return null
}

function objectToBarItems(o: Record<string, unknown>): { label: string; value: number }[] {
  return Object.entries(o).map(([label, val]) => ({ label, value: num(val) ?? 0 }))
}

function objectToDonutSegments(o: Record<string, unknown>): { label: string; value: number }[] {
  return Object.entries(o).map(([label, val]) => ({ label, value: num(val) ?? 0 }))
}

export function buildStandardReportVisualModel(
  id: StandardReportId,
  payload: unknown,
): StandardReportVisualModel {
  const kpis: VisualKpi[] = []
  const bars: VisualBar[] = []
  const donuts: VisualDonut[] = []
  const tables: VisualTable[] = []

  const root = asRecord(payload)
  if (!root) {
    return { kpis: [{ id: 'empty', label: 'Ingen data', value: '—' }], bars, donuts, tables }
  }

  switch (id) {
    case 'amu_annual': {
      const sick = asRecord(root.sickLeaveSummary)
      if (sick) {
        const tc = num(sick.totalCases)
        if (tc != null) kpis.push({ id: 'sickCases', label: 'Sykefraværssaker (år)', value: tc })
        if (sick.shortTermPct != null) kpis.push({ id: 'short', label: 'Korttidsandel %', value: String(sick.shortTermPct) })
        if (sick.longTermPct != null) kpis.push({ id: 'long', label: 'Langtidsandel %', value: String(sick.longTermPct) })
      }
      const train = asRecord(root.mandatoryTraining)
      if (train && train.certificatesIssued != null) {
        kpis.push({ id: 'certs', label: 'Utstedte kursbevis', value: num(train.certificatesIssued) ?? 0 })
      }
      const inc = root.incidentsBySeverity
      if (inc && typeof inc === 'object' && !Array.isArray(inc)) {
        const items = objectToBarItems(inc as Record<string, unknown>)
        if (items.length) bars.push({ id: 'inc', title: 'Hendelser etter alvorlighetsgrad', items })
      }
      const tasks = asRecord(root.kanbanActions)
      if (tasks) {
        const items = objectToBarItems(tasks)
        if (items.length) bars.push({ id: 'tasks', title: 'Tiltak (åpne vs. lukket)', items })
      }
      const meetings = root.meetings
      if (Array.isArray(meetings) && meetings.length) {
        const rows = meetings.slice(0, 25).map((m, i) => {
          const r = asRecord(m) ?? {}
          return {
            nr: i + 1,
            title: String(r.title ?? '—'),
            status: String(r.status ?? '—'),
            startsAt: String(r.startsAt ?? '—'),
          }
        })
        tables.push({ id: 'meetings', title: 'AMU-møter', columns: ['nr', 'title', 'status', 'startsAt'], rows })
      }
      break
    }
    case 'annual_ik': {
      const rounds = asRecord(root.safetyRoundsSummary)
      if (rounds) {
        if (rounds.roundsInYear != null) kpis.push({ id: 'r1', label: 'Vernerunder i år', value: num(rounds.roundsInYear) ?? 0 })
        if (rounds.roundsWithIssues != null)
          kpis.push({ id: 'r2', label: 'Runder med avvik', value: num(rounds.roundsWithIssues) ?? 0 })
        if (rounds.avgIssuesPerRound != null)
          kpis.push({ id: 'r3', label: 'Snitt avvik per runde', value: String(rounds.avgIssuesPerRound) })
      }
      const ros = root.rosAssessments
      if (Array.isArray(ros)) {
        const byBand: Record<string, number> = { grønn: 0, gul: 0, rød: 0, ukjent: 0 }
        for (const x of ros) {
          const r = asRecord(x)
          const b = String(r?.residualRiskBand ?? '').toLowerCase()
          if (b === 'green' || b === 'grønn') byBand.grønn++
          else if (b === 'yellow' || b === 'gul') byBand.gul++
          else if (b === 'red' || b === 'rød') byBand.rød++
          else byBand.ukjent++
        }
        const segs = objectToDonutSegments(byBand as unknown as Record<string, unknown>)
        if (segs.some((s) => s.value > 0)) donuts.push({ id: 'ros', title: 'ROS — restrisiko (bånd)', segments: segs })
        const rows = ros.slice(0, 20).map((x, i) => {
          const r = asRecord(x) ?? {}
          return {
            nr: i + 1,
            title: String(r.title ?? '—'),
            locked: String(r.locked ?? false),
            band: String(r.residualRiskBand ?? '—'),
          }
        })
        tables.push({ id: 'rosT', title: 'ROS-vurderinger', columns: ['nr', 'title', 'locked', 'band'], rows })
      }
      const wiki = root.hmsGoalsFromWiki
      if (Array.isArray(wiki) && wiki.length) {
        const rows = wiki.slice(0, 15).map((x, i) => {
          const r = asRecord(x) ?? {}
          return {
            nr: i + 1,
            title: String(r.title ?? '—'),
            status: String(r.status ?? '—'),
            nextRevision: String(r.nextRevisionDueAt ?? '—'),
          }
        })
        tables.push({ id: 'wiki', title: 'HMS-relaterte wikisider', columns: ['nr', 'title', 'status', 'nextRevision'], rows })
      }
      const vers = root.policyVersionsInYear
      if (Array.isArray(vers) && vers.length) {
        const rows = vers.slice(0, 15).map((x, i) => {
          const r = asRecord(x) ?? {}
          return { nr: i + 1, pageId: String(r.pageId ?? '—'), version: String(r.version ?? '—'), frozenAt: String(r.frozenAt ?? '—') }
        })
        tables.push({ id: 'ver', title: 'Policyversjoner i år', columns: ['nr', 'pageId', 'version', 'frozenAt'], rows })
      }
      break
    }
    case 'arp': {
      const g = asRecord(root.genderTotals)
      if (g) {
        const segs = objectToDonutSegments(g)
        if (segs.length) donuts.push({ id: 'gender', title: 'Kjønnsfordeling (org.kart)', segments: segs })
        kpis.push(
          { id: 'gf', label: 'Kvinner', value: num(g.female) ?? 0 },
          { id: 'gm', label: 'Menn', value: num(g.male) ?? 0 },
        )
      }
      const sal = root.salaryGapByCategory
      if (sal && typeof sal === 'object' && !Array.isArray(sal)) {
        const rows = Object.entries(sal as Record<string, unknown>).map(([cat, v]) => {
          const o = asRecord(v) ?? {}
          return {
            kategori: cat,
            snittLønnK: o.avgSalaryFemaleNok != null ? String(o.avgSalaryFemaleNok) : '—',
            snittLønnM: o.avgSalaryMaleNok != null ? String(o.avgSalaryMaleNok) : '—',
            andelPct: o.femaleShareOfMaleSalaryPct != null ? String(o.femaleShareOfMaleSalaryPct) : '—',
          }
        })
        if (rows.length)
          tables.push({
            id: 'sal',
            title: 'Lønnsgap etter kategori',
            columns: ['kategori', 'snittLønnK', 'snittLønnM', 'andelPct'],
            rows,
          })
      }
      const pl = asRecord(root.parentalLeave)
      if (pl) {
        if (pl.avgDaysFemale != null) kpis.push({ id: 'plf', label: 'Snitt foreldreperm (d) — kvinner', value: String(pl.avgDaysFemale) })
        if (pl.avgDaysMale != null) kpis.push({ id: 'plm', label: 'Snitt foreldreperm (d) — menn', value: String(pl.avgDaysMale) })
      }
      break
    }
    case 'sick_privacy': {
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(root)
          ? (root as unknown[])
          : []
      if (list.length && typeof list[0] === 'object') {
        tables.push({
          id: 'sick',
          title: 'Sykefravær per avdeling (k-anonymitet)',
          columns: ['department', 'sickLeaveCases', 'avgDurationDays', 'departmentHeadcount'],
          rows: list.slice(0, 30).map((x) => {
            const r = asRecord(x) ?? {}
            return {
              department: String(r.department ?? '—'),
              sickLeaveCases: num(r.sickLeaveCases) ?? '—',
              avgDurationDays: r.avgDurationDays != null ? String(r.avgDurationDays) : '—',
              departmentHeadcount: num(r.departmentHeadcount) ?? '—',
            }
          }),
        })
      } else {
        kpis.push({ id: 'none', label: 'Resultat', value: 'Ingen rader (for små avdelinger eller ingen data)' })
      }
      break
    }
    case 'training_incidents': {
      kpis.push(
        {
          id: 'inc',
          label: 'Hendelser i produksjon',
          value: num(root.incidentsInProduction) ?? 0,
        },
        {
          id: 'tr',
          label: 'Opplæringsregistreringer (produksjon)',
          value: num(root.trainingRecordsTaggedProduction) ?? 0,
        },
      )
      break
    }
    case 'cost_friction': {
      const est = num(root.estimatedCostNok)
      kpis.push(
        { id: 'cost', label: 'Estimert kostnad (NOK)', value: est != null ? est.toLocaleString('no-NO') : '—' },
        { id: 'sickd', label: 'Estimerte sykefraværsdager', value: String(root.estimatedSickLeaveDays ?? '—') },
        {
          id: 'incd',
          label: 'Illustrative hendelsesdager',
          value: String(root.illustrativeIncidentDowntimeDays ?? '—'),
        },
      )
      const items = [
        { label: 'Sykefravær (dager)', value: num(root.estimatedSickLeaveDays) ?? 0 },
        { label: 'Hendelse (dager)', value: num(root.illustrativeIncidentDowntimeDays) ?? 0 },
      ]
      bars.push({ id: 'cf', title: 'Dagsgrunnlag for kostnad', items })
      break
    }
    case 'compliance_score': {
      kpis.push({
        id: 'score',
        label: 'Samsvarspoeng',
        value: num(root.score) ?? '—',
        hint: String(root.hint ?? ''),
      })
      break
    }
    default:
      break
  }

  if (!kpis.length && !bars.length && !donuts.length && !tables.length) {
    kpis.push({ id: 'raw', label: 'Rapport lastet', value: 'Se JSON under eller eksporter', hint: 'Strukturen kan variere.' })
  }

  return { kpis, bars, donuts, tables }
}
