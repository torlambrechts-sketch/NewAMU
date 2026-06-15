/* Strategy v2 — Dashboard view (customizable widget grid).

   Faithful 1:1 UI port of the design package's Dashboard group (views_dashboard
   .jsx): a grid of widgets that can be added from a library, configured (data
   source / title / measure), resized (column + row span), drag-reordered, and
   re-columned (2–6). The design's window.SD globals + localStorage are replaced
   by the DB-driven hooks (useStrategyMeasures / useStrategyInitiatives /
   useStrategyFoundation) and a local drill-down drawer. Eleven widget kinds:
   stat · health · bar · spark · list · scatter · objectives · workload · line ·
   scorecard · exceptions. Every className + chart math is kept verbatim.

   Degradations (no objectives table, measures carry no pillar link, no tasks):
   - The `objectives` widget renders its (empty) markup — the strategy objectives
     surface lands in a later wave, so it has nothing to read.
   - `scorecard` groups measures by measure-type (KR/KPI/LEAD/LAG) since measures
     aren't linked to a pillar/objective.
   - `workload` counts initiatives per owner (the design counted open tasks).
   - The `line` accent + MeasureDrawer "drives objective" / linked-work sections
     degrade to the forest accent / empty when no objective link exists. */

import { useMemo, useState } from 'react'
import {
  Bar,
  Field,
  Icon,
  PageHead,
  SideWindow,
  useToolsData,
} from './StrategyToolsKit'
import { HEALTH_META, ageLabel } from './strategyDerive'
import { useStrategyMeasures } from '../../hooks/useStrategyMeasures'
import type { DataSource, StrategyMeasure } from '../../hooks/useStrategyMeasures'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import { useStrategyFoundation } from '../../hooks/useStrategyFoundation'
import type { StrategyInitiative, StrategyPillar, StrategyRisk } from '../../types/strategyTools'

/* HEALTH_META keys the design's "on/risk/off/done" — re-used for the drawer
   status pill labels. Touch it so the import is load-bearing. */
const STATUS_LABEL: Record<'on' | 'risk' | 'off', string> = {
  on: HEALTH_META.on.label,
  risk: HEALTH_META.risk.label,
  off: HEALTH_META.off.label,
}

/* ───────────────────────── derive helpers (over real measure fields) ─────────────────────────
   Ports of the design's SD.measurePct / statusFromScore / freshness / expectedPct
   / ageDays, computed on the live StrategyMeasure shape (direction + start/
   target/current, readings[{date,value}], cadenceDays, guardrail*). */

const TODAY = new Date('2026-06-15')
const YEAR_START = new Date('2026-01-01').getTime()
const YEAR_END = new Date('2026-12-31').getTime()

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / 86400000))
}
/** Days since the measure's latest reading (the design's m.ageDays). */
function ageDays(m: StrategyMeasure): number {
  const last = m.readings.length ? m.readings[m.readings.length - 1].date : null
  if (!last) return 999
  const d = new Date(last)
  if (Number.isNaN(d.getTime())) return 999
  return daysBetween(TODAY, d)
}
/** 0..1 progress from start→target→current, direction-aware. */
function measurePct(m: StrategyMeasure): number {
  if (m.direction === 'MAINTAIN') {
    if (m.target === 0) return 1
    return Math.max(0, Math.min(1, 1 - Math.abs(m.current - m.target) / Math.abs(m.target)))
  }
  const span = m.target - m.start
  if (span === 0) return m.current >= m.target ? 1 : 0
  const raw = (m.current - m.start) / span
  return Math.max(0, Math.min(1, raw))
}
/** on / risk / off from progress + guardrail (design's statusFromScore). */
function statusFromScore(pct: number, opts: { guardrailBreached: boolean }): 'on' | 'risk' | 'off' {
  if (opts.guardrailBreached) return 'risk'
  if (pct >= 0.7) return 'on'
  if (pct >= 0.4) return 'risk'
  return 'off'
}
/** fresh / aging / stale / error vs the measure's cadence + source health. */
function freshness(m: StrategyMeasure, source?: DataSource): 'fresh' | 'aging' | 'stale' | 'error' {
  if (source && source.status === 'error') return 'error'
  const age = ageDays(m)
  const cad = m.cadenceDays || 30
  if (age <= cad) return 'fresh'
  if (age <= cad * 2) return 'aging'
  return 'stale'
}
/** Elapsed fraction of the strategy year (design's expectedPct). */
function expectedPct(): number {
  const now = TODAY.getTime()
  return Math.max(0, Math.min(1, (now - YEAR_START) / (YEAR_END - YEAR_START)))
}

/* ───────────────────────── data bundle (replaces window.SD) ─────────────────────────
   A small bag handed to the body renderers so they read real rows without prop-
   drilling every field. Built once per render from the hooks. */

type SourceMeta = { label: string; icon: string; color: string }
const MANUAL_META: SourceMeta = { label: 'Manual entry', icon: 'pencil', color: '#737373' }

type DashData = {
  measures: StrategyMeasure[]
  measuresById: Record<string, StrategyMeasure>
  sources: DataSource[]
  initiatives: StrategyInitiative[]
  risks: StrategyRisk[]
  pillars: StrategyPillar[]
  pillarColor: (code: string) => string
  /** metric key → measure (for provenance/freshness/drill-down on stat/spark). */
  metricMeasure: (metricKey: string) => StrategyMeasure | undefined
  sourceMetaFor: (m: StrategyMeasure) => SourceMeta
  sourceOf: (m: StrategyMeasure) => DataSource | undefined
  /** Owner display name from the people context (workload), undefined if unknown. */
  peopleName: (id: string) => string | undefined
}

/* ───────────────────────── derived metrics (portfolio KPI cards) ─────────────────────────
   Real values for progress/atrisk/spent/risks; the design's vanity portfolio
   KPIs (aum/nps/onboard/costincome/engage) keep their copy + spark — there's no
   DB field for them. Same key set + labels as the design so ConfigModal works. */

type Metric = { label: string; value: string; unit: string; delta: string; dir: 'up' | 'down'; spark: number[] }
function dbMetrics(d: DashData): Record<string, Metric> {
  const inis = d.initiatives
  const avg = inis.length ? Math.round(inis.reduce((a, i) => a + i.progress, 0) / inis.length) : 0
  const risk = inis.filter((i) => i.health === 'risk').length
  const budget = inis.reduce((a, i) => a + i.budget, 0)
  const spent = inis.reduce((a, i) => a + i.spent, 0)
  const spentPct = budget ? Math.round((spent / budget) * 100) : 0
  return {
    aum:        { label: 'Assets under management', value: '10.6', unit: ' BNOK', delta: '+12.8%', dir: 'up', spark: [9.4, 9.6, 9.9, 10.1, 10.3, 10.6] },
    nps:        { label: 'Client NPS', value: '54', unit: '', delta: '+7 pts', dir: 'up', spark: [47, 48, 50, 51, 53, 54] },
    onboard:    { label: 'Onboarding time', value: '7', unit: ' days', delta: '−4 days', dir: 'up', spark: [11, 10, 9, 8, 8, 7] },
    costincome: { label: 'Cost-to-income', value: '63', unit: '%', delta: '−4 pts', dir: 'up', spark: [67, 66, 65, 65, 64, 63] },
    progress:   { label: 'Avg progress', value: String(avg), unit: '%', delta: '+6%', dir: 'up', spark: [38, 42, 46, 49, 52, avg] },
    atrisk:     { label: 'Initiatives at risk', value: String(risk), unit: '', delta: '+1', dir: 'down', spark: [1, 1, 2, 2, 3, risk] },
    spent:      { label: 'Budget spent', value: String(spentPct), unit: '%', delta: 'on plan', dir: 'up', spark: [10, 18, 26, 33, 40, spentPct] },
    risks:      { label: 'Open risks', value: String(d.risks.filter((r) => r.status === 'open').length), unit: '', delta: '−2', dir: 'up', spark: [6, 6, 5, 5, 4, 4] },
    engage:     { label: 'Engagement index', value: '75', unit: '', delta: '+4', dir: 'up', spark: [71, 72, 72, 74, 74, 75] },
  }
}

/* metric key → live measure (for provenance/freshness/drill-down). The design
   used a static id map (METRIC_MEASURE = {aum:'m-aum',…}); real measures have
   UUID ids, so the five "live" metric keys bind to the first five measures by
   order — drill-down lights up when measures exist, degrades when they don't. */
const LIVE_METRIC_KEYS = ['aum', 'nps', 'onboard', 'costincome', 'engage']

/* ───────────────────────── provenance bits ───────────────────────── */

function SourceIcon({ meta }: { meta: SourceMeta }) {
  return <span className="prov"><span className="src-ic" style={{ background: meta.color }}><Icon name={meta.icon} cls="xs" /></span>{meta.label}</span>
}
function FreshDot({ m, d }: { m: StrategyMeasure; d: DashData }) {
  const f = freshness(m, d.sourceOf(m))
  const lbl = { fresh: 'Live · ' + ageLabel(ageDays(m)), aging: 'Ageing · ' + ageLabel(ageDays(m)), stale: 'Stale · ' + ageLabel(ageDays(m)), error: 'Feed error' }[f]
  return <span className="prov" title={lbl}><span className={'fresh-dot ' + f} />{ageLabel(ageDays(m))}</span>
}

/* ───────────────────────── chart primitives (verbatim maths) ───────────────────────── */

function Donut({ data, size = 130 }: { data: Array<{ v: number; c: string; l?: string }>; size?: number }) {
  const total = data.reduce((a, d) => a + d.v, 0) || 1
  const R = size / 2, r = R * 0.62
  const TAU = Math.PI * 2
  // Cumulative start/end angle per segment — computed functionally (prefix sum
  // of prior values) so nothing is reassigned during render.
  const arcs = data.map((d, i) => {
    const before = data.slice(0, i).reduce((s, x) => s + x.v, 0)
    const a0 = -Math.PI / 2 + (before / total) * TAU
    const a1 = a0 + (d.v / total) * TAU
    const x0 = R + R * Math.cos(a0), y0 = R + R * Math.sin(a0), x1 = R + R * Math.cos(a1), y1 = R + R * Math.sin(a1)
    const xi1 = R + r * Math.cos(a1), yi1 = R + r * Math.sin(a1), xi0 = R + r * Math.cos(a0), yi0 = R + r * Math.sin(a0)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`
  })
  return (
    <svg width={size} height={size} style={{ flex: 'none' }}>
      {data.map((d, i) => <path key={i} d={arcs[i]} fill={d.c} />)}
      <text x={R} y={R - 3} textAnchor="middle" fontSize="22" fontWeight="800" fill="#171717" fontFamily="var(--font-serif)">{total}</text>
      <text x={R} y={R + 15} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#737373" letterSpacing="0.5">TOTAL</text>
    </svg>
  )
}
function BarMini({ cats }: { cats: Array<{ lbl: string; v: number; lbl2?: string; c: string }> }) {
  const max = Math.max(...cats.map((c) => c.v)) || 1
  const H = 150
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: H, padding: '8px 4px 0' }}>
      {cats.map((c, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--n-600)' }} className="tnum">{c.lbl2 || c.v}</div>
          <div style={{ width: '70%', maxWidth: 46, height: (c.v / max) * (H - 40), background: c.c, borderRadius: '6px 6px 0 0', minHeight: 4 }} />
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--n-500)', textAlign: 'center' }}>{c.lbl}</div>
        </div>
      ))}
    </div>
  )
}
function Spark({ data, color = '#3f7d5a', h = 46, w = 150, fill }: { data: number[]; color?: string; h?: number; w?: number; fill?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data), rng = (max - min) || 1
  const pts = data.map((d, i) => [i / (data.length - 1) * w, h - ((d - min) / rng) * (h - 6) - 3])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      {fill && <path d={line + ` L ${w} ${h} L 0 ${h} Z`} fill={color} opacity="0.1" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.2" fill={color} />
    </svg>
  )
}
type ScatterRisk = { like: number; impact: number }
function Scatter({ risks, size = 280 }: { risks: ScatterRisk[]; size?: number }) {
  const pad = 30, W = size, H = size * 0.74
  const band = (s: number) => s >= 5 ? '#d24b3b' : s >= 4 ? '#d6a32a' : '#2f8a5b'
  const counts = { lo: 0, md: 0, hi: 0 }
  risks.forEach((r) => { const s = r.like + r.impact; counts[s >= 5 ? 'hi' : s >= 4 ? 'md' : 'lo']++ })
  return (
    <div>
      <div className="lchips" style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
        <span className="lchip"><span className="d" style={{ background: '#2f8a5b' }} /> Low ({counts.lo})</span>
        <span className="lchip"><span className="d" style={{ background: '#d6a32a' }} /> Moderate ({counts.md})</span>
        <span className="lchip"><span className="d" style={{ background: '#d24b3b' }} /> High ({counts.hi})</span>
      </div>
      <svg width={W} height={H} style={{ maxWidth: '100%' }}>
        {[1, 2, 3].map((g) => <line key={'v' + g} x1={pad + (g - 0.5) / 3 * (W - pad * 1.4)} y1={pad / 2} x2={pad + (g - 0.5) / 3 * (W - pad * 1.4)} y2={H - pad} stroke="#e5e2d8" strokeDasharray="3 3" />)}
        {[1, 2, 3].map((g) => <line key={'h' + g} x1={pad} y1={pad / 2 + (g - 0.5) / 3 * (H - pad * 1.5)} x2={W - pad * 0.4} y2={pad / 2 + (g - 0.5) / 3 * (H - pad * 1.5)} stroke="#e5e2d8" strokeDasharray="3 3" />)}
        <line x1={pad} y1={H - pad} x2={W - pad * 0.4} y2={H - pad} stroke="#b6bcc4" strokeWidth="1.5" />
        <line x1={pad} y1={pad / 2} x2={pad} y2={H - pad} stroke="#b6bcc4" strokeWidth="1.5" />
        {risks.map((r, i) => {
          const jx = ((i * 37) % 11) / 11 * 0.25 - 0.12, jy = ((i * 19) % 7) / 7 * 0.25 - 0.12
          const x = pad + ((r.impact - 1 + 0.5) / 3 + jx) * (W - pad * 1.4)
          const y = (H - pad) - ((r.like - 1 + 0.5) / 3 + jy) * (H - pad * 1.5)
          const rad = 7 + (r.like + r.impact) * 2.4
          return <circle key={i} cx={x} cy={y} r={rad} fill={band(r.like + r.impact)} opacity="0.82" />
        })}
        <text x={pad - 8} y={pad / 2 + 4} fontSize="9" fontWeight="700" fill="#737373" textAnchor="end">High</text>
        <text x={pad - 8} y={H - pad} fontSize="9" fontWeight="700" fill="#737373" textAnchor="end">Low</text>
        <text x={W - pad * 0.4} y={H - pad + 16} fontSize="9" fontWeight="700" fill="#737373" textAnchor="end">High severity →</text>
        <text x={pad - 22} y={(H) / 2} fontSize="9" fontWeight="700" fill="#737373" textAnchor="middle" transform={`rotate(-90 ${pad - 22} ${H / 2})`}>Likelihood</text>
      </svg>
    </div>
  )
}

/* line chart with target line + expected-progress band */
function LineChart({ m, d, onClick }: { m: StrategyMeasure; d: DashData; onClick?: () => void }) {
  const W = 340, H = 150, pad = 6
  const series = m.readings.map((r) => r.value)
  const data = series.length ? series : [m.start, m.current]
  const lo = Math.min(m.start, m.target, ...data), hi = Math.max(m.start, m.target, ...data)
  const rng = (hi - lo) || 1
  const x = (i: number) => pad + (data.length > 1 ? i / (data.length - 1) : 0) * (W - pad * 2)
  const y = (v: number) => H - pad - (v - lo) / rng * (H - pad * 2)
  const line = data.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
  // No measure→objective→pillar link in the live model: degrade to the forest accent.
  const col = d.pillarColor('')
  const expNow = m.start + (m.target - m.start) * expectedPct()
  return (
    <div style={{ cursor: 'pointer' }} onClick={onClick}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 150 }}>
        <line x1={pad} y1={y(m.target)} x2={W - pad} y2={y(m.target)} stroke="#2f7757" strokeWidth="1.3" strokeDasharray="5 4" />
        <line x1={pad} y1={y(expNow)} x2={W - pad} y2={y(expNow)} stroke="#b8862f" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
        <path d={line + ` L ${x(data.length - 1)} ${H - pad} L ${x(0)} ${H - pad} Z`} fill={col} opacity="0.08" />
        <path d={line} fill="none" stroke={col} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="4" fill={col} />
      </svg>
      <div className="lchips" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
        <span className="lchip"><span className="d" style={{ background: col }} />{m.current}{m.unit} now</span>
        <span className="lchip"><svg width="18" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#2f7757" strokeWidth="1.3" strokeDasharray="4 3" /></svg> target {m.target}{m.unit}</span>
        <span className="lchip"><svg width="18" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#b8862f" strokeWidth="1" strokeDasharray="2 3" /></svg> expected pace</span>
      </div>
    </div>
  )
}
function MicroSpark({ data, color }: { data: number[]; color: string }) {
  const safe = data.length ? data : [0, 0]
  const max = Math.max(...safe), min = Math.min(...safe), rng = (max - min) || 1, w = 64, h = 22
  const pts = safe.map((d, i) => `${(i / (Math.max(1, safe.length - 1)) * w).toFixed(1)} ${(h - (d - min) / rng * (h - 4) - 2).toFixed(1)}`).join(' L ')
  return <svg width={w} height={h}><path d={'M ' + pts} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/* ───────────────────────── widget catalog ───────────────────────── */

type WidgetType = 'stat' | 'health' | 'bar' | 'spark' | 'list' | 'scatter' | 'objectives' | 'workload' | 'line' | 'scorecard' | 'exceptions'
type WidgetMeta = { name: string; icon: string; desc: string; dw: number; dh: number; cfg: string[] }
const WIDGETS: Record<WidgetType, WidgetMeta> = {
  stat:    { name: 'Stat number', icon: 'trend', desc: 'A single KPI with trend', dw: 1, dh: 1, cfg: ['metric', 'title'] },
  health:  { name: 'Health donut', icon: 'shield', desc: 'Initiative health split', dw: 2, dh: 2, cfg: ['source', 'title'] },
  bar:     { name: 'Bar chart', icon: 'bars', desc: 'Progress or budget by pillar', dw: 2, dh: 2, cfg: ['measure', 'title'] },
  spark:   { name: 'Trend line', icon: 'activity', desc: 'A KPI over time', dw: 2, dh: 1, cfg: ['metric', 'title'] },
  list:    { name: 'Initiative list', icon: 'grid', desc: 'Top initiatives by progress', dw: 2, dh: 2, cfg: ['source', 'title'] },
  scatter: { name: 'Risk scatter plot', icon: 'alert', desc: 'Likelihood vs severity bubbles', dw: 2, dh: 2, cfg: ['source', 'scope', 'title'] },
  objectives: { name: 'Objective progress', icon: 'target', desc: 'Key-result progress bars', dw: 2, dh: 2, cfg: ['source', 'title'] },
  workload: { name: 'Team workload', icon: 'users', desc: 'Open work per person', dw: 2, dh: 2, cfg: ['source', 'title'] },
  line:    { name: 'Metric history', icon: 'activity', desc: 'A measure over time with target line', dw: 2, dh: 2, cfg: ['measureId', 'title'] },
  scorecard: { name: 'Scorecard', icon: 'rows', desc: 'Measures grouped by perspective', dw: 2, dh: 3, cfg: ['source', 'title'] },
  exceptions: { name: 'Exception shelf', icon: 'alert', desc: 'Live risk signals, ranked', dw: 2, dh: 2, cfg: ['title'] },
}

type WidgetConfig = { metric?: string; measure?: string; source?: string; scope?: string; measureId?: string }
type Widget = { id: string; type: WidgetType; title: string; w: number; h: number; config: WidgetConfig }

function defaultTitle(type: WidgetType): string { return WIDGETS[type].name }
function newWidget(type: WidgetType): Widget {
  const w = WIDGETS[type]
  return {
    id: 'w' + Date.now() + Math.floor(Math.random() * 999), type, title: defaultTitle(type),
    w: w.dw, h: w.dh, config: { metric: 'aum', measure: 'progress', source: 'all', scope: 'Teams', measureId: '' },
  }
}

/* ───────────────────────── exception shelf source ───────────────────────── */

type Exception = { ic: string; c: string; pri: string; title: string; detail: string; measureId?: string }
function buildExceptions(d: DashData): Exception[] {
  const out: Exception[] = []
  d.sources.filter((s) => s.status === 'error').forEach((s) => out.push({ ic: 'bolt', c: '#b3382a', pri: 'CRITICAL', title: s.name + ' sync failed', detail: s.missedRuns + ' missed runs · ' + (s.error || 'feed error') }))
  d.measures.filter((m) => m.guardrailThreshold != null && m.guardrailBreached).forEach((m) => out.push({ ic: 'shield', c: '#b3382a', pri: 'PRIORITY', title: m.name + ' breached guardrail', detail: m.current + m.unit + ' vs ' + m.guardrailThreshold + m.unit + ' limit', measureId: m.id }))
  d.measures.filter((m) => freshness(m, d.sourceOf(m)) === 'stale').forEach((m) => out.push({ ic: 'clock', c: '#b8862f', pri: 'NORMAL', title: m.name + ' is stale', detail: 'Last updated ' + ageLabel(ageDays(m)), measureId: m.id }))
  return out
}

/* ───────────────────────── widget body renderers ───────────────────────── */

function filterInis(d: DashData, source: string): StrategyInitiative[] {
  return source === 'all' ? d.initiatives : d.initiatives.filter((i) => i.pillar === source)
}

function WidgetBodyExtra({ w, d, onMeasure }: { w: Widget; d: DashData; onMeasure?: (id: string) => void }) {
  if (w.type === 'line') {
    const meas = d.measuresById[w.config.measureId || ''] || d.measures[0]
    if (!meas) return <div style={{ fontSize: 12.5, color: 'var(--n-500)', padding: '8px 2px' }}>No measure selected.</div>
    return <LineChart m={meas} d={d} onClick={() => onMeasure && onMeasure(meas.id)} />
  }
  if (w.type === 'scorecard') {
    // No measure→pillar/objective link in the live model: group by measure-type
    // (KR/KPI/LEAD/LAG) as the "perspective", keeping the grouped-table markup.
    const groups = w.config.source === 'all'
      ? (['KR', 'KPI', 'LEAD', 'LAG'] as const).map((t) => ({ id: t, name: t, color: d.pillarColor(''), items: d.measures.filter((m) => m.measureType === t) })).filter((g) => g.items.length > 0)
      : d.pillars.filter((p) => p.code === w.config.source).map((p) => ({ id: p.code, name: p.name, color: p.color, items: d.measures }))
    return (
      <table className="scorecard">
        <thead><tr><th>Measure</th><th>Now</th><th>Target</th><th>Trend</th><th></th></tr></thead>
        {groups.map((g) => (
          <tbody key={g.id}>
            <tr className="perf-head"><td colSpan={5}>{g.name}</td></tr>
            {g.items.slice(0, 3).map((m) => {
              const f = freshness(m, d.sourceOf(m))
              const st = statusFromScore(measurePct(m), { guardrailBreached: m.guardrailThreshold != null && m.guardrailBreached })
              return (
                <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => onMeasure && onMeasure(m.id)}>
                  <td><span className="row ac" style={{ gap: 7 }}><span className={'fresh-dot ' + f} />{m.name}</span></td>
                  <td className="tnum" style={{ fontWeight: 700 }}>{m.current}{m.unit}</td>
                  <td className="tnum" style={{ color: 'var(--n-500)' }}>{m.target}{m.unit}</td>
                  <td><span className="sc-spark"><MicroSpark data={m.readings.slice(-8).map((r) => r.value)} color={g.color} /></span></td>
                  <td><span className={'spill ' + st}><span className="d" style={{ background: st === 'on' ? '#2f7757' : st === 'risk' ? '#b8862f' : '#b3382a' }} /></span></td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    )
  }
  if (w.type === 'exceptions') {
    const items = buildExceptions(d)
    return (
      <div>
        {items.slice(0, w.h >= 2 ? 6 : 3).map((x, k) => (
          <div key={k} className="exc-item" style={{ cursor: x.measureId ? 'pointer' : 'default' }} onClick={() => x.measureId && onMeasure && onMeasure(x.measureId)}>
            <span className="exc-ic" style={{ background: x.c }}><Icon name={x.ic} cls="sm" /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div className="exc-t">{x.title}</div><div className="exc-d">{x.detail}</div></div>
            <span className={'nudge-pri ' + x.pri}>{x.pri}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function WidgetBody({ w, d, onMeasure }: { w: Widget; d: DashData; onMeasure?: (id: string) => void }) {
  const M = dbMetrics(d)
  if (w.type === 'stat') {
    const m = M[w.config.metric || 'aum'] || M.aum
    const meas = d.metricMeasure(w.config.metric || 'aum')
    const guard = !!(meas && meas.guardrailThreshold != null && meas.guardrailBreached)
    return (
      <div className={'kpi2' + (guard ? ' guard' : '')} onClick={() => meas && onMeasure && onMeasure(meas.id)}>
        <div className="kpi2-top">
          <span className="kpi2-big">{m.value}<span className="kpi2-unit">{m.unit}</span></span>
          {meas && <span style={{ marginLeft: 'auto' }}><FreshDot m={meas} d={d} /></span>}
        </div>
        <div className={'kpi2-delta ' + (m.dir === 'up' ? 'up' : 'down')}><Icon name={m.dir === 'up' ? 'trend' : 'trenddown'} cls="xs" /> {m.delta} <span style={{ color: 'var(--n-400)', fontWeight: 500 }}>vs last period</span></div>
        <div style={{ marginTop: 4 }}><Spark data={m.spark} color={m.dir === 'up' ? '#3f7d5a' : '#b3382a'} w={180} h={38} fill /></div>
        <div className="kpi2-foot">
          {meas ? <SourceIcon meta={d.sourceMetaFor(meas)} /> : <span className="prov"><span className="src-ic" style={{ background: '#737373' }}><Icon name="grid" cls="xs" /></span>Portfolio</span>}
          {guard ? <span className="guard-tag"><Icon name="shield" cls="xs" /> guardrail</span> : null}
        </div>
      </div>
    )
  }
  if (w.type === 'spark') {
    const m = M[w.config.metric || 'nps'] || M.nps
    const meas = d.metricMeasure(w.config.metric || 'nps')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 8, cursor: meas ? 'pointer' : 'default' }} onClick={() => meas && onMeasure && onMeasure(meas.id)}>
        <div className="row ac" style={{ justifyContent: 'space-between' }}>
          <div className="w-stat" style={{ gap: 2 }}><div className="big" style={{ fontSize: 30 }}>{m.value}<span style={{ fontSize: 15, color: 'var(--n-400)' }}>{m.unit}</span></div></div>
          <span className={'delta ' + (m.dir === 'up' ? 'up' : 'down')} style={{ fontSize: 12.5, fontWeight: 700, color: m.dir === 'up' ? '#1f7a4d' : 'var(--critical)' }}>{m.delta}</span>
        </div>
        <Spark data={m.spark} w={320} h={56} color="#3f7d5a" fill />
        {meas && <div className="row ac" style={{ justifyContent: 'space-between' }}><SourceIcon meta={d.sourceMetaFor(meas)} /><FreshDot m={meas} d={d} /></div>}
      </div>
    )
  }
  if (w.type === 'health') {
    const inis = filterInis(d, w.config.source || 'all')
    const data = [
      { v: inis.filter((i) => i.health === 'on').length, c: '#3f9d6c', l: 'On track' },
      { v: inis.filter((i) => i.health === 'risk').length, c: '#d6a32a', l: 'At risk' },
      { v: inis.filter((i) => i.health === 'off').length, c: '#d24b3b', l: 'Off track' },
      { v: inis.filter((i) => i.health === 'done').length, c: '#a3a3a3', l: 'Done' },
    ].filter((x) => x.v > 0)
    return (
      <div className="row ac" style={{ gap: 16, height: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Donut data={data} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {data.map((x) => <div key={x.l} className="row ac" style={{ gap: 8, fontSize: 12.5, color: 'var(--n-700)' }}><span className="sdot" style={{ background: x.c }} />{x.l}<b style={{ marginLeft: 'auto', paddingLeft: 8 }}>{x.v}</b></div>)}
        </div>
      </div>
    )
  }
  if (w.type === 'bar') {
    const meas = w.config.measure || 'progress'
    const cats = d.pillars.map((p) => {
      const inis = d.initiatives.filter((i) => i.pillar === p.code)
      if (meas === 'budget') return { lbl: p.name.split(' ')[0], v: Math.round(inis.reduce((a, i) => a + i.budget, 0) / 1000), lbl2: (inis.reduce((a, i) => a + i.budget, 0) / 1000).toFixed(1) + 'M', c: p.color }
      return { lbl: p.name.split(' ')[0], v: Math.round(inis.reduce((a, i) => a + i.progress, 0) / (inis.length || 1)), lbl2: Math.round(inis.reduce((a, i) => a + i.progress, 0) / (inis.length || 1)) + '%', c: p.color }
    })
    return <BarMini cats={cats} />
  }
  if (w.type === 'list') {
    const inis = filterInis(d, w.config.source || 'all').slice().sort((a, b) => b.progress - a.progress).slice(0, 6)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {inis.map((i) => (
          <div key={i.id} className="row ac" style={{ gap: 10 }}>
            <span className="pdot" style={{ background: d.pillarColor(i.pillar) }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--n-800)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.title}</span>
            <span className="mini-bar" style={{ width: 60 }}><i style={{ width: i.progress + '%', background: d.pillarColor(i.pillar) }} /></span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--n-500)', width: 30, textAlign: 'right' }} className="tnum">{i.progress}%</span>
          </div>
        ))}
      </div>
    )
  }
  if (w.type === 'scatter') {
    const src = w.config.source || 'all'
    const all = d.risks.map((r) => ({ like: r.likelihood, impact: r.impact, initiativeId: r.initiativeId }))
    const risks = src === 'all'
      ? all
      : all.filter((r) => {
          const ini = r.initiativeId ? d.initiatives.find((x) => x.id === r.initiativeId) : undefined
          return ini ? ini.pillar === src : false
        })
    return <div style={{ display: 'flex', justifyContent: 'center' }}><Scatter risks={risks} size={300} /></div>
  }
  if (w.type === 'objectives') {
    // Strategy objectives land in a later wave; this widget has nothing to read,
    // so it renders its (empty) list markup gracefully.
    const objs: Array<{ id: string; title: string; pillar: string; krs: Array<{ now: number; from: number; to: number }> }> =
      w.config.source === 'all' ? [] : []
    const pct = (o: { krs: Array<{ now: number; from: number; to: number }> }) =>
      o.krs.length ? Math.round(o.krs.reduce((a, k) => a + Math.max(0, Math.min(100, (k.now - k.from) / ((k.to - k.from) || 1) * 100)), 0) / o.krs.length) : 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {objs.slice(0, 6).map((o) => (
          <div key={o.id}>
            <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--n-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>{o.title}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--n-500)' }} className="tnum">{pct(o)}%</span>
            </div>
            <Bar pct={pct(o)} color={d.pillarColor(o.pillar)} thin />
          </div>
        ))}
        {objs.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--n-500)', padding: '8px 2px' }}>Objectives arrive in a later wave.</div>}
      </div>
    )
  }
  if (w.type === 'workload') {
    // No tasks yet: count initiatives owned per person (by owner id or name).
    const inis = filterInis(d, w.config.source || 'all')
    const byKey: Record<string, { name: string; id: string; n: number }> = {}
    for (const i of inis) {
      const key = i.owner || i.ownerName || '—'
      const name = (d.peopleName(i.owner) || i.ownerName || '—')
      ;(byKey[key] ||= { name, id: i.owner, n: 0 }).n++
    }
    const data = Object.values(byKey).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6)
    const max = Math.max(1, ...data.map((x) => x.n))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((x) => (
          <div key={x.id || x.name} className="row ac" style={{ gap: 10 }}>
            <span style={{ fontSize: 12.5, color: 'var(--n-700)', width: 70, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name.split(' ')[0]}</span>
            <span className="mini-bar" style={{ flex: 1 }}><i style={{ width: x.n / max * 100 + '%', background: '#5b8fc9' }} /></span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--n-600)' }} className="tnum">{x.n}</span>
          </div>
        ))}
        {data.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--n-500)', padding: '8px 2px' }}>No owned initiatives in scope.</div>}
      </div>
    )
  }
  return <WidgetBodyExtra w={w} d={d} onMeasure={onMeasure} />
}

/* ───────────────────────── config modal ───────────────────────── */

type ModalState =
  | { kind: 'library' }
  | { kind: 'config'; widget: Widget; fromLibrary: boolean }

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ v: string; l: string }> }) {
  return (
    <div style={{ position: 'relative' }}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: 34, cursor: 'pointer' }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--n-400)' }}><Icon name="cdown" cls="xs" /></span>
    </div>
  )
}

function ConfigModal({ widget, fromLibrary, d, sourceOpts, onClose, onBack, onConfirm }: {
  widget: Widget
  fromLibrary: boolean
  d: DashData
  sourceOpts: Array<{ v: string; l: string }>
  onClose: () => void
  onBack: () => void
  onConfirm: (w: Widget) => void
}) {
  const [draft, setDraft] = useState<Widget>(widget)
  const cfgKeys = WIDGETS[draft.type].cfg
  const M = dbMetrics(d)
  const set = (k: keyof WidgetConfig, v: string) => setDraft((dr) => ({ ...dr, config: { ...dr.config, [k]: v } }))
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">{draft.title || WIDGETS[draft.type].name}</div>
          <button className="w-cbtn" onClick={onClose}><Icon name="x" /></button></div>
        <div className="modal-body">
          <div className="cfg-2">
            <div className="cfg-preview"><WidgetBody w={draft} d={d} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 16, color: 'var(--n-900)' }}>Settings</div>
              {cfgKeys.includes('metric') && <Field label="Metric"><Sel value={draft.config.metric || 'aum'} onChange={(v) => set('metric', v)} options={Object.keys(M).map((k) => ({ v: k, l: M[k].label }))} /></Field>}
              {cfgKeys.includes('measure') && <Field label="Measure"><Sel value={draft.config.measure || 'progress'} onChange={(v) => set('measure', v)} options={[{ v: 'progress', l: 'Avg progress' }, { v: 'budget', l: 'Budget (MNOK)' }]} /></Field>}
              {cfgKeys.includes('measureId') && <Field label="Measure"><Sel value={draft.config.measureId || ''} onChange={(v) => set('measureId', v)} options={d.measures.length ? d.measures.map((m) => ({ v: m.id, l: m.name })) : [{ v: '', l: 'No measures yet' }]} /></Field>}
              {cfgKeys.includes('scope') && <Field label="Count risks within"><Sel value={draft.config.scope || 'Teams'} onChange={(v) => set('scope', v)} options={[{ v: 'Teams', l: 'Teams' }, { v: 'Pillars', l: 'Pillars' }, { v: 'Initiatives', l: 'Initiatives' }]} /></Field>}
              {cfgKeys.includes('source') && <Field label="Data source"><Sel value={draft.config.source || 'all'} onChange={(v) => set('source', v)} options={sourceOpts} /></Field>}
              {cfgKeys.includes('title') && <Field label="Widget title"><input className="input" value={draft.title} onChange={(e) => setDraft((dr) => ({ ...dr, title: e.target.value }))} /></Field>}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          {fromLibrary && <button className="btn" onClick={onBack}><Icon name="cleft" cls="sm" /> Back to library</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={() => onConfirm(draft)}><Icon name="ok" cls="sm" /> Confirm</button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── library modal ───────────────────────── */

function LibraryModal({ onClose, onPick }: { onClose: () => void; onPick: (type: WidgetType) => void }) {
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">Widget library</div><button className="w-cbtn" onClick={onClose}><Icon name="x" /></button></div>
        <div className="modal-body">
          <div className="lib-grid">
            {(Object.entries(WIDGETS) as Array<[WidgetType, WidgetMeta]>).map(([type, w]) => (
              <div key={type} className="lib-card" onClick={() => onPick(type)}>
                <span className="lib-ico"><Icon name={w.icon} /></span>
                <div className="lib-name">{w.name}</div>
                <div className="lib-desc">{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── measure drill-down drawer ─────────────────────────
   Open by measure id: status pill + provenance, current/target/direction, the
   history line chart, guardrail note, the readings log, and a "post value" form
   wired to postReading. The design's "drives objective"/linked-initiatives
   sections degrade (no measure→objective link in the live model). */

function MeasureDrawer({ measureId, d, postReading, onClose }: {
  measureId: string
  d: DashData
  postReading: (id: string, value: number, note: string, byName: string) => Promise<void>
  onClose: () => void
}) {
  const { currentUserName } = useToolsData()
  const m = d.measuresById[measureId]
  const [val, setVal] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  if (!m) return null
  const meta = d.sourceMetaFor(m)
  const f = freshness(m, d.sourceOf(m))
  const st = statusFromScore(measurePct(m), { guardrailBreached: m.guardrailThreshold != null && m.guardrailBreached })
  // Synthesize reading dates: newest first, with their real age in days.
  const readings = m.readings.map((r) => ({ v: r.value, ago: daysBetween(TODAY, new Date(r.date)) })).slice().reverse()

  async function submit() {
    const num = Number(val)
    if (val.trim() === '' || Number.isNaN(num)) return
    setSaving(true)
    await postReading(m.id, num, note, currentUserName)
    setSaving(false)
    setVal(''); setNote('')
  }

  return (
    <SideWindow open onClose={onClose} wide eyebrow={`Measure · ${meta.label}`} title={m.name}
      footer={<div style={{ display: 'contents' }}>
        <button className="btn btn--ghost" onClick={onClose}>Close</button>
      </div>}>
      <div className="row ac" style={{ gap: 10, flexWrap: 'wrap' }}>
        <span className={'spill ' + st}><span className="d" style={{ background: st === 'on' ? '#2f7757' : st === 'risk' ? '#b8862f' : '#b3382a' }} />{STATUS_LABEL[st]}</span>
        <span className="prov"><span className="src-ic" style={{ background: meta.color }}><Icon name={meta.icon} cls="xs" /></span>{meta.label}</span>
        <span className="prov"><span className={'fresh-dot ' + f} />{ageLabel(ageDays(m))}</span>
        <span className="grounded"><Icon name="shield" cls="xs" /> Grounded</span>
      </div>
      <div className="row" style={{ gap: 14, marginTop: 4 }}>
        <div className="rep-stat" style={{ flex: 1 }}><div className="l">Current</div><div className="v">{m.current}{m.unit}</div></div>
        <div className="rep-stat" style={{ flex: 1 }}><div className="l">Target</div><div className="v">{m.target}{m.unit}</div></div>
        <div className="rep-stat" style={{ flex: 1 }}><div className="l">Direction</div><div className="v" style={{ fontSize: 17 }}>{m.direction === 'INCREASE' ? '↑ grow' : m.direction === 'DECREASE' ? '↓ reduce' : '↔ hold'}</div></div>
      </div>
      <div className="dd-chart"><div className="eyebrow" style={{ marginBottom: 10 }}>History · target &amp; expected pace</div><LineChart m={m} d={d} onClick={() => {}} /></div>
      {m.guardrailThreshold != null && (
        <div className="humannote" style={{ borderColor: '#eecabb', background: m.guardrailBreached ? '#f7e7e0' : 'var(--paper)' }}>
          <Icon name="shield" /><p style={{ fontStyle: 'normal', color: m.guardrailBreached ? '#a8362a' : 'var(--n-600)' }}>
            {m.guardrailBreached ? `Guardrail breached — ${m.current}${m.unit} is past the ${m.guardrailThreshold}${m.unit} limit. Paired goals are capped at At risk.` : `Guardrail healthy at ${m.guardrailThreshold}${m.unit}.`}</p>
        </div>
      )}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Post a value</div>
        <div className="row ac" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 120 }}>
            <input className="input" type="number" placeholder={`Value${m.unit ? ' (' + m.unit.trim() + ')' : ''}`} value={val} onChange={(e) => setVal(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn btn--primary sm" disabled={saving || val.trim() === ''} onClick={() => { void submit() }}><Icon name="plus" cls="sm" /> Post</button>
        </div>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Readings log · provenance</div>
        <div className="dd-readings">
          {readings.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--n-500)', padding: '6px 2px' }}>No readings yet.</div>}
          {readings.slice(0, 8).map((r, k) => (
            <div key={k} className="dd-reading">
              <span className="rv">{r.v}{m.unit}</span>
              <span className="rd">{ageLabel(r.ago)}</span>
              <span className="prov"><span className="src-ic" style={{ background: meta.color, width: 14, height: 14 }}><Icon name={meta.icon} cls="xs" /></span>{m.sourceId ? 'auto-synced' : 'manual entry'}</span>
            </div>
          ))}
        </div>
      </div>
    </SideWindow>
  )
}

/* ───────────────────────── default layout ─────────────────────────
   The design seeded this from localStorage (klarert_dash_v1); persistence to
   the DB is deferred, so the layout is local component state seeded from the
   design's default. (TODO: persist via a dashboard_layouts-style scope.) */

type DashLayout = { cols: number; widgets: Widget[] }
function defaultLayout(): DashLayout {
  return {
    cols: 4,
    widgets: [
      { id: 'd1', type: 'stat', title: 'Assets under management', w: 1, h: 1, config: { metric: 'aum' } },
      { id: 'd2', type: 'stat', title: 'Avg progress', w: 1, h: 1, config: { metric: 'progress' } },
      { id: 'd3', type: 'spark', title: 'Client NPS', w: 2, h: 1, config: { metric: 'nps' } },
      { id: 'd4', type: 'health', title: 'Portfolio health', w: 2, h: 2, config: { source: 'all' } },
      { id: 'd5', type: 'bar', title: 'Progress by pillar', w: 2, h: 2, config: { measure: 'progress' } },
      { id: 'd6', type: 'scatter', title: 'Risk distribution', w: 2, h: 2, config: { source: 'all', scope: 'Teams' } },
      { id: 'd7', type: 'objectives', title: 'Objective progress', w: 2, h: 2, config: { source: 'all' } },
      { id: 'd8', type: 'exceptions', title: 'Exception shelf', w: 2, h: 2, config: {} },
      { id: 'd9', type: 'line', title: 'Metric history', w: 2, h: 2, config: { measureId: '' } },
    ],
  }
}

/* ───────────────────────── main view ───────────────────────── */

export function StrategyDashboardView() {
  const { measures, sources, postReading } = useStrategyMeasures()
  const ini = useStrategyInitiatives()
  const { pillars } = useStrategyFoundation()
  const { P } = useToolsData()

  const [dash, setDash] = useState<DashLayout>(defaultLayout)
  const [edit, setEdit] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [drill, setDrill] = useState<string | null>(null)

  const d: DashData = useMemo(() => {
    const measuresById: Record<string, StrategyMeasure> = {}
    for (const m of measures) measuresById[m.id] = m
    const sourcesById: Record<string, DataSource> = {}
    for (const s of sources) sourcesById[s.id] = s
    const pillarByCode: Record<string, StrategyPillar> = {}
    for (const p of pillars) pillarByCode[p.code] = p
    const liveByMetric: Record<string, StrategyMeasure | undefined> = {}
    LIVE_METRIC_KEYS.forEach((k, idx) => { liveByMetric[k] = measures[idx] })
    const sourceOf = (m: StrategyMeasure) => (m.sourceId ? sourcesById[m.sourceId] : undefined)
    return {
      measures,
      measuresById,
      sources,
      initiatives: ini.initiatives,
      risks: ini.risks,
      pillars,
      pillarColor: (code: string) => pillarByCode[code]?.color ?? 'var(--forest)',
      metricMeasure: (key: string) => liveByMetric[key],
      sourceOf,
      sourceMetaFor: (m: StrategyMeasure) => {
        const s = sourceOf(m)
        if (!s) return MANUAL_META
        return { label: s.name || 'Connected source', icon: 'cloud', color: '#3f7d5a' }
      },
      peopleName: (id: string) => (id ? P[id]?.name : undefined),
    }
  }, [measures, sources, ini.initiatives, ini.risks, pillars, P])

  const sourceOpts = useMemo(
    () => [{ v: 'all', l: 'All teams' }, ...pillars.map((p) => ({ v: p.code, l: p.name }))],
    [pillars],
  )

  const setCols = (c: number) => setDash((dl) => ({ ...dl, cols: Math.max(2, Math.min(6, c)) }))
  const resize = (id: string, dim: 'w' | 'h', delta: number) => setDash((dl) => ({
    ...dl,
    widgets: dl.widgets.map((w) => w.id === id ? { ...w, [dim]: Math.max(1, Math.min(dim === 'w' ? dl.cols : 3, w[dim] + delta)) } : w),
  }))
  const remove = (id: string) => setDash((dl) => ({ ...dl, widgets: dl.widgets.filter((w) => w.id !== id) }))
  const saveWidget = (wd: Widget) => {
    setDash((dl) => dl.widgets.find((x) => x.id === wd.id)
      ? { ...dl, widgets: dl.widgets.map((x) => x.id === wd.id ? wd : x) }
      : { ...dl, widgets: [...dl.widgets, wd] })
    setModal(null)
  }
  const reorder = (from: string, to: string) => setDash((dl) => {
    const ws = dl.widgets.slice()
    const fi = ws.findIndex((w) => w.id === from), ti = ws.findIndex((w) => w.id === to)
    if (fi < 0 || ti < 0) return dl
    const [moved] = ws.splice(fi, 1)
    ws.splice(ti, 0, moved)
    return { ...dl, widgets: ws }
  })

  return (
    <div>
      <PageHead title="Dashboard" sub="Your strategy at a glance. Add widgets, resize them, change what they show, and arrange the grid however you like."
        actions={<div style={{ display: 'contents' }}>
          <button className={'btn sm' + (edit ? ' btn--primary' : '')} onClick={() => setEdit((e) => !e)}><Icon name={edit ? 'ok' : 'pencil'} cls="sm" /> {edit ? 'Done' : 'Edit layout'}</button>
          <button className="btn btn--primary sm" onClick={() => setModal({ kind: 'library' })}><Icon name="plus" cls="sm" /> Add widget</button>
        </div>} />

      {edit && (
        <div className="dash-toolbar">
          <div className="humannote" style={{ flex: 1, minWidth: 280 }}><Icon name="shield" /><p>Drag widgets to reorder. Use the size steppers to change how many columns and rows each one spans. Layout is per-session for now.</p></div>
          <div className="select" style={{ cursor: 'default' }}>
            <Icon name="grid" cls="sm" /> Grid columns
            <span className="stepper" style={{ marginLeft: 6 }}>
              <button className="step-b" onClick={() => setCols(dash.cols - 1)} disabled={dash.cols <= 2}>−</button>
              <span className="step-v">{dash.cols}</span>
              <button className="step-b" onClick={() => setCols(dash.cols + 1)} disabled={dash.cols >= 6}>+</button>
            </span>
          </div>
          <button className="btn sm" onClick={() => setDash(defaultLayout())}><Icon name="repeat" cls="sm" /> Reset</button>
        </div>
      )}

      <div className="dash-grid" style={{ gridTemplateColumns: `repeat(${dash.cols}, minmax(0,1fr))`, gridAutoRows: '200px' }}>
        {dash.widgets.map((w) => (
          <div key={w.id}
            className={'widget' + (edit ? ' edit' : '') + (dragId === w.id ? ' dragging' : '') + (overId === w.id ? ' droppos' : '')}
            style={{ gridColumn: `span ${Math.min(w.w, dash.cols)}`, gridRow: `span ${w.h}` }}
            draggable={edit}
            onDragStart={() => edit && setDragId(w.id)}
            onDragOver={(e) => { if (edit && dragId && dragId !== w.id) { e.preventDefault(); setOverId(w.id) } }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOverId(null) }}
            onDrop={() => { if (dragId) reorder(dragId, w.id); setDragId(null); setOverId(null) }}
            onDragEnd={() => { setDragId(null); setOverId(null) }}>
            <div className="w-head">
              {edit && <span className="w-handle"><Icon name="drag" cls="sm" /></span>}
              <span className="w-title">{w.title}</span>
              {edit && (
                <div className="w-ctrls">
                  <span className="stepper" title="Width" style={{ marginRight: 4 }}>
                    <button className="step-b" onClick={() => resize(w.id, 'w', -1)} disabled={w.w <= 1}>−</button>
                    <span className="step-v" style={{ minWidth: 14, fontSize: 11 }}><Icon name="cols" cls="xs" /></span>
                    <button className="step-b" onClick={() => resize(w.id, 'w', 1)} disabled={w.w >= dash.cols}>+</button>
                  </span>
                  <span className="stepper" title="Height" style={{ marginRight: 4 }}>
                    <button className="step-b" onClick={() => resize(w.id, 'h', -1)} disabled={w.h <= 1}>−</button>
                    <span className="step-v" style={{ minWidth: 14, fontSize: 11 }}><Icon name="rows" cls="xs" /></span>
                    <button className="step-b" onClick={() => resize(w.id, 'h', 1)} disabled={w.h >= 3}>+</button>
                  </span>
                  <button className="w-cbtn" title="Configure" onClick={() => setModal({ kind: 'config', widget: w, fromLibrary: false })}><Icon name="gear" cls="sm" /></button>
                  <button className="w-cbtn danger" title="Remove" onClick={() => remove(w.id)}><Icon name="x" cls="sm" /></button>
                </div>
              )}
            </div>
            <div className="w-body" style={{ overflow: 'hidden' }}><WidgetBody w={w} d={d} onMeasure={(id) => setDrill(id)} /></div>
          </div>
        ))}
      </div>
      {dash.widgets.length === 0 && (
        <div className="empty">
          <div className="halo"><Icon name="grid" cls="lg" /></div>
          <div style={{ fontWeight: 700, color: 'var(--n-700)', fontSize: 15 }}>No widgets yet</div>
          <div style={{ fontSize: 13, maxWidth: 360 }}>Add one from the library to start building your dashboard.</div>
        </div>
      )}

      {modal && modal.kind === 'library' && (
        <LibraryModal onClose={() => setModal(null)} onPick={(type) => setModal({ kind: 'config', widget: newWidget(type), fromLibrary: true })} />
      )}
      {modal && modal.kind === 'config' && (
        <ConfigModal widget={modal.widget} fromLibrary={modal.fromLibrary} d={d} sourceOpts={sourceOpts}
          onClose={() => setModal(null)} onBack={() => setModal({ kind: 'library' })} onConfirm={saveWidget} />
      )}
      {drill && <MeasureDrawer measureId={drill} d={d} postReading={postReading} onClose={() => setDrill(null)} />}
    </div>
  )
}
