/* Strategy v2 — Alignment map (the whole strategy as one cascading tree).

   Faithful 1:1 UI port of the design package's views_alignment.jsx
   (AlignmentMapView + AlignNode + buildAlignTree/layoutTree/edgePath/
   lateralPath). Company → Pillar → Team → Objective → Initiative, with pan/
   zoom/fit, collapse/expand families, roll-up scores, derived status,
   staleness flags, lateral cross-links (contributes_to / drives), a status
   filter and an Unaligned rail. The design's window.SD globals are replaced
   by the real Strategy hooks (foundation/okr/initiatives/org-graph/cadence)
   and the people lookup from useToolsData — no window.*, no localStorage.

   Degradations vs the design (no data source loaded for these yet):
   - Catchball state is omitted (the chip slot renders empty), since no
     catchball table is wired.
   - objTeam is derived by matching an objective's pillar to the first team
     in that pillar (the design carried an explicit objective→team map).
   - Orphans are derived (initiatives with neither objective nor pillar);
     drag-to-align is a toast stub. The count chips that the design fed from
     risks/measures/tasks are limited to fields we actually load. */

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  AvatarStack,
  Icon,
  PageHead,
  useToolsData,
} from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { scoreColor, iniScore, nowMs } from './strategyDerive'
import { useStrategyFoundation } from '../../hooks/useStrategyFoundation'
import { useStrategyOkr } from '../../hooks/useStrategyOkr'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import { useStrategyOrgGraph } from '../../hooks/useStrategyOrgGraph'
import { useStrategyCadence } from '../../hooks/useStrategyCadence'
import type { StrategyPillar, StrategyInitiative } from '../../types/strategyTools'
import type { StrategyOkrObjective } from '../../hooks/useStrategyOkr'
import type { StrategyTeam, ObjectiveEdge } from '../../hooks/useStrategyOrgGraph'
import type { StrategyCheckin } from '../../hooks/useStrategyCadence'

/* CSS custom properties (`--ac`) are set via inline style throughout the
   design's markup; React.CSSProperties doesn't model them, so allow them. */
type CSSVars = React.CSSProperties & Record<string, string | number>

/* ───────────────────────── node status ───────────────────────── */

type NodeStatus = 'on' | 'risk' | 'off' | 'done'
type CountEntry = [string, number]

type NodeMeta = {
  id: string
  depth: number
  kind: 'Company' | 'Pillar' | 'Team' | 'Objective' | 'Initiative'
  title: string
  owner: string | null
  ac: string
  score: string
  pillar?: string
  team?: string
  objId?: string
  iniId?: string
  status?: NodeStatus
  members?: string[]
  team2?: string[]
  catchball?: string
  stale?: boolean
  staleDays?: number
  counts: CountEntry[]
}

type AlignTree = {
  meta: Record<string, NodeMeta>
  childrenOf: Record<string, string[]>
  lateral: Array<{ from: string; to: string; type: ObjectiveEdge['type'] }>
}

/** Coarse 0..10 status thresholds mirror the design's statusFromScore. */
function statusFromScore(v: number): NodeStatus {
  if (v >= 7) return 'on'
  if (v >= 4) return 'risk'
  return 'off'
}

/* ───────────────────────── tree builder (replaces buildAlignTree) ───────────────────────── */

type TreeInputs = {
  pillars: StrategyPillar[]
  teams: StrategyTeam[]
  objectives: StrategyOkrObjective[]
  initiatives: StrategyInitiative[]
  edges: ObjectiveEdge[]
  staleByIni: Record<string, number>
  P: Record<string, { name: string }>
  orgName: string
}

function buildAlignTree(input: TreeInputs): AlignTree {
  const { pillars, teams, objectives, initiatives, edges, staleByIni, orgName } = input
  const meta: Record<string, NodeMeta> = {}
  const childrenOf: Record<string, string[]> = {}
  const objNodeId: Record<string, string> = {}
  const allInis = initiatives
  const sc10 = (s01: number): string => (s01 * 10).toFixed(1)

  /** 0..10 score for an objective from its 0..1 progress. */
  const objScore = (o: StrategyOkrObjective): number => Math.max(0, Math.min(10, o.progress * 10))

  // First team per pillar carries that pillar's objectives (objTeam derivation).
  const firstTeamByPillar: Record<string, string> = {}
  for (const t of teams) if (t.pillar && !(t.pillar in firstTeamByPillar)) firstTeamByPillar[t.pillar] = t.id

  // Initiatives grouped by objective id, with a pillar fallback bucket.
  const inisByObj: Record<string, StrategyInitiative[]> = {}
  for (const i of allInis) if (i.objectiveId) (inisByObj[i.objectiveId] ||= []).push(i)
  const objsByPillar: Record<string, StrategyOkrObjective[]> = {}
  for (const o of objectives) if (o.pillar) (objsByPillar[o.pillar] ||= []).push(o)

  // Per-pillar / per-team roll-up score accumulators.
  const objScoreById: Record<string, number> = {}
  for (const o of objectives) objScoreById[o.id] = objScore(o)

  const teamScore = (teamId: string, pillarCode: string): number => {
    // A team's objectives = pillar objectives routed to it (objTeam derivation:
    // a pillar's objectives hang off that pillar's first team).
    const isRoutingTeam = (firstTeamByPillar[pillarCode] ?? '') === teamId
    const objs = isRoutingTeam ? (objsByPillar[pillarCode] || []) : []
    if (objs.length === 0) return 0
    return objs.reduce((a, o) => a + objScoreById[o.id], 0) / objs.length
  }
  const pillarScore = (pillarCode: string): number => {
    const objs = objsByPillar[pillarCode] || []
    if (objs.length === 0) return 0
    return objs.reduce((a, o) => a + objScoreById[o.id], 0) / objs.length
  }

  // root
  const rootScore = pillars.length
    ? pillars.reduce((a, p) => a + pillarScore(p.code), 0) / pillars.length
    : 0
  meta.root = {
    id: 'root', depth: 0, kind: 'Company', title: (orgName || 'Selskapet') + ' · 2026 strategy',
    score: sc10(rootScore), owner: null, ac: '#1a3d32',
    counts: [['target', objectives.length], ['grid', allInis.length]],
  }
  childrenOf.root = pillars.map((p) => 'pl-' + p.id)

  pillars.forEach((p) => {
    const pScore = pillarScore(p.code)
    const pTeams = teams.filter((t) => t.pillar === p.code)
    meta['pl-' + p.id] = {
      id: 'pl-' + p.id, depth: 1, kind: 'Pillar', title: p.name, owner: null, ac: p.color,
      score: sc10(pScore), pillar: p.code, status: statusFromScore(pScore),
      counts: [['users', pTeams.length], ['target', (objsByPillar[p.code] || []).length]],
    }
    childrenOf['pl-' + p.id] = pTeams.map((t) => 'tm-' + t.id)

    pTeams.forEach((t) => {
      const tScore = teamScore(t.id, p.code)
      // Objectives routed to this team = pillar objectives whose pillar's first team is this one.
      const objs = (objsByPillar[p.code] || []).filter((o) => (firstTeamByPillar[p.code] ?? '') === t.id && o.pillar === p.code)
      meta['tm-' + t.id] = {
        id: 'tm-' + t.id, depth: 2, kind: 'Team', title: t.name, owner: t.lead || null, ac: p.color,
        score: sc10(tScore), pillar: p.code, team: t.id, status: statusFromScore(tScore), members: t.members,
        counts: [['target', objs.length], ['users', t.members.length]],
      }
      childrenOf['tm-' + t.id] = objs.map((o) => 'ob-' + o.id)

      objs.forEach((o) => {
        const oScore = objScoreById[o.id]
        const inisO = (inisByObj[o.id] || [])
        objNodeId[o.id] = 'ob-' + o.id
        meta['ob-' + o.id] = {
          id: 'ob-' + o.id, depth: 3, kind: 'Objective', title: o.title, owner: o.owner || null, ac: p.color,
          score: sc10(oScore), pillar: p.code, team: t.id, objId: o.id,
          status: statusFromScore(oScore),
          counts: [['activity', o.krs.length], ['grid', inisO.length]],
        }
        childrenOf['ob-' + o.id] = inisO.map((i) => 'in-' + i.id)

        inisO.forEach((i) => {
          const stale = staleByIni[i.id] ?? 999
          const team2 = [i.owner, ...i.team].filter(Boolean)
          meta['in-' + i.id] = {
            id: 'in-' + i.id, depth: 4, kind: 'Initiative', title: i.title, owner: i.owner || i.ownerName || null, ac: p.color,
            score: sc10(iniScore(i) / 10), pillar: i.pillar, team: t.id, iniId: i.id,
            status: i.health, team2: team2.length ? team2 : undefined, staleDays: stale, stale: stale > 14,
            counts: [['branch', i.depends.length]],
          }
          childrenOf['in-' + i.id] = []
        })
      })
    })
  })
  // lateral edges between objective nodes
  const lateral = edges
    .map((e) => ({ from: objNodeId[e.from], to: objNodeId[e.to], type: e.type }))
    .filter((e) => e.from && e.to)
  return { meta, childrenOf, lateral }
}

const NW = 268, NH = 86, COLW = 320, ROWH = 104, PAD = 40

function layoutTree(tree: AlignTree, collapsed: Set<string>, visibleSet: Set<string> | null): { pos: Record<string, { x: number; y: number }>; width: number; height: number } {
  const pos: Record<string, { x: number; y: number }> = {}
  let cursor = PAD
  function place(id: string): void {
    if (visibleSet && !visibleSet.has(id)) return
    const node = tree.meta[id]
    if (!node) return
    const kids = (collapsed.has(id) ? [] : (tree.childrenOf[id] || [])).filter((c) => !visibleSet || visibleSet.has(c))
    if (kids.length === 0) { pos[id] = { x: PAD + node.depth * COLW, y: cursor }; cursor += ROWH }
    else {
      kids.forEach(place)
      const placedKids = kids.filter((c) => pos[c])
      if (placedKids.length === 0) { pos[id] = { x: PAD + node.depth * COLW, y: cursor }; cursor += ROWH; return }
      const fy = pos[placedKids[0]].y, ly = pos[placedKids[placedKids.length - 1]].y
      pos[id] = { x: PAD + node.depth * COLW, y: (fy + ly) / 2 }
    }
  }
  place('root')
  let maxD = 0
  Object.keys(pos).forEach((id) => { maxD = Math.max(maxD, tree.meta[id]?.depth ?? 0) })
  return { pos, width: PAD * 2 + maxD * COLW + NW, height: Math.max(cursor + PAD - ROWH + NH, 360) }
}

function parentOf(tree: AlignTree, id: string): string | null {
  for (const pid in tree.childrenOf) { if (tree.childrenOf[pid].includes(id)) return pid }
  return null
}

/* ───────────────────────── AlignNode ───────────────────────── */

const ST_CLS: Record<NodeStatus, string> = { on: 'on', risk: 'risk', off: 'off', done: 'done' }
const ST_LBL: Record<NodeStatus, string> = { on: 'On track', risk: 'At risk', off: 'Off track', done: 'Done' }

function AlignNode({ id, meta, p, selected, onSelect, onOpen }: {
  id: string
  meta: NodeMeta
  p: { x: number; y: number }
  selected: boolean
  onSelect: (id: string) => void
  onOpen: (iniId: string) => void
}) {
  const sc = +meta.score
  const status: NodeStatus = meta.status ?? 'on'
  const stCls = ST_CLS[status] || 'on'
  const stLbl = ST_LBL[status] || 'On track'
  return (
    <div className={'amap-node' + (selected ? ' sel' : '')} style={{ left: p.x, top: p.y, width: NW, height: NH, '--ac': meta.ac } as CSSVars}
      onClick={(e) => { e.stopPropagation(); onSelect(id); if (meta.iniId) onOpen(meta.iniId) }}>
      <div className="an-score" style={{ background: scoreColor(sc) }}><div className="v">{meta.score}</div><div className="x">/ 10</div></div>
      <div className="an-counts">
        {meta.counts.map(([ic, n], k) => <div key={k} className="an-count"><Icon name={ic} cls="ic" />{n}</div>)}
      </div>
      <div className="an-body">
        <div className="an-kind"><span className="pdot" style={{ background: meta.ac, width: 6, height: 6 }} />{meta.kind}</div>
        <div className="an-title" title={meta.title}>{meta.title}</div>
        <div className="an-statusrow">
          <span className={'spill ' + stCls}><span className="d" style={{ background: scoreColor(sc) }} />{stLbl}</span>
          {meta.catchball && <span className={'cbchip ' + meta.catchball}>{meta.catchball}</span>}
          {meta.stale && <span className="an-stale"><Icon name="clock" cls="ic" /> {(meta.staleDays ?? 0) > 90 ? 'no check-in' : (meta.staleDays ?? 0) + 'd'}</span>}
          {meta.owner && <span style={{ marginLeft: 'auto' }}>{meta.team2 ? <AvatarStack ids={meta.team2} max={3} /> : <Avatar id={meta.owner} size="xs" />}</span>}
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── orphan rail item shape ───────────────────────── */

type Orphan = { id: string; title: string; note: string; owner: string }

/* ───────────────────────── AlignmentView ───────────────────────── */

export function AlignmentView() {
  const navigate = useNavigate()
  const toast = useToolsToast()
  const { P, orgName } = useToolsData()
  const { pillars } = useStrategyFoundation()
  const { objectives } = useStrategyOkr()
  const { initiatives } = useStrategyInitiatives()
  const { teams, edges } = useStrategyOrgGraph()
  const { checkins } = useStrategyCadence()

  // Staleness: days since the latest check-in per initiative (999 if none).
  const staleByIni = useMemo(() => {
    const latest: Record<string, string> = {}
    for (const c of checkins as StrategyCheckin[]) {
      if (!c.initiativeId) continue
      if (!latest[c.initiativeId] || c.checkedAt > latest[c.initiativeId]) latest[c.initiativeId] = c.checkedAt
    }
    const now = nowMs()
    const out: Record<string, number> = {}
    for (const id in latest) {
      const t = new Date(latest[id]).getTime()
      out[id] = Number.isNaN(t) ? 999 : Math.floor((now - t) / 86400000)
    }
    return out
  }, [checkins])

  // Orphan rail = initiatives aligned to neither an objective nor a pillar.
  const orphans = useMemo<Orphan[]>(
    () => initiatives
      .filter((i) => !i.objectiveId && !i.pillar)
      .map((i) => ({ id: i.id, title: i.title, note: i.summary, owner: i.owner })),
    [initiatives],
  )

  const tree = useMemo(
    () => buildAlignTree({ pillars, teams, objectives, initiatives, edges, staleByIni, P, orgName }),
    [pillars, teams, objectives, initiatives, edges, staleByIni, P, orgName],
  )

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(objectives.map((o) => 'ob-' + o.id)))
  const [sel, setSel] = useState<string | null>(null)
  const [view, setView] = useState({ x: 30, y: 20, k: 0.78 })
  const [showLateral, setShowLateral] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | NodeStatus>('all')
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  // status filter → which leaf nodes pass; keep ancestors of passing nodes
  const visibleSet = useMemo<Set<string> | null>(() => {
    if (statusFilter === 'all') return null
    const keep = new Set<string>()
    Object.values(tree.meta).forEach((m) => {
      if (m.depth === 4 && m.status === statusFilter) {
        let cur: string | null = m.id
        while (cur) { keep.add(cur); cur = parentOf(tree, cur) }
      }
    })
    return keep
  }, [statusFilter, tree])

  const { pos, width, height } = useMemo(() => layoutTree(tree, collapsed, visibleSet), [tree, collapsed, visibleSet])
  const allParents = useMemo(() => Object.keys(tree.childrenOf).filter((id) => tree.childrenOf[id].length), [tree])

  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(allParents.filter((id) => (tree.meta[id]?.depth ?? 0) >= 2)))

  const visible = Object.keys(pos)
  const edgeList: Array<[string, string]> = []
  visible.forEach((id) => { if (collapsed.has(id)) return; (tree.childrenOf[id] || []).forEach((cid) => { if (pos[cid]) edgeList.push([id, cid]) }) })
  const lateralEdges = showLateral ? tree.lateral.filter((e) => pos[e.from] && pos[e.to]) : []

  function clampK(k: number): number { return Math.max(0.28, Math.min(1.5, k)) }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    setView((v) => { const k2 = clampK(v.k * (e.deltaY < 0 ? 1.08 : 0.93)); const r = k2 / v.k; return { k: k2, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r } })
  }
  function onDown(e: React.MouseEvent) { drag.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }; canvasRef.current?.classList.add('drag') }
  function onMove(e: React.MouseEvent) { if (!drag.current) return; const d = drag.current; setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) })) }
  function onUp() { drag.current = null; canvasRef.current?.classList.remove('drag') }
  function fit() {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const k = clampK(Math.min((rect.width - 240) / width, (rect.height - 40) / height, 1))
    setView({ k, x: 232, y: 20 })
  }
  const zoom = (dir: number) => setView((v) => {
    if (!canvasRef.current) return v
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = rect.width / 2, my = rect.height / 2
    const k2 = clampK(v.k * (dir > 0 ? 1.15 : 0.87)); const r = k2 / v.k
    return { k: k2, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r }
  })

  function edgePath(a: string, b: string): string {
    const pa = pos[a], pb = pos[b]
    const x1 = pa.x + NW, y1 = pa.y + NH / 2, x2 = pb.x, y2 = pb.y + NH / 2
    const mx = x1 + (x2 - x1) * 0.5
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }
  function lateralPath(a: string, b: string): string {
    const pa = pos[a], pb = pos[b]
    const x1 = pa.x + NW / 2, y1 = pa.y + NH, x2 = pb.x + NW / 2, y2 = pb.y + NH
    const my = Math.max(y1, y2) + 46
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  const openInitiative = () => navigate('/planlegging/initiativer?view=overview')

  return (
    <div>
      <PageHead title="Alignment map" sub="The whole strategy as one cascading tree — company to pillar to team to objective to initiative. Scores roll up; status, staleness and catchball state show where to look." />
      <div className="amap">
        <div className="amap-toolbar">
          <div className="amap-tb-grp">
            <button className="amap-tbtn" onClick={expandAll}><Icon name="plus" cls="sm" /> Expand all</button>
            <button className="amap-tbtn" onClick={collapseAll}><Icon name="minus" cls="sm" /> Collapse all</button>
            <button className="amap-tbtn" onClick={fit}><Icon name="maximize" cls="sm" /> Fit</button>
          </div>
          <div className="amap-filterbar">
            <div className={'amap-chip' + (showLateral ? ' on' : '')} onClick={() => setShowLateral((s) => !s)}><Icon name="share" cls="sm" /> Cross-links</div>
            {([['all', 'All'], ['on', 'On track'], ['risk', 'At risk'], ['off', 'Off track']] as Array<['all' | NodeStatus, string]>).map(([v, l]) => (
              <div key={v} className={'amap-chip' + (statusFilter === v ? ' on' : '')} onClick={() => setStatusFilter(v)}>{l}</div>
            ))}
          </div>
        </div>

        {/* Unaligned rail */}
        <div className="amap-orphans">
          <div className="oh"><Icon name="alert" cls="sm" style={{ color: '#a8362a' }} /><span className="t">Unaligned · {orphans.length}</span></div>
          {orphans.map((o) => (
            <div key={o.id} className="orph-item" onClick={() => toast('Drag onto a parent to align')}>
              <div className="ot">{o.title}</div>
              <div className="on">{o.note}</div>
              <div className="row ac" style={{ gap: 6, marginTop: 6 }}><Avatar id={o.owner} size="xs" /><span style={{ fontSize: 11, color: 'var(--n-400)' }}>{(P[o.owner]?.name ?? '—').split(' ')[0]}</span></div>
            </div>
          ))}
        </div>

        <div ref={canvasRef} className="amap-canvas" onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onClick={() => setSel(null)}>
          <div className="amap-world" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, width, height }}>
            <svg className="amap-svg" width={width} height={height}>
              {edgeList.map(([a, b]) => <path key={a + b} className="amap-edge" d={edgePath(a, b)} />)}
              {lateralEdges.map((e, k) => {
                const pa = pos[e.from], pb = pos[e.to]; const mx = (pa.x + pb.x) / 2 + NW / 2, my = Math.max(pa.y, pb.y) + NH + 46
                return (
                  <g key={'lat' + k}>
                    <path className="amap-edge lateral" d={lateralPath(e.from, e.to)} />
                    <text className="amap-edge-lbl" x={mx} y={my - 6} textAnchor="middle">{e.type === 'drives' ? 'drives' : 'contributes to'}</text>
                  </g>
                )
              })}
            </svg>
            {visible.map((id) => <AlignNode key={id} id={id} meta={tree.meta[id]} p={pos[id]} selected={sel === id} onSelect={setSel} onOpen={openInitiative} />)}
            {visible.filter((id) => (tree.childrenOf[id] || []).filter((c) => !visibleSet || visibleSet.has(c)).length).map((id) => {
              const p = pos[id]; const isC = collapsed.has(id); const n = (tree.childrenOf[id] || []).filter((c) => !visibleSet || visibleSet.has(c)).length
              return (
                <div key={'pill-' + id} className={'amap-collapse' + (isC ? ' collapsed' : '')} style={{ left: p.x + NW - 1, top: p.y + NH / 2 - 13 }}
                  title={isC ? `Expand ${n}` : 'Collapse'} onClick={(e) => { e.stopPropagation(); toggle(id) }}>{isC ? n : '–'}</div>
              )
            })}
          </div>
        </div>

        <div className="amap-legend">
          <span style={{ fontWeight: 700, color: 'var(--n-700)' }}>Score / 10</span>
          <span className="lchip"><span className="d" style={{ background: '#2f7757' }} /> on track</span>
          <span className="lchip"><span className="d" style={{ background: '#b8862f' }} /> at risk</span>
          <span className="lchip"><span className="d" style={{ background: '#b3382a' }} /> off track</span>
          <span className="lchip"><svg width="22" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#b9a36a" strokeWidth="1.4" strokeDasharray="5 4" /></svg> cross-link</span>
        </div>

        <div className="amap-zoom">
          <div className="amap-zbtn" onClick={() => zoom(-1)}><Icon name="minus" cls="sm" /></div>
          <div className="amap-zlevel">{Math.round(view.k * 100)}%</div>
          <div className="amap-zbtn" onClick={() => zoom(1)}><Icon name="plus" cls="sm" /></div>
        </div>
      </div>
    </div>
  )
}

export default AlignmentView
