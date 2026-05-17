// useRiskDatasets — computes the risk scope's dataset map from flat
// snapshots of every existing risk-bearing data source. Called by
// RiskAnalysePage and HmsOverviewPage; filters are applied client-side
// so chip switching is instant with no round-trips.
//
// P1 (this file): aggregate-only — no `risk_register` table. We treat
// compliance findings, tasks (kind=avvik/nestenulykke/risiko/tiltak),
// inspection findings, deviations and alert cases as proto-risks. Each
// becomes a "row" with derived likelihood/consequence axes.
//
// P2 (future): swap the row construction for a single query against
// `risk_register_unified_v`. Dataset keys and shapes stay identical so
// widgets don't change.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import {
  HAZARD_CATEGORIES,
  PSYCHOSOCIAL_LAW_REFS,
  mapPriorityToConsequence,
  mapRecurrenceToLikelihood,
  mapSeverityToConsequence,
  riskBand,
  type HazardCategoryId,
  type RiskBand,
  type SourceSeverity,
} from './hazardCategories'

// ── Input snapshot shapes ────────────────────────────────────────────────
// Pages own the supabase fetches and pass only what we need. We keep the
// snapshot shapes narrow so this hook can be tested with literals.

export type ComplianceFindingSnapshot = {
  id: string
  executionId: string
  templateSlug: string | null
  severity: SourceSeverity | null
  isFinding: boolean
  itemKey: string
  lawRefs: string[]
  hazardCategory: HazardCategoryId | null
  departmentId: string | null
  departmentLabel: string | null
  locationId: string | null
  hasOpenAction: boolean
  createdAt: string
  updatedAt: string
}

export type RiskTaskSnapshot = {
  id: string
  title: string
  templateKind: 'avvik' | 'nestenulykke' | 'tiltak' | 'risiko' | 'oppgave' | 'forslag' | 'sykefravær' | null
  templateSlug: string | null
  priority: SourceSeverity
  status: 'todo' | 'in_progress' | 'done' | string
  closedAt: string | null
  createdAt: string
  lawRefs: string[]
  /** Optional ROS-style residual risk score (1..25) if known. */
  residualRiskScore: number | null
  /** Free-text justification when residual remains red. */
  residualJustification: string | null
  ownerUserId: string | null
  departmentId: string | null
  departmentLabel: string | null
  hazardCategory: HazardCategoryId | null
  /** True when this task has at least one child tiltak open. */
  hasOpenAction: boolean
}

export type DeviationSnapshot = {
  id: string
  title: string
  severity: SourceSeverity
  status: 'open' | 'in_progress' | 'closed' | string
  dueAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  departmentId: string | null
  departmentLabel: string | null
}

export type InspectionFindingSnapshot = {
  id: string
  roundId: string
  description: string
  severity: SourceSeverity
  deviationId: string | null
  createdAt: string
  departmentId: string | null
  departmentLabel: string | null
}

export type AlertCaseSnapshot = {
  id: string
  category: string
  severity: SourceSeverity | null
  status: string
  createdAt: string
  closedAt: string | null
  lawRefs: string[]
}

export type RiskDatasetsInput = {
  filters: DashboardFilter[]
  findings: ComplianceFindingSnapshot[]
  tasks: RiskTaskSnapshot[]
  deviations: DeviationSnapshot[]
  inspectionFindings: InspectionFindingSnapshot[]
  alerts: AlertCaseSnapshot[]
}

// ── Unified row — the shape every source folds into ─────────────────────
//
// Exported so the P2 view-backed hook (`useRiskUnifiedRows`) can build
// the same shape directly from `risk_register_summary_v` without
// re-implementing the row→dataset stage below.

export type RiskSource = 'checklist' | 'task' | 'deviation' | 'inspection' | 'alert' | 'ros' | 'sja'

// Backward-compat: the original P1 row type used `avvik | risiko` as
// task subtypes. The view emits `task` for both. Keep both decoded for
// the source filter chip.
export const RISK_SOURCE_LABELS: Record<RiskSource, string> = {
  checklist: 'Sjekkliste',
  task: 'Avvik / risiko',
  deviation: 'Avvikssak',
  inspection: 'Vernerunde',
  alert: 'Varsling',
  ros: 'ROS',
  sja: 'SJA',
}

export type UnifiedRiskRow = {
  id: string
  source: RiskSource
  sourceId: string
  title: string
  hazardCategory: HazardCategoryId
  /** 1..5 likelihood axis. */
  likelihood: 1 | 2 | 3 | 4 | 5
  /** 1..5 consequence axis. */
  consequence: 1 | 2 | 3 | 4 | 5
  /** likelihood × consequence ∈ 1..25 */
  riskScore: number
  band: RiskBand
  severityTier: SourceSeverity
  status: 'open' | 'in_progress' | 'mitigated' | 'closed'
  isOpen: boolean
  hasResidualJustification: boolean
  hasOpenAction: boolean
  lawRefs: string[]
  isPsychosocial: boolean
  departmentId: string | null
  departmentLabel: string
  ownerUserId: string | null
  createdAt: string
  /** Used for ageing — most recent activity timestamp. */
  lastReviewedAt: string
  closedAt: string | null
  /** True when severity ≥ critical / score ≥ 13 — the "red band" rows. */
  isRed: boolean
}

// ── Filter parsing ──────────────────────────────────────────────────────

type Selectors = {
  severityTiers: Set<string> | null
  likelihoodTiers: Set<number> | null
  consequenceTiers: Set<number> | null
  residualBands: Set<RiskBand> | null
  hazardCategories: Set<HazardCategoryId> | null
  statuses: Set<string> | null
  departments: Set<string> | null
  sources: Set<RiskSource> | null
  lawRefs: Set<string> | null
  from: Date | null
  to: Date | null
}

function asStrSet(v: unknown): Set<string> {
  if (Array.isArray(v)) return new Set(v.map(String))
  if (typeof v === 'string' && v) return new Set([v])
  return new Set()
}

function asNumSet(v: unknown): Set<number> {
  if (Array.isArray(v)) return new Set(v.map((x) => Number(x)).filter((x) => Number.isFinite(x)))
  if (typeof v === 'string' || typeof v === 'number') {
    const n = Number(v)
    return Number.isFinite(n) ? new Set([n]) : new Set()
  }
  return new Set()
}

function buildSelectors(filters: DashboardFilter[]): Selectors {
  const out: Selectors = {
    severityTiers: null, likelihoodTiers: null, consequenceTiers: null,
    residualBands: null, hazardCategories: null, statuses: null,
    departments: null, sources: null, lawRefs: null, from: null, to: null,
  }
  for (const f of filters) {
    switch (f.dimensionId) {
      case 'severityTier': out.severityTiers = asStrSet(f.value); break
      case 'likelihoodTier': out.likelihoodTiers = asNumSet(f.value); break
      case 'consequenceTier': out.consequenceTiers = asNumSet(f.value); break
      case 'residualBand': out.residualBands = asStrSet(f.value) as Set<RiskBand>; break
      case 'hazardCategory': out.hazardCategories = asStrSet(f.value) as Set<HazardCategoryId>; break
      case 'status': out.statuses = asStrSet(f.value); break
      case 'department': out.departments = asStrSet(f.value); break
      case 'source': out.sources = asStrSet(f.value) as Set<RiskSource>; break
      case 'lawRef': out.lawRefs = asStrSet(f.value); break
      case 'date':
      case 'dateRange':
        if (f.operator === 'between' && f.value && typeof f.value === 'object') {
          const r = f.value as { from?: string; to?: string }
          if (r.from) out.from = new Date(r.from)
          if (r.to) out.to = new Date(r.to)
        }
        break
      default: break
    }
  }
  return out
}

function applyFilters(rows: UnifiedRiskRow[], sel: Selectors): UnifiedRiskRow[] {
  if (
    !sel.severityTiers && !sel.likelihoodTiers && !sel.consequenceTiers &&
    !sel.residualBands && !sel.hazardCategories && !sel.statuses &&
    !sel.departments && !sel.sources && !sel.lawRefs && !sel.from && !sel.to
  ) return rows

  return rows.filter((r) => {
    if (sel.severityTiers?.size && !sel.severityTiers.has(r.severityTier)) return false
    if (sel.likelihoodTiers?.size && !sel.likelihoodTiers.has(r.likelihood)) return false
    if (sel.consequenceTiers?.size && !sel.consequenceTiers.has(r.consequence)) return false
    if (sel.residualBands?.size && !sel.residualBands.has(r.band)) return false
    if (sel.hazardCategories?.size && !sel.hazardCategories.has(r.hazardCategory)) return false
    if (sel.statuses?.size && !sel.statuses.has(r.status)) return false
    if (sel.departments?.size && !sel.departments.has(r.departmentId ?? '')) return false
    if (sel.sources?.size && !sel.sources.has(r.source)) return false
    if (sel.lawRefs?.size && !r.lawRefs.some((l) => sel.lawRefs!.has(l))) return false
    if (sel.from && new Date(r.createdAt) < sel.from) return false
    if (sel.to && new Date(r.createdAt) > sel.to) return false
    return true
  })
}

// ── Source → unified row converters ──────────────────────────────────────

function isPsychosocialFromRefs(refs: string[]): boolean {
  if (refs.length === 0) return false
  return refs.some((r) => (PSYCHOSOCIAL_LAW_REFS as readonly string[]).includes(r))
}

function deriveHazardCategory(
  explicit: HazardCategoryId | null,
  lawRefs: string[],
  templateSlug: string | null,
): HazardCategoryId {
  if (explicit) return explicit
  if (isPsychosocialFromRefs(lawRefs)) return 'psychosocial'
  if (templateSlug) {
    const s = templateSlug.toLowerCase()
    if (s.includes('psyk')) return 'psychosocial'
    if (s.includes('brann') || s.includes('beredskap') || s.includes('eksplos')) return 'fire'
    if (s.includes('kjem') || s.includes('chemical')) return 'chemical'
    if (s.includes('ergono')) return 'ergonomic'
    if (s.includes('elek')) return 'electrical'
    if (s.includes('miljo') || s.includes('miljø') || s.includes('environment')) return 'environmental'
  }
  return 'other'
}

function normaliseStatus(s: string): 'open' | 'in_progress' | 'mitigated' | 'closed' {
  if (s === 'closed' || s === 'done' || s === 'cancelled') return 'closed'
  if (s === 'in_progress' || s === 'triage' || s === 'investigation' || s === 'internal_review') return 'in_progress'
  if (s === 'mitigated' || s === 'effectiveness_verified') return 'mitigated'
  return 'open'
}

function findingToRow(
  f: ComplianceFindingSnapshot,
  recurrenceByTemplate: Map<string, number>,
): UnifiedRiskRow | null {
  if (!f.isFinding || !f.severity) return null
  const consequence = mapSeverityToConsequence(f.severity)
  const count = f.templateSlug ? recurrenceByTemplate.get(f.templateSlug) ?? 1 : 1
  const likelihood = mapRecurrenceToLikelihood(count)
  const score = likelihood * consequence
  const status = 'open' // findings without a closed_at column are considered open
  const hazard = deriveHazardCategory(f.hazardCategory, f.lawRefs, f.templateSlug)
  return {
    id: `checklist:${f.id}`,
    source: 'checklist',
    sourceId: f.id,
    title: f.itemKey,
    hazardCategory: hazard,
    likelihood, consequence, riskScore: score, band: riskBand(score),
    severityTier: f.severity,
    status, isOpen: true,
    hasResidualJustification: false,
    hasOpenAction: f.hasOpenAction,
    lawRefs: f.lawRefs,
    isPsychosocial: hazard === 'psychosocial' || isPsychosocialFromRefs(f.lawRefs),
    departmentId: f.departmentId,
    departmentLabel: f.departmentLabel ?? '(uten avdeling)',
    ownerUserId: null,
    createdAt: f.createdAt,
    lastReviewedAt: f.updatedAt,
    closedAt: null,
    isRed: score >= 13,
  }
}

function taskToRow(t: RiskTaskSnapshot): UnifiedRiskRow | null {
  if (!t.templateKind || !['avvik', 'nestenulykke', 'risiko', 'tiltak'].includes(t.templateKind)) return null
  const consequence = mapPriorityToConsequence(t.priority)
  const likelihood = t.templateKind === 'nestenulykke' ? 4 :
                     t.templateKind === 'avvik' ? 3 :
                     t.templateKind === 'tiltak' ? 2 : 3
  const explicitResidual = t.residualRiskScore ?? null
  const score = explicitResidual ?? likelihood * consequence
  const status = normaliseStatus(t.status)
  const hazard = deriveHazardCategory(t.hazardCategory, t.lawRefs, t.templateSlug)
  return {
    id: `task:${t.id}`,
    source: 'task',
    sourceId: t.id,
    title: t.title,
    hazardCategory: hazard,
    likelihood, consequence, riskScore: score, band: riskBand(score),
    severityTier: t.priority,
    status, isOpen: status !== 'closed',
    hasResidualJustification: (t.residualJustification?.trim().length ?? 0) >= 10,
    hasOpenAction: t.hasOpenAction,
    lawRefs: t.lawRefs,
    isPsychosocial: hazard === 'psychosocial' || isPsychosocialFromRefs(t.lawRefs),
    departmentId: t.departmentId,
    departmentLabel: t.departmentLabel ?? '(uten avdeling)',
    ownerUserId: t.ownerUserId,
    createdAt: t.createdAt,
    lastReviewedAt: t.createdAt, // tasks have no last-review; close enough for ageing
    closedAt: t.closedAt,
    isRed: score >= 13,
  }
}

function deviationToRow(d: DeviationSnapshot): UnifiedRiskRow {
  const consequence = mapSeverityToConsequence(d.severity)
  const likelihood: 1 | 2 | 3 | 4 | 5 = 3 // single deviation, default middle
  const score = likelihood * consequence
  const status = normaliseStatus(d.status)
  return {
    id: `deviation:${d.id}`,
    source: 'deviation',
    sourceId: d.id,
    title: d.title,
    hazardCategory: 'other',
    likelihood, consequence, riskScore: score, band: riskBand(score),
    severityTier: d.severity,
    status, isOpen: status !== 'closed',
    hasResidualJustification: false,
    hasOpenAction: status !== 'closed',
    lawRefs: [],
    isPsychosocial: false,
    departmentId: d.departmentId,
    departmentLabel: d.departmentLabel ?? '(uten avdeling)',
    ownerUserId: null,
    createdAt: d.createdAt,
    lastReviewedAt: d.updatedAt,
    closedAt: d.closedAt,
    isRed: score >= 13,
  }
}

function inspectionToRow(f: InspectionFindingSnapshot): UnifiedRiskRow {
  const consequence = mapSeverityToConsequence(f.severity)
  const likelihood: 1 | 2 | 3 | 4 | 5 = 2
  const score = likelihood * consequence
  return {
    id: `inspection:${f.id}`,
    source: 'inspection',
    sourceId: f.id,
    title: f.description,
    hazardCategory: 'other',
    likelihood, consequence, riskScore: score, band: riskBand(score),
    severityTier: f.severity,
    status: f.deviationId ? 'in_progress' : 'open',
    isOpen: true,
    hasResidualJustification: false,
    hasOpenAction: f.deviationId !== null,
    lawRefs: [],
    isPsychosocial: false,
    departmentId: f.departmentId,
    departmentLabel: f.departmentLabel ?? '(uten avdeling)',
    ownerUserId: null,
    createdAt: f.createdAt,
    lastReviewedAt: f.createdAt,
    closedAt: null,
    isRed: score >= 13,
  }
}

function alertToRow(a: AlertCaseSnapshot): UnifiedRiskRow | null {
  if (!a.severity) return null
  const consequence = mapSeverityToConsequence(a.severity)
  const likelihood: 1 | 2 | 3 | 4 | 5 = 2
  const score = likelihood * consequence
  const status = normaliseStatus(a.status)
  const isPsy = isPsychosocialFromRefs(a.lawRefs) || a.category.toLowerCase().includes('trakass') || a.category.toLowerCase().includes('psyk')
  return {
    id: `alert:${a.id}`,
    source: 'alert',
    sourceId: a.id,
    title: a.category,
    hazardCategory: isPsy ? 'psychosocial' : 'other',
    likelihood, consequence, riskScore: score, band: riskBand(score),
    severityTier: a.severity,
    status, isOpen: status !== 'closed',
    hasResidualJustification: false,
    hasOpenAction: status !== 'closed',
    lawRefs: a.lawRefs,
    isPsychosocial: isPsy,
    departmentId: null,
    departmentLabel: '(uten avdeling)',
    ownerUserId: null,
    createdAt: a.createdAt,
    lastReviewedAt: a.createdAt,
    closedAt: a.closedAt,
    isRed: score >= 13,
  }
}

// ── Dataset construction helpers ────────────────────────────────────────

function monthKey(iso: string): string { return iso.slice(0, 7) }

function last12Months(): string[] {
  const months: string[] = []
  const d = new Date()
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function segmentsByCategory(rows: UnifiedRiskRow[]): Array<{ id: string; label: string; value: number }> {
  const counts = new Map<HazardCategoryId, number>()
  for (const r of rows) counts.set(r.hazardCategory, (counts.get(r.hazardCategory) ?? 0) + 1)
  return HAZARD_CATEGORIES
    .map((c) => ({ id: c.id, label: c.labelNb, value: counts.get(c.id) ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
}

function buildMatrixCells(rows: UnifiedRiskRow[]) {
  const cells: number[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))
  for (const r of rows) {
    cells[r.likelihood - 1]![r.consequence - 1]! += 1
  }
  return {
    rows: ['1', '2', '3', '4', '5'],
    columns: ['1', '2', '3', '4', '5'],
    cells,
  }
}

function buildTop10(rows: UnifiedRiskRow[]) {
  const top = [...rows]
    .filter((r) => r.isOpen)
    .sort((a, b) => b.riskScore - a.riskScore || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    .slice(0, 10)
  if (top.length === 0) return []

  const rowsOut = top.map((r) => {
    let status: 'covered' | 'partial' | 'only_avvik' | 'uncovered'
    if (r.band === 'red' && !r.hasResidualJustification) status = 'uncovered'
    else if (r.hasOpenAction) status = 'partial'
    else if (r.band === 'green') status = 'covered'
    else status = 'only_avvik'
    return {
      id: r.id,
      label: r.title,
      title: `${RISK_SOURCE_LABELS[r.source]} · S=${r.likelihood} K=${r.consequence} · Score ${r.riskScore}`,
      applies: r.isOpen,
      obligation: r.lawRefs[0] ?? '',
      status,
    }
  })

  return [{
    category: 'Topp 10 risikoer (etter restrisiko)',
    total: rowsOut.length,
    covered: rowsOut.filter((r) => r.status === 'covered').length,
    partial: rowsOut.filter((r) => r.status === 'partial').length,
    needsAttention: rowsOut.filter((r) => r.status === 'uncovered').length,
    rows: rowsOut,
  }]
}

function buildAgeingDistribution(rows: UnifiedRiskRow[]) {
  const now = new Date().getTime()
  const buckets = [
    { id: '0-3m', label: '< 3 mnd', cap: 3 * 30 * 86400_000 },
    { id: '3-6m', label: '3–6 mnd', cap: 6 * 30 * 86400_000 },
    { id: '6-12m', label: '6–12 mnd', cap: 12 * 30 * 86400_000 },
    { id: '12m+', label: '> 12 mnd', cap: Number.POSITIVE_INFINITY },
  ]
  const counts = new Map(buckets.map((b) => [b.id, 0]))
  for (const r of rows.filter((x) => x.isOpen)) {
    const ageMs = now - new Date(r.lastReviewedAt).getTime()
    for (const b of buckets) {
      if (ageMs <= b.cap) { counts.set(b.id, (counts.get(b.id) ?? 0) + 1); break }
    }
  }
  return buckets.map((b) => ({ id: b.id, label: b.label, value: counts.get(b.id) ?? 0 }))
}

// ── Row construction (P1 source-fold path) ──────────────────────────────
//
// Exported as a pure function so tests can hit it without the hook
// machinery, and so the P2 view-backed hook can choose to use either:
// fold its own source arrays (fallback), or build UnifiedRiskRow[]
// directly from the view payload and skip this stage entirely.

export function foldSourcesToRows(input: Omit<RiskDatasetsInput, 'filters'>): UnifiedRiskRow[] {
  const { findings, tasks, deviations, inspectionFindings, alerts } = input
  const recurrenceByTemplate = new Map<string, number>()
  for (const f of findings) {
    if (!f.templateSlug || !f.isFinding) continue
    recurrenceByTemplate.set(f.templateSlug, (recurrenceByTemplate.get(f.templateSlug) ?? 0) + 1)
  }
  const rowsRaw: UnifiedRiskRow[] = []
  for (const f of findings) {
    const r = findingToRow(f, recurrenceByTemplate)
    if (r) rowsRaw.push(r)
  }
  for (const t of tasks) {
    const r = taskToRow(t)
    if (r) rowsRaw.push(r)
  }
  for (const d of deviations) rowsRaw.push(deviationToRow(d))
  for (const f of inspectionFindings) rowsRaw.push(inspectionToRow(f))
  for (const a of alerts) {
    const r = alertToRow(a)
    if (r) rowsRaw.push(r)
  }
  return rowsRaw
}

// ── Row → dataset map (shared by both P1 and P2 paths) ──────────────────

export function buildRiskDatasets(
  rowsRaw: UnifiedRiskRow[],
  filters: DashboardFilter[],
): Record<string, unknown> {
    const sel = buildSelectors(filters)
    const rows = applyFilters(rowsRaw, sel)

    // ── KPI summary ──
    const now = new Date().getTime()
    const STALE_MS = 365 * 86400_000
    const openRows = rows.filter((r) => r.isOpen)
    const redRows = rows.filter((r) => r.band === 'red')
    const residualUnjustified = redRows.filter((r) => !r.hasResidualJustification && r.isOpen).length
    const staleOver12m = openRows.filter((r) => now - new Date(r.lastReviewedAt).getTime() > STALE_MS).length
    const psychosocialOpen = openRows.filter((r) => r.isPsychosocial).length
    const criticalAvvikLinked = redRows.filter((r) => r.hasOpenAction && r.isOpen).length

    const kpiSummary = {
      openRisks: openRows.length,
      redBand: redRows.filter((r) => r.isOpen).length,
      yellowBand: openRows.filter((r) => r.band === 'yellow').length,
      greenBand: openRows.filter((r) => r.band === 'green').length,
      residualUnjustified,
      staleOver12m,
      avgScore: openRows.length === 0 ? 0 : Math.round((openRows.reduce((s, r) => s + r.riskScore, 0) / openRows.length) * 10) / 10,
      psychosocialOpen,
      criticalAvvikLinked,
    }

    // ── Distributions ──
    const byCategory = segmentsByCategory(openRows)
    const psyCount = openRows.filter((r) => r.isPsychosocial).length
    const psychosocialShare = [
      { id: 'psychosocial', label: 'Psykososial', value: psyCount },
      { id: 'other', label: 'Annet', value: openRows.length - psyCount },
    ].filter((s) => s.value > 0)

    const deptCounts = new Map<string, number>()
    for (const r of openRows) deptCounts.set(r.departmentLabel, (deptCounts.get(r.departmentLabel) ?? 0) + 1)
    const byDepartment = [...deptCounts.entries()]
      .map(([label, value]) => ({ id: label, label, value }))
      .sort((a, b) => b.value - a.value)

    const sourceCounts = new Map<RiskSource, number>()
    for (const r of openRows) sourceCounts.set(r.source, (sourceCounts.get(r.source) ?? 0) + 1)
    const bySource = [...sourceCounts.entries()]
      .map(([s, value]) => ({ id: s, label: RISK_SOURCE_LABELS[s], value }))
      .sort((a, b) => b.value - a.value)

    const SEVERITY_LABEL: Record<SourceSeverity, string> = {
      low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk',
    }
    const sevCounts = new Map<SourceSeverity, number>()
    for (const r of openRows) sevCounts.set(r.severityTier, (sevCounts.get(r.severityTier) ?? 0) + 1)
    const severityDist = (['critical', 'high', 'medium', 'low'] as SourceSeverity[])
      .map((s) => ({ id: s, label: SEVERITY_LABEL[s], value: sevCounts.get(s) ?? 0 }))
      .filter((s) => s.value > 0)

    const BAND_LABEL: Record<RiskBand, string> = { green: 'Akseptabel (1–6)', yellow: 'Moderat (7–12)', red: 'Uakseptabel (13–25)' }
    const bandCounts = new Map<RiskBand, number>()
    for (const r of openRows) bandCounts.set(r.band, (bandCounts.get(r.band) ?? 0) + 1)
    const residualBandDist = (['red', 'yellow', 'green'] as RiskBand[])
      .map((b) => ({ id: b, label: BAND_LABEL[b], value: bandCounts.get(b) ?? 0 }))
      .filter((s) => s.value > 0)

    // ── Control effectiveness (heuristic) ──
    // effective = closed; partial = open with action; ineffective = open
    // without action and red; unknown = otherwise.
    let eff = 0, partial = 0, ineff = 0, unknown = 0
    for (const r of rows) {
      if (!r.isOpen) eff += 1
      else if (r.hasOpenAction) partial += 1
      else if (r.band === 'red') ineff += 1
      else unknown += 1
    }
    const controlEffectiveness = [
      { id: 'effective', label: 'Effektiv (lukket)', value: eff },
      { id: 'partial', label: 'Delvis (tiltak pågår)', value: partial },
      { id: 'ineffective', label: 'Ineffektiv (rød uten tiltak)', value: ineff },
      { id: 'unknown', label: 'Ukjent', value: unknown },
    ].filter((s) => s.value > 0)

    // ── Action plan coverage ──
    const withPlan = openRows.filter((r) => r.hasOpenAction).length
    const withoutPlan = openRows.length - withPlan
    const actionPlanCoverage = [
      { id: 'withPlan', label: 'Har åpent tiltak', value: withPlan },
      { id: 'withoutPlan', label: 'Mangler tiltak', value: withoutPlan },
    ].filter((s) => s.value > 0)

    // ── Time-to-mitigation trend (avvik median, last 12 months) ──
    const months = last12Months()
    const closedDaysByMonth = new Map<string, number[]>(months.map((m) => [m, []]))
    for (const r of rows) {
      if (r.source !== 'task' || !r.closedAt) continue
      const m = monthKey(r.closedAt)
      const list = closedDaysByMonth.get(m)
      if (!list) continue
      const days = (new Date(r.closedAt).getTime() - new Date(r.createdAt).getTime()) / 86400_000
      list.push(days)
    }
    const median = (xs: number[]): number => {
      if (xs.length === 0) return 0
      const s = [...xs].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 === 0 ? Math.round(((s[mid - 1]! + s[mid]!) / 2) * 10) / 10 : s[mid]!
    }
    const timeToMitigation = months.map((m) => ({ label: m, value: median(closedDaysByMonth.get(m) ?? []) }))

    // ── Ageing distribution ──
    const ageingDist = buildAgeingDistribution(rows)

    // ── Top-10 scorecard ──
    const top10 = buildTop10(rows)

    // ── Bowtie top hazards (P2 + Sveitserost layering) ──
    // The bowtie renderer expects `byKind` keyed by the engine's axis
    // ids (course_system / document / checklist_item / survey /
    // meeting_template on the preventive side, `task` on the reactive
    // side). We compute counts per hazard category from the unified
    // rows + (where available) the linked tasks. A row is `proof`-fresh
    // when at least one mitigating task is open — that's the same
    // signal `is_red_without_action` inverts.
    //
    // The status pill ('covered' / 'partial' / 'only_avvik' /
    // 'uncovered') drives the colour: covered = fully justified,
    // partial = mitigating action present, only_avvik = reactive-only
    // (Sveitserost cheese-hole), uncovered = no barriers at all.
    const top5Red = [...rows]
      .filter((r) => r.isOpen && r.band === 'red')
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5)
    const bowtieRows = top5Red.map((r) => {
      // Preventive: count source rows in the same hazard category that
      // act as barriers. Checklists are the strongest preventive
      // signal we have today; ROS/SJA hazards are "known and assessed"
      // which also counts as a preventive layer.
      const checklistItem = rowsRaw.filter(
        (x) => x.source === 'checklist' && x.hazardCategory === r.hazardCategory,
      ).length
      const rosAssessed = rowsRaw.filter(
        (x) => (x.source === 'ros' || x.source === 'sja') && x.hazardCategory === r.hazardCategory,
      ).length
      // Reactive: open tasks in the same hazard category (CAPA loop).
      const taskCount = rowsRaw.filter(
        (x) => x.source === 'task' && x.hazardCategory === r.hazardCategory && x.isOpen,
      ).length

      // Sveitserost cell colouring:
      //   covered    — at least one preventive AND at least one reactive
      //                (defence in depth — no hole)
      //   partial    — preventive only (mitigation pending)
      //   only_avvik — reactive only (cheese-hole on preventive side)
      //   uncovered  — no barriers at all (open red with nothing)
      const hasPreventive = checklistItem + rosAssessed > 0
      const hasReactive = taskCount > 0 || r.hasOpenAction
      const status: 'covered' | 'partial' | 'only_avvik' | 'uncovered' =
        hasPreventive && hasReactive ? 'covered' :
        hasPreventive ? 'partial' :
        hasReactive ? 'only_avvik' : 'uncovered'

      // The renderer treats AML-tagged rows as 'mandatory' for the
      // consequence column. Default to mandatory for red rows since the
      // inspector would treat any red residual as non-compliant.
      const obligation: 'mandatory' | 'recommended' | 'conditional' =
        r.lawRefs.some((ref) => ref.startsWith('AML') || ref.startsWith('IK-f')) ? 'mandatory' :
        r.isPsychosocial ? 'mandatory' : 'recommended'

      return {
        id: r.id,
        label: r.title,
        title: `${RISK_SOURCE_LABELS[r.source]} · Score ${r.riskScore}${r.lawRefs[0] ? ` · ${r.lawRefs[0]}` : ''}`,
        applies: 'true',
        obligation,
        status,
        byKind: {
          checklist_item: checklistItem,
          // ros/sja rows count as a checklist-style preventive layer.
          checklist_template: rosAssessed,
          task: taskCount,
        },
        // `proof.freshInstances > 0` flips the cell border green in
        // the renderer. We use mitigating task presence as the freshness
        // signal — if there's an open task, the org is actively
        // addressing the hazard.
        proof: { freshInstances: hasReactive ? taskCount : 0 },
      }
    })
    const bowtieTop = bowtieRows.length === 0 ? [] : [{
      category: 'Topp 5 røde risikoer (bowtie)',
      total: bowtieRows.length,
      // None of the top-5 red rows can be in the 'covered' bucket
      // (covered implies green band), so this stays 0 — kept for the
      // scorecard shape contract.
      covered: 0,
      partial: bowtieRows.filter((r) => r.status === 'partial').length,
      needsAttention: bowtieRows.filter((r) => r.status === 'uncovered').length,
      rows: bowtieRows,
    }]

    return {
      risk_kpi_summary: kpiSummary,
      risk_matrix_cells: buildMatrixCells(openRows),
      risk_top10_scorecard: top10,
      risk_bowtie_top: bowtieTop,
      risk_by_hazard_category: byCategory,
      risk_psychosocial_share: psychosocialShare,
      risk_by_department: byDepartment,
      risk_by_source: bySource,
      risk_severity_distribution: severityDist,
      risk_residual_band: residualBandDist,
      risk_time_to_mitigation_trend: timeToMitigation,
      risk_control_effectiveness: controlEffectiveness,
      risk_action_plan_coverage: actionPlanCoverage,
      risk_ageing_distribution: ageingDist,
    }
}

// ── The hook (P1 source-fold path) ──────────────────────────────────────
//
// Memoises the row-fold + dataset compute. Both stages are pure
// functions exported above, so a P2 caller that already has rows from
// the unified view can call `buildRiskDatasets(rows, filters)` directly
// without re-folding source snapshots.

export function useRiskDatasets(input: RiskDatasetsInput): Record<string, unknown> {
  const { filters, findings, tasks, deviations, inspectionFindings, alerts } = input
  return useMemo(
    () => buildRiskDatasets(
      foldSourcesToRows({ findings, tasks, deviations, inspectionFindings, alerts }),
      filters,
    ),
    [filters, findings, tasks, deviations, inspectionFindings, alerts],
  )
}
