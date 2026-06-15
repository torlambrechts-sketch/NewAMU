/* Strategy v2 — Execution workspace (Initiatives spine).
   Faithful 1:1 UI port of the design package's Execution group (views_a/b/
   portfolio/d + the app_v2 initiative form): Overview, Projects (portfolio),
   Timeline (gantt), Roadmap, Kanban, Tasks, plus the initiative DetailView
   overlay and the create/edit SideWindow. The design's AppV2 `ctx` global is
   replaced by an ExecCtx React context fed from useStrategyInitiatives /
   useStrategyFoundation (DB-driven, no window globals, no localStorage). Tasks
   and the decision-log History land in a later wave, so their surfaces render
   as EmptyState while keeping the markup intact. */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Avatar,
  AvatarStack,
  Bar,
  Card,
  Field,
  HealthBadge,
  HealthDot,
  HumanNote,
  Icon,
  KPI,
  PageHead,
  PillarChip,
  Seg,
  SideWindow,
  StageBadge,
  useToolsData,
} from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import {
  MONTHS,
  QUARTERS,
  STAGE_META,
} from './strategyDerive'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import { useStrategyFoundation } from '../../hooks/useStrategyFoundation'
import type {
  InitiativeHealth,
  InitiativeStage,
  RaciRole,
  StrategyInitiative,
  StrategyPillar,
} from '../../types/strategyTools'

/* CSS custom properties (`--ac`) are set via inline style throughout the
   design's markup; React.CSSProperties doesn't model them, so allow them. */
type CSSVars = React.CSSProperties & Record<string, string | number>

type Filters = { pillar: string; owner: string; q: string }
type ExecView = 'overview' | 'projects' | 'gantt' | 'roadmap' | 'kanban' | 'tasks'
type SideState = { type: 'new' | 'edit'; id?: string }

/* ───────────────────────── context (replaces AppV2 ctx) ───────────────────────── */

type ExecContextValue = {
  initiatives: StrategyInitiative[]
  risks: ReturnType<typeof useStrategyInitiatives>['risks']
  raci: ReturnType<typeof useStrategyInitiatives>['raci']
  raciPeople: string[]
  pillars: StrategyPillar[]
  pillarByCode: Record<string, StrategyPillar>
  filters: Filters
  setFilters: (f: Filters) => void
  detailId: string | null
  openDetail: (id: string | null) => void
  openNew: () => void
  openEdit: (id: string) => void
  openTask: () => void
  openNewTask: () => void
  moveInitiative: (id: string, stage: InitiativeStage) => void
  toggleTask: () => void
  setView: (v: ExecView) => void
  toast: (message: string) => void
  update: ReturnType<typeof useStrategyInitiatives>['update']
  remove: ReturnType<typeof useStrategyInitiatives>['remove']
  addDep: ReturnType<typeof useStrategyInitiatives>['addDep']
  removeDep: ReturnType<typeof useStrategyInitiatives>['removeDep']
  setRaci: ReturnType<typeof useStrategyInitiatives>['setRaci']
  addRisk: ReturnType<typeof useStrategyInitiatives>['addRisk']
  updateRisk: ReturnType<typeof useStrategyInitiatives>['updateRisk']
  removeRisk: ReturnType<typeof useStrategyInitiatives>['removeRisk']
  create: ReturnType<typeof useStrategyInitiatives>['create']
}

const ExecCtx = createContext<ExecContextValue | null>(null)
function useExec(): ExecContextValue {
  const v = useContext(ExecCtx)
  if (!v) throw new Error('useExec must be used within ExecutionWorkspace')
  return v
}

/* ───────────────────────── filter logic + bar (ported from viewbits) ───────────────────────── */

function applyFilters(list: StrategyInitiative[], f: Filters): StrategyInitiative[] {
  return list.filter((i) => {
    if (f.pillar !== 'all' && i.pillar !== f.pillar) return false
    if (f.owner !== 'all' && i.owner !== f.owner && !(i.team || []).includes(f.owner)) return false
    if (f.q) {
      const s = (i.title + ' ' + i.key + ' ' + i.summary).toLowerCase()
      if (!s.includes(f.q.toLowerCase())) return false
    }
    return true
  })
}

type DropdownOption = { v: string; label: string; dot?: string }
function Dropdown({ label, icon, value, options, onChange, allLabel }: {
  label: string
  icon?: string
  value: string
  options: DropdownOption[]
  onChange: (v: string) => void
  allLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const cur = options.find((o) => o.v === value)
  const active = value !== 'all'
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className={'select' + (active ? ' on' : '')} onClick={() => setOpen((o) => !o)}>
        {icon && <Icon name={icon} cls="sm" />}
        {active ? (cur ? cur.label : label) : label}
        <Icon name="cdown" cls="xs" />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, background: '#fff', border: '1px solid var(--n-200)', borderRadius: 10, boxShadow: '0 10px 30px rgba(58,77,63,.12)', padding: 6, minWidth: 190, maxHeight: 320, overflow: 'auto' }}>
          {[{ v: 'all', label: allLabel || 'All' } as DropdownOption, ...options].map((o) => (
            <div key={o.v}
              onClick={() => { onChange(o.v); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: value === o.v ? 'var(--forest)' : 'var(--n-700)', background: value === o.v ? 'var(--forest-soft)' : 'transparent' }}
              onMouseEnter={(e) => { if (value !== o.v) e.currentTarget.style.background = 'var(--n-50)' }}
              onMouseLeave={(e) => { if (value !== o.v) e.currentTarget.style.background = 'transparent' }}>
              {o.dot && <span className="pdot" style={{ background: o.dot }} />}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterBar({ filters, setFilters, right, hideSearch }: {
  filters: Filters
  setFilters: (f: Filters) => void
  right?: ReactNode
  hideSearch?: boolean
}) {
  const { people } = useToolsData()
  const ctx = useExec()
  const pillarOpts: DropdownOption[] = ctx.pillars.map((p) => ({ v: p.code, label: p.name, dot: p.color }))
  const ownerOpts: DropdownOption[] = people.map((p) => ({ v: p.id, label: p.name }))
  const any = filters.pillar !== 'all' || filters.owner !== 'all' || filters.q
  return (
    <div className="toolbar">
      {!hideSearch && (
        <div className="search">
          <Icon name="search" cls="sm" />
          <input placeholder="Search initiatives…" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
      )}
      <Dropdown label="Pillar" icon="compass" value={filters.pillar} options={pillarOpts}
        allLabel="All pillars" onChange={(v) => setFilters({ ...filters, pillar: v })} />
      <Dropdown label="Owner" icon="user" value={filters.owner} options={ownerOpts}
        allLabel="All owners" onChange={(v) => setFilters({ ...filters, owner: v })} />
      {any && (
        <div className="mini-link" onClick={() => setFilters({ pillar: 'all', owner: 'all', q: '' })}>
          <Icon name="x" cls="xs" /> Clear
        </div>
      )}
      <div className="fspacer" />
      {right}
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon?: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="empty">
      <div className="halo"><Icon name={icon || 'search'} cls="lg" /></div>
      <div style={{ fontWeight: 700, color: 'var(--n-700)', fontSize: 15 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, maxWidth: 360 }}>{sub}</div>}
    </div>
  )
}

/* ───────────────────────── shared helpers ───────────────────────── */

/** Owner's first name, defensively (seeded initiatives have owner === ''). */
function ownerFirst(i: StrategyInitiative, P: Record<string, { name: string }>): string {
  const name = P[i.owner]?.name ?? i.ownerName ?? '—'
  return name.split(' ')[0]
}

/* ───────────────────────── OVERVIEW (Initiatives) ───────────────────────── */

function OverviewView() {
  const ctx = useExec()
  const list = applyFilters(ctx.initiatives, ctx.filters)
  const all = ctx.initiatives
  const onTrack = all.filter((i) => i.health === 'on' || i.health === 'done').length
  const atRisk = all.filter((i) => i.health === 'risk').length
  const offTrack = all.filter((i) => i.health === 'off').length
  const avg = all.length ? Math.round(all.reduce((a, i) => a + i.progress, 0) / all.length) : 0
  const budget = all.reduce((a, i) => a + i.budget, 0)
  const spent = all.reduce((a, i) => a + i.spent, 0)
  const pAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'

  return (
    <div>
      <PageHead
        title="2026 strategic plan"
        sub="Twelve initiatives across four pillars, each tied to an objective. The portfolio shows where work stands — not a single score."
        actions={<div style={{ display: 'contents' }}>
          <button className="btn sm" onClick={() => ctx.setView('roadmap')}><Icon name="cal" cls="sm" /> Roadmap</button>
          <button className="btn btn--primary sm" onClick={ctx.openNew}><Icon name="plus" cls="sm" /> New initiative</button>
        </div>} />

      <div className="kgrid k5" style={{ marginBottom: 16 }}>
        <KPI icon="grid" label="Initiatives" value={all.length} sub={`${all.filter((i) => i.stage !== 'done').length} in flight · ${all.filter((i) => i.stage === 'done').length} done`} />
        <KPI icon="check" label="On track" value={`${onTrack} / ${all.length}`} sub={`${atRisk} at risk · ${offTrack} off track`} />
        <KPI icon="trend" label="Avg progress" value={avg + '%'} sub="weighted across portfolio" />
        <KPI icon="brief" label="Budget committed" value={(spent / 1000).toFixed(1) + ' M'} sub={`of ${(budget / 1000).toFixed(1)} M NOK`} />
      </div>

      <HumanNote>Health reflects an owner's judgement against the plan, not an automated verdict. The bands inform; a person decides.</HumanNote>

      <div style={{ height: 18 }} />
      <FilterBar filters={ctx.filters} setFilters={ctx.setFilters} />

      {list.length === 0
        ? <EmptyState title="No initiatives match" sub="Try clearing the pillar or owner filter." />
        : <div className="pgrid">
            {list.map((i) => {
              const pillar = ctx.pillarByCode[i.pillar]
              return (
                <div key={i.id} className="icard" style={{ '--ac': pAccent(i.pillar) } as CSSVars} onClick={() => ctx.openDetail(i.id)}>
                  <div className="icard__top">
                    <span className="icard__key">{i.key}</span>
                    <HealthBadge h={i.health} />
                  </div>
                  <div className="icard__title">{i.title}</div>
                  <div className="icard__sum">{i.summary}</div>
                  <div style={{ marginTop: 14 }}>
                    <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--n-500)' }}>Progress</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--n-700)' }} className="tnum">{i.progress}%</span>
                    </div>
                    <Bar pct={i.progress} color={pAccent(i.pillar)} thin />
                  </div>
                  <div className="icard__foot">
                    {pillar ? <PillarChip pillar={pillar} /> : <span />}
                    <div className="row ac" style={{ gap: 8 }}>
                      <StageBadge stage={i.stage} />
                      <Avatar id={i.owner} size="xs" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>}
    </div>
  )
}

/* ───────────────────────── ROADMAP ───────────────────────── */

function RoadmapView() {
  const ctx = useExec()
  const list = applyFilters(ctx.initiatives, ctx.filters)
  const qOf = (m: number) => Math.floor(m / 3)
  return (
    <div>
      <PageHead title="Roadmap" sub="Initiatives laid across the four quarters of 2026, grouped by strategic pillar." />
      <FilterBar filters={ctx.filters} setFilters={ctx.setFilters} />
      <div className="roadmap">
        <div className="rm-head">
          <div style={{ padding: '13px 16px' }}><span className="eyebrow">Pillar</span></div>
          {QUARTERS.map((q) => (
            <div key={q.id} className="rm-qh"><div className="ql">{q.label}</div><div className="qm">{q.months}</div></div>
          ))}
        </div>
        {ctx.pillars.map((pl) => {
          const items = list.filter((i) => i.pillar === pl.code)
          return (
            <div key={pl.id} className="rm-lane">
              <div className="rm-lname"><span className="pdot" style={{ background: pl.color }} />{pl.name}</div>
              {QUARTERS.map((q, qi) => (
                <div key={q.id} className="rm-cell">
                  {items.filter((i) => qOf(i.s) <= qi && qOf(i.e) >= qi).map((i) => {
                    const isStart = qOf(i.s) === qi
                    return (
                      <div key={i.id} className={'rm-pill' + (isStart ? '' : ' cont')}
                        style={{ background: pl.color }} onClick={() => ctx.openDetail(i.id)}>
                        {isStart ? <span style={{ display: 'contents' }}><div className="rk">{i.key}</div>{i.title}</span>
                          : <span style={{ fontSize: 11 }}>↳ continues</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── KANBAN ───────────────────────── */

function KanbanView() {
  const ctx = useExec()
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<InitiativeStage | null>(null)
  const list = applyFilters(ctx.initiatives, ctx.filters)
  const cols: InitiativeStage[] = ['backlog', 'planned', 'active', 'review', 'done']
  const pAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'

  function onDrop(stage: InitiativeStage) {
    if (dragId) ctx.moveInitiative(dragId, stage)
    setDragId(null); setOver(null)
  }

  return (
    <div>
      <PageHead title="Kanban" sub="Drag initiatives across stages as work moves. Stage is the workflow lane; health is a separate judgement." />
      <FilterBar filters={ctx.filters} setFilters={ctx.setFilters} />
      <div className="kanban">
        {cols.map((stage) => {
          const m = STAGE_META[stage]
          const items = list.filter((i) => i.stage === stage)
          return (
            <div key={stage} className="kcol">
              <div className="kcol__head">
                <span className="kcol__dot" style={{ background: m.fg }} />
                <span className="kcol__name">{m.label}</span>
                <span className="kcol__count">{items.length}</span>
              </div>
              <div className={'kcol__body' + (over === stage ? ' dragover' : '')}
                onDragOver={(e) => { e.preventDefault(); setOver(stage) }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null) }}
                onDrop={() => onDrop(stage)}>
                {items.map((i) => {
                  const pillar = ctx.pillarByCode[i.pillar]
                  return (
                    <div key={i.id}
                      className={'kcard' + (dragId === i.id ? ' dragging' : '')}
                      style={{ '--ac': pAccent(i.pillar) } as CSSVars}
                      draggable
                      onDragStart={() => setDragId(i.id)}
                      onDragEnd={() => { setDragId(null); setOver(null) }}
                      onClick={() => ctx.openDetail(i.id)}>
                      <div className="row ac" style={{ justifyContent: 'space-between' }}>
                        <span className="kcard__key">{i.key}</span>
                        <HealthDot h={i.health} />
                      </div>
                      <div className="kcard__title">{i.title}</div>
                      <div style={{ marginTop: 10 }}><Bar pct={i.progress} color={pAccent(i.pillar)} thin /></div>
                      <div className="kcard__foot">
                        {pillar
                          ? <span className="pchip" style={{ background: pillar.softColor, color: pillar.color, height: 22 }}>
                              <span className="pdot" style={{ background: pillar.color }} />{pillar.name}
                            </span>
                          : <span />}
                        <Avatar id={i.owner} size="xs" />
                      </div>
                    </div>
                  )
                })}
                {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--n-400)', textAlign: 'center', padding: '14px 0' }}>Drop here</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── TASKS ───────────────────────── */

function TasksView() {
  const ctx = useExec()
  const [status, setStatus] = useState('all')
  // Task↔initiative linking lands in a later wave: there are no tasks yet.
  const tasks: never[] = []
  const counts: Record<string, number> = { all: 0, todo: 0, doing: 0, blocked: 0, done: 0 }

  return (
    <div>
      <PageHead title="Tasks" sub="Every task across the portfolio in one list. Check one off, or open it to reassign or change status." />
      <FilterBar filters={ctx.filters} setFilters={ctx.setFilters} right={
        <div className="vbar" style={{ padding: 4 }}>
          {([['all', 'All'], ['doing', 'In progress'], ['blocked', 'Blocked'], ['todo', 'To do'], ['done', 'Done']] as Array<[string, string]>).map(([v, l]) => (
            <button key={v} className={'vbtn' + (status === v ? ' on' : '')} onClick={() => setStatus(v)}>{l}<span style={{ opacity: .7 }}>{counts[v]}</span></button>
          ))}
        </div>
      } />
      {tasks.length === 0
        ? <EmptyState icon="check" title="No tasks yet" sub="Adjust the filters to see more." />
        : null}
    </div>
  )
}

/* ───────────────────────── GANTT / TIMELINE ───────────────────────── */

function GanttView() {
  const ctx = useExec()
  const { P } = useToolsData()
  const list = applyFilters(ctx.initiatives, ctx.filters).slice().sort((a, b) => a.s - b.s || a.e - b.e)
  const todayPct = (3.45 / 12) * 100 // mid-April 2026
  const bAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'
  const iniKey = (id: string) => ctx.initiatives.find((x) => x.id === id)?.key ?? id
  return (
    <div>
      <PageHead title="Timeline" sub="A waterfall of every initiative across 2026. Bar fill is progress; the red line is today." />
      <FilterBar filters={ctx.filters} setFilters={ctx.setFilters} />
      <div className="gantt">
        <div className="gantt__head">
          <div className="gantt__corner">Initiative</div>
          <div className="gantt__months">
            {MONTHS.map((m, i) => <div key={m} className={'gantt__m' + (i % 3 === 0 ? ' qstart' : '')}>{m}</div>)}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          {list.map((i) => {
            const left = (i.s / 12) * 100, width = ((i.e - i.s + 1) / 12) * 100
            return (
              <div key={i.id} className="grow-row">
                <div className="grow-lbl" onClick={() => ctx.openDetail(i.id)}>
                  <span className="t">{i.title}</span>
                  <span className="m">{i.key} · {ownerFirst(i, P)}{i.depends.length ? ` · needs ${i.depends.map((d) => iniKey(d)).join(', ')}` : ''}</span>
                </div>
                <div className="gtrack">
                  {MONTHS.map((_m, k) => <div key={k} className={'gcell' + (k % 3 === 0 ? ' qstart' : '')} />)}
                  <div className={'gbar ghealth-' + i.health}
                    style={{ left: `calc(${left}% + 4px)`, width: `calc(${width}% - 8px)`, background: bAccent(i.pillar) }}
                    onClick={() => ctx.openDetail(i.id)}>
                    <div className="gfill" style={{ width: i.progress + '%' }} />
                    <span>{i.progress}%</span>
                  </div>
                </div>
              </div>
            )
          })}
          <div className="gtoday" style={{ left: `calc(260px + ${todayPct} * (100% - 260px) / 100)` }} />
        </div>
      </div>
      <div className="row ac" style={{ gap: 18, marginTop: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--n-600)' }}>
        {ctx.pillars.map((p) => <span key={p.id} className="row ac" style={{ gap: 7 }}><span className="pdot" style={{ background: p.color }} />{p.name}</span>)}
        <span className="row ac" style={{ gap: 7 }}><span style={{ width: 14, height: 14, borderRadius: 4, outline: '2px solid var(--warn)', outlineOffset: -1, display: 'inline-block' }} /> at-risk outline</span>
        <span className="row ac" style={{ gap: 7 }}><span style={{ width: 2, height: 14, background: 'var(--critical)', opacity: .6, display: 'inline-block' }} /> today</span>
      </div>
    </div>
  )
}

/* ───────────────────────── PORTFOLIO (Projects) ───────────────────────── */

function projScore(i: StrategyInitiative): string { return (i.progress / 10).toFixed(1) }
function scoreCls(v: number): string { return v >= 7 ? 's-hi' : v >= 4 ? 's-md' : 's-lo' }
const TODAY_M = 5 + 10 / 30 // ~mid-June 2026

function ProjectsTab({ list }: { list: StrategyInitiative[] }) {
  const ctx = useExec()
  const { P } = useToolsData()
  const totBudget = list.reduce((a, i) => a + i.budget, 0)
  const totSpent = list.reduce((a, i) => a + i.spent, 0)
  const pfAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'
  const pillarName = (code: string) => ctx.pillarByCode[code]?.name ?? '—'
  return (
    <div>
      <div className="kgrid k5" style={{ marginBottom: 18 }}>
        <KPI icon="brief" label="Projects" value={list.length} sub={`${list.filter((i) => i.stage !== 'done').length} active`} />
        <KPI icon="check" label="On track" value={list.filter((i) => i.health === 'on' || i.health === 'done').length} sub={`${list.filter((i) => i.health === 'risk').length} at risk`} />
        <KPI icon="trend" label="Avg complete" value={Math.round(list.reduce((a, i) => a + i.progress, 0) / (list.length || 1)) + '%'} />
        <KPI icon="brief" label="Budget" value={(totBudget / 1000).toFixed(1) + ' M'} sub="committed total" />
        <KPI icon="activity" label="Spent" value={(totBudget ? Math.round(totSpent / totBudget * 100) : 0) + '%'} sub={`${(totSpent / 1000).toFixed(1)} M of ${(totBudget / 1000).toFixed(1)} M`} />
      </div>
      <table className="tbl proj-tbl">
        <thead><tr>
          <th>Project</th><th>Manager</th><th>Team</th><th>Window</th><th className="num">Budget</th>
          <th style={{ width: 150 }}>Progress</th><th>Health</th>
        </tr></thead>
        <tbody>
          {list.map((i) => {
            const sc = projScore(i)
            const burn = Math.round(i.spent / i.budget * 100) || 0
            return (
              <tr key={i.id} onClick={() => ctx.openDetail(i.id)}>
                <td>
                  <div className="cellrow">
                    <span className={'score-tile ' + scoreCls(+sc)} style={{ minWidth: 40, padding: '5px 5px' }}>
                      <span className="sv">{sc}</span><span className="sx">/10</span>
                    </span>
                    <div>
                      <div className="tt">{i.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--n-400)' }}>{i.key} · {pillarName(i.pillar)}</div>
                    </div>
                  </div>
                </td>
                <td><div className="cellrow"><Avatar id={i.owner} size="xs" /><span>{ownerFirst(i, P)}</span></div></td>
                <td><AvatarStack ids={[i.owner, ...i.team]} /></td>
                <td style={{ color: 'var(--n-600)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{MONTHS[i.s]}–{MONTHS[i.e]}</td>
                <td className="num">
                  <div style={{ fontWeight: 600 }}>{(i.spent / 1000).toFixed(1)}/{(i.budget / 1000).toFixed(1)}M</div>
                  <div style={{ fontSize: 11, color: burn > 90 ? 'var(--critical)' : 'var(--n-400)' }}>{burn}% spent</div>
                </td>
                <td>
                  <div className="statline">
                    <span className="mini-bar"><i style={{ width: i.progress + '%', background: pfAccent(i.pillar) }} /></span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--n-600)' }} className="tnum">{i.progress}%</span>
                  </div>
                </td>
                <td><HealthBadge h={i.health} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WaterfallTab({ list }: { list: StrategyInitiative[] }) {
  const ctx = useExec()
  const sorted = list.slice().sort((a, b) => a.s - b.s || a.e - b.e)
  const pfAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'
  return (
    <div>
      <div className="lead" style={{ marginBottom: 14 }}>Each initiative is a project with phased delivery. Expand a project to see its tasks; diamonds mark milestones, the red line is today.</div>
      <div className="wf" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 880 }}>
          <div className="wf-head">
            <div className="wf-corner">Project · task</div>
            <div className="wf-months">{MONTHS.map((m, k) => <div key={m} className={'wf-m' + (k % 3 === 0 ? ' q' : '')}>{m}</div>)}</div>
          </div>
          <div style={{ position: 'relative' }}>
            {sorted.map((i) => {
              const left = i.s / 12 * 100, width = (i.e - i.s + 1) / 12 * 100
              const ac = pfAccent(i.pillar)
              // tasks land in a later wave: no tasks, no milestones, no phase split yet.
              const phases = Math.min(3, Math.max(2, Math.round((i.e - i.s + 1) / 3)))
              return (
                <div key={i.id} className="wf-row proj">
                  <div className="wf-lbl" onClick={() => ctx.openDetail(i.id)}>
                    <Icon name="cright" cls="wf-chev" />
                    <span className="pdot" style={{ background: ac }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{i.title}</div>
                      <div className="k">{i.key} · 0 tasks</div>
                    </div>
                  </div>
                  <div className="wf-track">
                    {MONTHS.map((_m, k) => <div key={k} className={'c' + (k % 3 === 0 ? ' q' : '')} />)}
                    <div className="wf-bar" style={{ left: `calc(${left}% + 3px)`, width: `calc(${width}% - 6px)`, background: ac }}
                      onClick={() => ctx.openDetail(i.id)} title={i.title}>
                      <div className="fill" style={{ width: i.progress + '%' }} />
                      <span>{i.progress}%</span>
                    </div>
                    {Array.from({ length: phases - 1 }).map((_, p) => {
                      const px = i.s + (i.e - i.s + 1) * (p + 1) / phases
                      return <div key={p} style={{ position: 'absolute', left: px / 12 * 100 + '%', top: 11, bottom: 11, width: 1, background: 'rgba(255,255,255,.5)', zIndex: 2 }} />
                    })}
                  </div>
                </div>
              )
            })}
            <div className="wf-today" style={{ left: `calc(300px + ${TODAY_M / 12} * (100% - 300px))` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkloadTab({ list }: { list: StrategyInitiative[] }) {
  const { people } = useToolsData()
  // tasks land in a later wave: workload bars show owned/on-team counts only.
  const data = people.map((p) => {
    const owned = list.filter((i) => i.owner === p.id).length
    const member = list.filter((i) => (i.team || []).includes(p.id) && i.owner !== p.id).length
    const by = { todo: 0, doing: 0, blocked: 0, done: 0 }
    return { p, tasks: 0, owned, member, by }
  }).sort((a, b) => b.tasks - a.tasks)
  const maxTasks = Math.max(1, ...data.map((d) => d.tasks))
  const stc: Record<string, string> = { todo: '#cdd3d0', doing: '#5b8fc9', blocked: '#d8796d', done: '#5fae86' }
  return (
    <div>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
        <Card className="p5" style={{ flex: '1 1 280px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>How to read this</div>
          <div style={{ fontSize: 13, color: 'var(--n-600)', lineHeight: 1.6 }}>Each bar is a person's open task load across the filtered projects, split by status. Use it to spot who is overloaded or blocked before committing more work.</div>
          <div className="lchips" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
            {([['To do', 'todo'], ['In progress', 'doing'], ['Blocked', 'blocked'], ['Done', 'done']] as Array<[string, string]>).map(([l, k]) => (
              <span key={k} className="lchip"><span className="d" style={{ background: stc[k] }} />{l}</span>
            ))}
          </div>
        </Card>
      </div>
      <Card className="p5">
        {data.map((d) => (
          <div key={d.p.id} className="wl-row">
            <div className="wl-name"><Avatar id={d.p.id} size="sm" />
              <div><div>{d.p.name}</div><div style={{ fontSize: 11, color: 'var(--n-500)', fontWeight: 500 }}>{d.owned} owned · {d.member} on team</div></div>
            </div>
            <div className="wl-track">
              {(['doing', 'blocked', 'todo', 'done'] as Array<keyof typeof d.by>).map((k) => d.by[k] > 0 && (
                <div key={k} className="wl-seg" style={{ width: d.by[k] / maxTasks * 100 + '%', background: stc[k] }} title={`${d.by[k]} ${k}`} />
              ))}
            </div>
            <div className="wl-num">{d.tasks}</div>
          </div>
        ))}
      </Card>
    </div>
  )
}

function MilestonesTab() {
  // Milestones derive from high-priority tasks, which land in a later wave.
  return (
    <div>
      <div className="lead" style={{ marginBottom: 14 }}>Key milestones across the portfolio — the high-priority deliverables every project is judged on, in date order.</div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <EmptyState icon="flag" title="No milestones yet" sub="Milestones appear here once tasks land in a later wave." />
      </Card>
    </div>
  )
}

type PortfolioTab = 'projects' | 'waterfall' | 'workload' | 'milestones'
function PortfolioView() {
  const ctx = useExec()
  const [tab, setTab] = useState<PortfolioTab>('projects')
  const list = applyFilters(ctx.initiatives, ctx.filters)
  const tabs: Array<{ id: PortfolioTab; label: string; icon: string }> = [
    { id: 'projects', label: 'Projects', icon: 'brief' },
    { id: 'waterfall', label: 'Waterfall', icon: 'gantt' },
    { id: 'workload', label: 'Workload', icon: 'users' },
    { id: 'milestones', label: 'Milestones', icon: 'flag' },
  ]
  return (
    <div>
      <PageHead title="Project portfolio" sub="Every initiative managed as a project — scope, schedule, budget, team and milestones in one place."
        actions={<button className="btn btn--primary sm" onClick={ctx.openNew}><Icon name="plus" cls="sm" /> New project</button>} />
      <FilterBar filters={ctx.filters} setFilters={ctx.setFilters} />
      <div className="subtabs">
        {tabs.map((t) => <div key={t.id} className={'subtab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}><Icon name={t.icon} cls="sm" />{t.label}</div>)}
      </div>
      {tab === 'projects' && <ProjectsTab list={list} />}
      {tab === 'waterfall' && <WaterfallTab list={list} />}
      {tab === 'workload' && <WorkloadTab list={list} />}
      {tab === 'milestones' && <MilestonesTab />}
    </div>
  )
}

/* ───────────────────────── HISTORY / DECISION LOG ─────────────────────────
   Kept defined for when the decision-log table lands; fed [] for now. */

type HistoryEntry = {
  id: string
  ini: string | null
  type: 'decision' | 'milestone' | 'risk' | 'update' | 'edit'
  date: string
  title: string
  detail: string
  who: string
}
const HTYPE: Record<HistoryEntry['type'], { label: string; icon: string }> = {
  decision: { label: 'Decision', icon: 'flag' }, milestone: { label: 'Milestone', icon: 'award' },
  risk: { label: 'Risk', icon: 'alert' }, update: { label: 'Update', icon: 'activity' }, edit: { label: 'Edit', icon: 'pencil' },
}

function HistoryTimeline({ entries, compact }: { entries: HistoryEntry[]; compact?: boolean }) {
  const ctx = useExec()
  const { P, fmtDate } = useToolsData()
  return (
    <div className="tline">
      {entries.map((h) => {
        const ini = h.ini ? ctx.initiatives.find((x) => x.id === h.ini) : null
        return (
          <div key={h.id} className="tl-item">
            <div className="tl-date">{fmtDate(h.date)}</div>
            <div className="tl-main">
              <div className={'tl-dot ' + h.type}><i /></div>
              <div className="tl-card">
                <div className="row ac" style={{ gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className="badge badge--neutral"><Icon name={HTYPE[h.type].icon} cls="xs" />{HTYPE[h.type].label}</span>
                  {ini && !compact && <span className="chip" style={{ cursor: 'pointer' }} onClick={() => ctx.openDetail(ini.id)}><span className="pdot" style={{ background: ctx.pillarByCode[ini.pillar]?.color ?? 'var(--forest)' }} />{ini.key}</span>}
                </div>
                <div className="tlt">{h.title}</div>
                <div className="tld">{h.detail}</div>
                <div className="tlm"><Avatar id={h.who} size="xs" /> {P[h.who]?.name ?? '—'}{P[h.who]?.role ? ` · ${P[h.who]?.role}` : ''}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── DETAIL VIEW ───────────────────────── */

function DepRow({ ini, dir }: { ini: StrategyInitiative; dir: 'in' | 'out' }) {
  const ctx = useExec()
  const dAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'
  return (
    <div className="row ac" style={{ gap: 11, padding: '11px 0', borderBottom: '1px solid var(--n-100)', cursor: 'pointer' }} onClick={() => ctx.openDetail(ini.id)}>
      <Icon name={dir === 'in' ? 'cleft' : 'cright'} cls="sm" />
      <span className="pdot" style={{ background: dAccent(ini.pillar) }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{ini.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--n-400)' }}>{ini.key}</div>
      </div>
      <div style={{ width: 70 }}><Bar pct={ini.progress} color={dAccent(ini.pillar)} thin /></div>
      <HealthBadge h={ini.health} />
    </div>
  )
}

/* Tasks tab is empty until task↔initiative linking lands in a later wave. */
function InitiativeTaskTable() {
  return <EmptyState icon="check" title="No linked tasks yet" sub="Tasks can be linked to this initiative in a later wave." />
}

const RACI_ROLES: RaciRole[] = ['R', 'A', 'C', 'I']
const RACI_LABEL: Record<RaciRole, string> = { R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' }

function DetailView() {
  const ctx = useExec()
  const { people, P } = useToolsData()
  const [tab, setTab] = useState('info')
  const [depPick, setDepPick] = useState('')
  const [raciPerson, setRaciPerson] = useState('')
  // The detail panel is remounted per initiative (key={detailId} at the call
  // site), so tab + picker state reset naturally — no reset effect needed.
  const i = ctx.detailId ? ctx.initiatives.find((x) => x.id === ctx.detailId) : undefined
  if (!i) return null
  const pl = ctx.pillarByCode[i.pillar]
  const prereqs = i.depends.map((d) => ctx.initiatives.find((x) => x.id === d)).filter((x): x is StrategyInitiative => !!x)
  const dependents = ctx.initiatives.filter((x) => x.depends.includes(i.id))
  const raci = ctx.raci[i.id] || {}
  const hist: HistoryEntry[] = [] // decision log lands in a later wave
  const risks = ctx.risks.filter((r) => r.initiativeId === i.id)
  const qLabel = (m: number) => QUARTERS[Math.floor(m / 3)].label
  const ownerName = P[i.owner]?.name ?? i.ownerName ?? '—'
  const ownerRole = P[i.owner]?.role
  // Dependency picker candidates: anything not self and not already a prerequisite.
  const depCandidates = ctx.initiatives.filter((x) => x.id !== i.id && !i.depends.includes(x.id))
  // RACI picker candidates: people not yet assigned on this initiative.
  const raciCandidates = people.filter((p) => !raci[p.name])

  const tabs = [
    { id: 'info', label: 'Information', icon: 'clip' },
    { id: 'tasks', label: 'Tasks · 0', icon: 'check' },
    { id: 'deps', label: 'Dependencies', icon: 'branch' },
    { id: 'raci', label: 'RACI', icon: 'users' },
    { id: 'history', label: 'History', icon: 'clock' },
  ]

  return (
    <div>
      <div className="crumb" onClick={() => ctx.openDetail(null)}><Icon name="cleft" cls="sm" /> Strategy · Overview</div>

      <div className="phead" style={{ marginBottom: 18 }}>
        <div className="phead__t">
          <div className="row ac" style={{ gap: 11, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: 'var(--n-400)' }}>{i.key}</span>
            {pl && <PillarChip pillar={pl} />}
          </div>
          <div className="h1 sm" style={{ marginTop: 4 }}>{i.title}</div>
          <div className="row ac" style={{ gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <HealthBadge h={i.health} /><StageBadge stage={i.stage} />
            <span style={{ fontSize: 13, color: 'var(--n-500)' }} className="row ac"><Avatar id={i.owner} size="xs" />&nbsp;{ownerName}{ownerRole ? ` · ${ownerRole}` : ''}</span>
          </div>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={() => ctx.openNewTask()}><Icon name="plus" cls="sm" /> New task</button>
          <button className="btn btn--primary sm" onClick={() => ctx.openEdit(i.id)}><Icon name="pencil" cls="sm" /> Edit initiative</button>
        </div>
      </div>

      <div className="kgrid" style={{ marginBottom: 22 }}>
        <KPI icon="trend" label="Progress" value={i.progress + '%'} sub="0 of 0 tasks done" />
        <KPI icon="cal" label="Window" value={`${qLabel(i.s)}–${qLabel(i.e)}`} sub={`${MONTHS[i.s]}–${MONTHS[i.e]} 2026`} />
        <KPI icon="brief" label="Budget" value={(i.spent / 1000).toFixed(1) + ' M'} sub={`of ${(i.budget / 1000).toFixed(1)} M NOK`} />
        <KPI icon="target" label="Pillar" value={pl ? pl.name : '—'} tone="serif" sub={pl ? `${pl.name} pillar` : 'No pillar'} />
      </div>

      <div className="subtabs">
        {tabs.map((t) => (
          <div key={t.id} className={'subtab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} cls="sm" />{t.label}
          </div>
        ))}
      </div>

      {tab === 'info' && (
        <div className="row" style={{ gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="grow stack" style={{ minWidth: 320 }}>
            <Card className="p5">
              <div className="eyebrow fg row"><Icon name="shield" cls="sm" /> Summary</div>
              <textarea className="ta" style={{ marginTop: 8 }} value={i.summary} placeholder="One sentence on the outcome." onChange={(e) => ctx.update(i.id, { summary: e.target.value })} />
            </Card>
            <Card className="p5">
              <div className="eyebrow" style={{ marginBottom: 4 }}>Progress &amp; health</div>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <Field label="Health">
                  <Seg<InitiativeHealth> value={i.health} onChange={(v) => ctx.update(i.id, { health: v })}
                    options={[{ v: 'on', label: 'On track' }, { v: 'risk', label: 'At risk' }, { v: 'off', label: 'Off track' }, { v: 'done', label: 'Completed' }]} />
                </Field>
              </div>
              <Field label={`Progress — ${i.progress}%`}>
                <input type="range" min="0" max="100" value={i.progress} onChange={(e) => ctx.update(i.id, { progress: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--forest)' }} />
                <Bar pct={i.progress} color={pl ? pl.color : 'var(--forest)'} />
              </Field>
            </Card>
            {risks.length > 0 && (
              <Card className="p5">
                <div className="eyebrow" style={{ marginBottom: 12 }}>Risks</div>
                {risks.map((r) => (
                  <div key={r.id} className="row" style={{ gap: 11, padding: '10px 0', borderBottom: '1px solid var(--n-100)' }}>
                    <Icon name="alert" cls="sm" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{r.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--n-600)', marginTop: 3 }}>{r.mitigation}</div>
                    </div>
                    <span className={'badge badge--' + (r.status === 'open' ? 'warn' : 'neutral')} style={{ alignSelf: 'flex-start' }}>{r.status}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
          <aside className="siderail stack sm">
            <Card className="p">
              <div className="eyebrow">Details</div>
              <div className="deflist" style={{ marginTop: 8 }}>
                <div className="defrow"><span className="defk">Owner</span><span className="defv"><Avatar id={i.owner} size="xs" />{ownerName}</span></div>
                <div className="defrow"><span className="defk">Team</span><span className="defv"><AvatarStack ids={i.team} /></span></div>
                <div className="defrow"><span className="defk">Pillar</span><span className="defv">{pl ? pl.name : '—'}</span></div>
                <div className="defrow"><span className="defk">Stage</span><span className="defv">{STAGE_META[i.stage].label}</span></div>
                <div className="defrow"><span className="defk">Window</span><span className="defv">{MONTHS[i.s]}–{MONTHS[i.e]} 2026</span></div>
                <div className="defrow"><span className="defk">Budget</span><span className="defv tnum">{(i.spent / 1000).toFixed(1)} / {(i.budget / 1000).toFixed(1)} M</span></div>
              </div>
            </Card>
            <HumanNote>Progress and health are set by the owner against the plan. The numbers inform the conversation; they don't decide it.</HumanNote>
          </aside>
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="lead" style={{ margin: 0 }}>0 of 0 tasks complete · 0 blocked</div>
            <button className="btn sm" onClick={() => ctx.openNewTask()}><Icon name="plus" cls="sm" /> New task</button>
          </div>
          <InitiativeTaskTable />
        </div>
      )}

      {tab === 'deps' && (
        <div className="row" style={{ gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Card className="p5 grow" style={{ minWidth: 300 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Prerequisites</div>
            <div style={{ fontSize: 12.5, color: 'var(--n-500)', marginBottom: 14 }}>Must complete before this initiative can finish.</div>
            {prereqs.length === 0 ? <div style={{ fontSize: 13, color: 'var(--n-500)' }}>No prerequisites — this can start independently.</div>
              : prereqs.map((p) => (
                <div key={p.id} className="row ac" style={{ gap: 8 }}>
                  <div style={{ flex: 1 }}><DepRow ini={p} dir="in" /></div>
                  <button className="btn btn--ghost sm" onClick={() => ctx.removeDep(i.id, p.id)} aria-label="Remove dependency"><Icon name="x" cls="xs" /></button>
                </div>
              ))}
            {depCandidates.length > 0 && (
              <div className="row ac" style={{ gap: 8, marginTop: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <select className="input" value={depPick} onChange={(e) => setDepPick(e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: 34, cursor: 'pointer' }}>
                    <option value="">Add a prerequisite…</option>
                    {depCandidates.map((c) => <option key={c.id} value={c.id}>{c.key} · {c.title}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--n-400)' }}><Icon name="cdown" cls="xs" /></span>
                </div>
                <button className="btn btn--primary sm" disabled={!depPick} onClick={() => { if (depPick) { ctx.addDep(i.id, depPick); setDepPick('') } }}><Icon name="plus" cls="sm" /> Add</button>
              </div>
            )}
          </Card>
          <Card className="p5 grow" style={{ minWidth: 300 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Dependents</div>
            <div style={{ fontSize: 12.5, color: 'var(--n-500)', marginBottom: 14 }}>Initiatives waiting on this one.</div>
            {dependents.length === 0 ? <div style={{ fontSize: 13, color: 'var(--n-500)' }}>Nothing depends on this initiative.</div>
              : dependents.map((p) => <DepRow key={p.id} ini={p} dir="out" />)}
          </Card>
        </div>
      )}

      {tab === 'raci' && (
        <Card className="p5">
          <div className="eyebrow" style={{ marginBottom: 14 }}>Responsibility assignment</div>
          {ctx.raciPeople.filter((label) => raci[label]).map((label) => (
            <div key={label} className="row ac" style={{ gap: 12, padding: '11px 0', borderBottom: '1px solid var(--n-100)' }}>
              <Avatar id={label} size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{P[label]?.name ?? label}</div>
                <div style={{ fontSize: 12, color: 'var(--n-500)' }}>{P[label]?.role ?? ''}</div>
              </div>
              <div className="seg">
                {RACI_ROLES.map((role) => (
                  <div key={role} className={'segopt' + (raci[label] === role ? ' on' : '')} onClick={() => ctx.setRaci(i.id, label, raci[label] === role ? null : role)}>{role}</div>
                ))}
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--n-600)', width: 96 }}>{RACI_LABEL[raci[label]]}</span>
              <button className="btn btn--ghost sm" onClick={() => ctx.setRaci(i.id, label, null)} aria-label="Remove person"><Icon name="x" cls="xs" /></button>
            </div>
          ))}
          {raciCandidates.length > 0 && (
            <div className="row ac" style={{ gap: 8, marginTop: 14 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <select className="input" value={raciPerson} onChange={(e) => setRaciPerson(e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: 34, cursor: 'pointer' }}>
                  <option value="">Add a person…</option>
                  {raciCandidates.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--n-400)' }}><Icon name="cdown" cls="xs" /></span>
              </div>
              <button className="btn btn--primary sm" disabled={!raciPerson} onClick={() => { if (raciPerson) { ctx.setRaci(i.id, raciPerson, 'R'); setRaciPerson('') } }}><Icon name="plus" cls="sm" /> Add</button>
            </div>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <div>
          {hist.length === 0 ? <EmptyState icon="clock" title="No decision-log entries yet" sub="The decision log arrives in a later wave." />
            : <HistoryTimeline entries={hist} compact />}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── INITIATIVE FORM (create / edit) ───────────────────────── */

function A2Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: 34, cursor: 'pointer' }}>{children}</select>
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--n-400)' }}><Icon name="cdown" cls="xs" /></span>
    </div>
  )
}

const A2_QS = [{ v: 0, l: 'Q1 (Jan)' }, { v: 3, l: 'Q2 (Apr)' }, { v: 6, l: 'Q3 (Jul)' }, { v: 9, l: 'Q4 (Oct)' }]
const A2_QE = [{ v: 2, l: 'Q1 (Mar)' }, { v: 5, l: 'Q2 (Jun)' }, { v: 8, l: 'Q3 (Sep)' }, { v: 11, l: 'Q4 (Dec)' }]

type InitiativeFormState = {
  id?: string
  key?: string
  title: string
  summary: string
  pillar: string
  owner: string
  stage: InitiativeStage
  s: number
  e: number
  progress: number
  health: InitiativeHealth
}

function InitiativeForm({ initial, mode, onCancel, onSave }: {
  initial: InitiativeFormState
  mode: 'new' | 'edit'
  onCancel: () => void
  onSave: (f: InitiativeFormState) => void
}) {
  const ctx = useExec()
  const { people } = useToolsData()
  const [f, setF] = useState<InitiativeFormState>(initial)
  const set = <K extends keyof InitiativeFormState>(k: K, v: InitiativeFormState[K]) => setF((s) => ({ ...s, [k]: v }))
  return (
    <SideWindow open onClose={onCancel} eyebrow={mode === 'edit' ? f.key : 'New initiative'} title={mode === 'edit' ? 'Edit initiative' : 'New strategic initiative'}
      footer={<div style={{ display: 'contents' }}><button className="btn btn--primary" onClick={() => onSave(f)} disabled={!f.title.trim()}><Icon name="ok" cls="sm" /> {mode === 'edit' ? 'Save changes' : 'Create initiative'}</button><button className="btn btn--ghost" onClick={onCancel}>Cancel</button></div>}>
      <Field label="Title"><input className="input" value={f.title} placeholder="What is this initiative?" onChange={(e) => set('title', e.target.value)} /></Field>
      <Field label="Summary" opt><textarea className="ta" value={f.summary} placeholder="One sentence on the outcome." onChange={(e) => set('summary', e.target.value)} /></Field>
      <Field label="Pillar"><Seg value={f.pillar} onChange={(v) => set('pillar', v)} options={ctx.pillars.map((p) => ({ v: p.code, label: p.name }))} /></Field>
      <div className="row" style={{ gap: 12 }}>
        <Field label="Owner"><A2Select value={f.owner} onChange={(v) => set('owner', v)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</A2Select></Field>
        <Field label="Stage"><A2Select value={f.stage} onChange={(v) => set('stage', v as InitiativeStage)}>{(Object.entries(STAGE_META) as Array<[InitiativeStage, { label: string }]>).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</A2Select></Field>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <Field label="Starts"><A2Select value={String(f.s)} onChange={(v) => set('s', Number(v))}>{A2_QS.map((q) => <option key={q.v} value={q.v}>{q.l}</option>)}</A2Select></Field>
        <Field label="Ends"><A2Select value={String(f.e)} onChange={(v) => set('e', Number(v))}>{A2_QE.map((q) => <option key={q.v} value={q.v}>{q.l}</option>)}</A2Select></Field>
      </div>
      {mode === 'edit' && (
        <div style={{ display: 'contents' }}>
          <Field label="Health"><Seg<InitiativeHealth> value={f.health} onChange={(v) => set('health', v)} options={[{ v: 'on', label: 'On track' }, { v: 'risk', label: 'At risk' }, { v: 'off', label: 'Off track' }, { v: 'done', label: 'Completed' }]} /></Field>
          <Field label={`Progress — ${f.progress}%`}><input type="range" min="0" max="100" value={f.progress} onChange={(e) => set('progress', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--forest)' }} /><Bar pct={f.progress} /></Field>
        </div>
      )}
    </SideWindow>
  )
}

/* ───────────────────────── WORKSPACE (container + provider) ───────────────────────── */

export function ExecutionWorkspace() {
  const toast = useToolsToast()
  const { P } = useToolsData()
  const ini = useStrategyInitiatives()
  const { pillars } = useStrategyFoundation()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') || 'overview') as ExecView
  const [detailId, setDetailId] = useState<string | null>(null)
  const [side, setSide] = useState<SideState | null>(null)
  const [filters, setFilters] = useState<Filters>({ pillar: 'all', owner: 'all', q: '' })

  const pillarByCode: Record<string, StrategyPillar> = {}
  for (const p of pillars) pillarByCode[p.code] = p

  const setView = (v: ExecView) => { setDetailId(null); setParams({ view: v }) }
  const openDetail = (id: string | null) => { setDetailId(id); if (id) window.scrollTo({ top: 0 }) }
  const noTasks = () => toast('Task editing arrives in a later wave')

  const ctxValue: ExecContextValue = {
    initiatives: ini.initiatives,
    risks: ini.risks,
    raci: ini.raci,
    raciPeople: ini.raciPeople,
    pillars,
    pillarByCode,
    filters,
    setFilters,
    detailId,
    openDetail,
    openNew: () => setSide({ type: 'new' }),
    openEdit: (id) => setSide({ type: 'edit', id }),
    openTask: noTasks,
    openNewTask: noTasks,
    moveInitiative: (id, stage) => { void ini.moveStage(id, stage) },
    toggleTask: noTasks,
    setView,
    toast,
    update: ini.update,
    remove: ini.remove,
    addDep: ini.addDep,
    removeDep: ini.removeDep,
    setRaci: ini.setRaci,
    addRisk: ini.addRisk,
    updateRisk: ini.updateRisk,
    removeRisk: ini.removeRisk,
    create: ini.create,
  }

  async function saveInitiative(f: InitiativeFormState) {
    if (side?.type === 'edit' && f.id) {
      await ini.update(f.id, {
        title: f.title, summary: f.summary, pillar: f.pillar, owner: f.owner,
        stage: f.stage, s: f.s, e: f.e, progress: f.progress, health: f.health,
      })
      toast(`${f.key ?? 'Initiative'} updated`)
    } else {
      await ini.create({
        title: f.title, summary: f.summary, pillar: f.pillar, ownerId: f.owner,
        ownerName: P[f.owner]?.name ?? '', stage: f.stage, s: f.s, e: f.e,
        progress: f.progress, health: f.health,
      })
      toast('Initiative created')
    }
    setSide(null)
  }

  if (ini.loading) {
    return (
      <div>
        <PageHead title="Initiatives" sub="Laster initiativer…" />
      </div>
    )
  }

  return (
    <ExecCtx.Provider value={ctxValue}>
      <PageHead title="Initiatives" />
      {ini.error && <HumanNote>{ini.error}</HumanNote>}
      {view === 'overview' && <OverviewView />}
      {view === 'projects' && <PortfolioView />}
      {view === 'gantt' && <GanttView />}
      {view === 'roadmap' && <RoadmapView />}
      {view === 'kanban' && <KanbanView />}
      {view === 'tasks' && <TasksView />}

      {detailId && <DetailView key={detailId} />}

      {side && (
        <InitiativeForm
          mode={side.type === 'edit' ? 'edit' : 'new'}
          initial={side.type === 'edit'
            ? (() => {
                const e = ini.initiatives.find((x) => x.id === side.id)
                return {
                  id: e?.id, key: e?.key, title: e?.title ?? '', summary: e?.summary ?? '',
                  pillar: e?.pillar ?? (pillars[0]?.code ?? ''), owner: e?.owner ?? '',
                  stage: e?.stage ?? 'planned', s: e?.s ?? 0, e: e?.e ?? 2,
                  progress: e?.progress ?? 0, health: e?.health ?? 'on',
                }
              })()
            : { title: '', summary: '', pillar: pillars[0]?.code ?? '', owner: '', stage: 'planned', s: 0, e: 2, progress: 0, health: 'on' }}
          onCancel={() => setSide(null)}
          onSave={saveInitiative}
        />
      )}
    </ExecCtx.Provider>
  )
}
