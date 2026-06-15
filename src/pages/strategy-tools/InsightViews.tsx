/* Strategy v2 — Insight read-views (Health & risk · Dependencies · RACI).
   Faithful 1:1 UI port of the design package's analysis surfaces (views_a's
   Health & risk + views_c's Dependency map and RACI matrix). The design's
   window.SD globals are replaced by the shared ExecCtx (useExec) and the
   people lookup from useToolsData — no new hooks, queries or window globals.
   These are pure read-views: they reuse data already loaded by the workspace
   and route through the existing ?view= switch (health · deps · raci). */

import { Card, Avatar, KPI, PageHead, useToolsData } from './StrategyToolsKit'
import { useExec } from './ExecutionWorkspace'
import type { StrategyInitiative } from '../../types/strategyTools'

/* ───────────────────────── HEALTH & RISK ───────────────────────── */

export function HealthView() {
  const ctx = useExec()
  const { P } = useToolsData()
  const all = ctx.initiatives
  const onT = all.filter((i) => i.health === 'on').length
  const risk = all.filter((i) => i.health === 'risk').length
  const off = all.filter((i) => i.health === 'off').length
  const done = all.filter((i) => i.health === 'done').length
  const total = all.length || 1
  const openRisks = ctx.risks.filter((r) => r.status === 'open').length

  // Look up an initiative's key by id (design used ASD.INI[id].key).
  const iniById = (id: string | null) => (id ? ctx.initiatives.find((x) => x.id === id) : undefined)

  // 3x3 matrix: rows impact (3..1 top to bottom), cols likelihood (1..3)
  const cell = (like: number, impact: number) =>
    ctx.risks.filter((r) => r.likelihood === like && r.impact === impact)
  const sev = (like: number, impact: number) => {
    const s = like + impact
    return s >= 5 ? 'hi' : s >= 4 ? 'mid' : 'lo'
  }

  return (
    <div>
      <PageHead title="Health & risk" sub="Where the portfolio needs attention — initiative health, plus an open risk register scored by likelihood and impact." />

      <div className="kgrid" style={{ marginBottom: 16 }}>
        <KPI icon="check" label="On track" value={onT} sub={`${done} completed`} />
        <KPI icon="alert" label="At risk" value={risk} tone={risk ? 'crit' : ''} sub="needs air cover" />
        <KPI icon="alert" label="Off track" value={off} tone={off ? 'crit' : ''} sub="intervene now" />
        <KPI icon="shield" label="Open risks" value={openRisks} sub={`${ctx.risks.length - openRisks} on watch`} />
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* health distribution */}
        <Card className="p5" style={{ flex: '1 1 320px', minWidth: 300 }}>
          <div className="eyebrow">Health distribution</div>
          <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', marginTop: 14, gap: 2 }}>
            <div style={{ width: (onT / total * 100) + '%', background: 'var(--ok)' }} />
            <div style={{ width: (risk / total * 100) + '%', background: 'var(--warn)' }} />
            <div style={{ width: (off / total * 100) + '%', background: 'var(--critical)' }} />
            <div style={{ width: (done / total * 100) + '%', background: 'var(--n-400)' }} />
          </div>
          <div style={{ marginTop: 16 }}>
            {([['On track', onT, 'var(--ok)'], ['At risk', risk, 'var(--warn)'], ['Off track', off, 'var(--critical)'], ['Completed', done, 'var(--n-400)']] as Array<[string, number, string]>).map(([l, n, c]) => (
              <div key={l} className="minirow">
                <span className="minik"><span className="sdot" style={{ background: c }} /> {l}</span>
                <span className="miniv tnum">{n}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* risk matrix */}
        <Card className="p5" style={{ flex: '1 1 420px', minWidth: 360 }}>
          <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="eyebrow">Risk matrix</div>
            <span style={{ fontSize: 11.5, color: 'var(--n-500)' }}>likelihood → · impact ↑</span>
          </div>
          <div className="rmatrix">
            <div className="rm-axis" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', gridRow: '1 / span 3' }}>Impact</div>
            {[3, 2, 1].map((impact) => (
              [1, 2, 3].map((like) => (
                <div key={impact + '-' + like} className={'rm-box ' + sev(like, impact)}>
                  {cell(like, impact).map((r) => {
                    const ini = iniById(r.initiativeId)
                    return (
                      <div key={r.id} className="rdotbig" title={r.title} onClick={() => ctx.openDetail(r.initiativeId)}>
                        {(ini?.key ?? '').replace('STR-', '')}
                      </div>
                    )
                  })}
                </div>
              ))
            ))}
            <div />
            <div className="rm-axis">Low</div><div className="rm-axis">Medium</div><div className="rm-axis">High</div>
          </div>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <div className="eyebrow" style={{ marginBottom: 10 }}>Risk register</div>
      <table className="tbl">
        <thead><tr>
          <th>Risk</th><th>Initiative</th><th>Owner</th><th className="center">Likelihood</th>
          <th className="center">Impact</th><th>Mitigation</th><th>Status</th>
        </tr></thead>
        <tbody>
          {ctx.risks.map((r) => {
            const ini = iniById(r.initiativeId)
            const lv = (n: number) => ['', 'Low', 'Medium', 'High'][n]
            const ownerName = P[r.owner]?.name ?? r.ownerName ?? '—'
            return (
              <tr key={r.id} onClick={() => ctx.openDetail(r.initiativeId)}>
                <td><span className="tt">{r.title}</span></td>
                <td><span style={{ color: 'var(--n-500)', fontSize: 12.5 }}>{ini?.key ?? '—'}</span> {ini?.title ?? ''}</td>
                <td><div className="cellrow"><Avatar id={r.owner} size="xs" /><span>{ownerName.split(' ')[0]}</span></div></td>
                <td className="center"><span className={'badge badge--' + (r.likelihood === 3 ? 'danger' : r.likelihood === 2 ? 'warn' : 'neutral')}>{lv(r.likelihood)}</span></td>
                <td className="center"><span className={'badge badge--' + (r.impact === 3 ? 'danger' : r.impact === 2 ? 'warn' : 'neutral')}>{lv(r.impact)}</span></td>
                <td style={{ maxWidth: 280, color: 'var(--n-600)', fontSize: 13 }}>{r.mitigation}</td>
                <td><span className={'badge badge--' + (r.status === 'open' ? 'warn' : 'neutral')}>{r.status === 'open' ? 'Open' : 'Watch'}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ───────────────────────── DEPENDENCY MAP ───────────────────────── */

export function DependencyView() {
  const ctx = useExec()
  const inis = ctx.initiatives
  const pAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'

  // layered layout: layer = longest prerequisite chain
  const layer: Record<string, number> = {}
  inis.forEach((i) => { layer[i.id] = 0 })
  for (let pass = 0; pass < inis.length; pass++) {
    inis.forEach((i) => {
      i.depends.forEach((d) => { if (layer[d] !== undefined && layer[i.id] <= layer[d]) layer[i.id] = layer[d] + 1 })
    })
  }
  const layers: Record<number, StrategyInitiative[]> = {}
  inis.forEach((i) => { (layers[layer[i.id]] = layers[layer[i.id]] || []).push(i) })
  const layerKeys = Object.keys(layers).map(Number).sort((a, b) => a - b)

  const NW = 168, NH = 58, COLX = 232, ROWY = 82, PADX = 28, PADY = 28
  const maxRows = Math.max(1, ...layerKeys.map((l) => layers[l].length))
  const W = PADX * 2 + (Math.max(1, layerKeys.length) - 1) * COLX + NW
  const H = PADY * 2 + (maxRows - 1) * ROWY + NH
  const pos: Record<string, { x: number; y: number }> = {}
  layerKeys.forEach((l, ci) => {
    const col = layers[l]
    const offset = (maxRows - col.length) * ROWY / 2
    col.forEach((i, ri) => { pos[i.id] = { x: PADX + ci * COLX, y: PADY + offset + ri * ROWY } })
  })

  function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 6} ${y2}`
  }

  const healthFill: Record<string, string> = { on: '#2f7757', risk: '#c98a2b', off: '#b3382a', done: '#a3a3a3' }

  return (
    <div>
      <PageHead title="Dependency map" sub="What must finish before what. Arrows point from a prerequisite to the initiative that needs it — left-to-right is the critical flow." />
      <div className="depwrap">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9aa39d" />
            </marker>
          </defs>
          {inis.map((i) => i.depends.map((d) => {
            const a = pos[d], b = pos[i.id]
            if (!a || !b) return null
            return (
              <path key={i.id + d} d={edgePath(a, b)} fill="none" stroke="#c2cbc4" strokeWidth="1.6" markerEnd="url(#arrow)" />
            )
          }))}
          {inis.map((i) => {
            const p = pos[i.id]; const c = pAccent(i.pillar)
            if (!p) return null
            return (
              <g key={i.id} className="dep-node" transform={`translate(${p.x},${p.y})`} onClick={() => ctx.openDetail(i.id)}>
                <rect width={NW} height={NH} rx="10" fill="#fff" stroke={c} strokeWidth="1.5" />
                <rect width="4" height={NH} rx="2" fill={c} />
                <text x="14" y="22" fontSize="10" fontWeight="700" fill="#9aa39d" letterSpacing="0.5">{i.key}</text>
                <text x="14" y="39" fontSize="12.5" fontWeight="600" fill="#171717">{i.title.length > 22 ? i.title.slice(0, 21) + '…' : i.title}</text>
                <circle cx={NW - 16} cy="20" r="5" fill={healthFill[i.health]} />
              </g>
            )
          })}
        </svg>
        <div className="dep-legend">
          {ctx.pillars.map((p) => <span key={p.id} className="row ac" style={{ gap: 7 }}><span className="pdot" style={{ background: p.color }} />{p.name}</span>)}
          <span className="row ac" style={{ gap: 7 }}><svg width="26" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#c2cbc4" strokeWidth="1.6" markerEnd="url(#arrow)" /></svg> prerequisite → dependent</span>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── RACI MATRIX ───────────────────────── */

export function RaciView() {
  const ctx = useExec()
  const { P } = useToolsData()
  const cols = ctx.raciPeople
  const pAccent = (code: string) => ctx.pillarByCode[code]?.color ?? 'var(--forest)'
  const colName = (label: string) => (P[label]?.name ?? label).split(' ')[0]
  return (
    <div>
      <PageHead title="RACI matrix" sub="Who is Responsible, Accountable, Consulted and Informed on each initiative. Every row has exactly one Accountable owner." />
      <div className="row ac" style={{ gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['R', 'Responsible', 'Does the work'], ['A', 'Accountable', 'Owns the outcome'], ['C', 'Consulted', 'Gives input'], ['I', 'Informed', 'Kept in the loop']] as Array<[string, string, string]>).map(([t, l, d]) => (
          <span key={t} className="row ac" style={{ gap: 8 }}>
            <span className={'rtag ' + t}>{t}</span>
            <span style={{ fontSize: 12.5 }}><b style={{ color: 'var(--n-800)' }}>{l}</b> <span style={{ color: 'var(--n-500)' }}>· {d}</span></span>
          </span>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="raci">
          <thead>
            <tr>
              <th className="rowh">Initiative</th>
              {cols.map((pid) => (
                <th key={pid} className="pcol">
                  <div className="colhead">
                    <Avatar id={pid} size="xs" />
                    <span style={{ fontSize: 10.5 }}>{colName(pid)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ctx.initiatives.map((i) => (
              <tr key={i.id}>
                <td className="rowh">
                  <div className="cellrow" style={{ cursor: 'pointer' }} onClick={() => ctx.openDetail(i.id)}>
                    <span className="pdot" style={{ background: pAccent(i.pillar) }} />
                    <div><div style={{ fontWeight: 600, color: 'var(--n-900)', fontSize: 13 }}>{i.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--n-400)' }}>{i.key}</div></div>
                  </div>
                </td>
                {cols.map((pid) => {
                  const v = ctx.raci[i.id] && ctx.raci[i.id][pid]
                  return <td key={pid}>{v ? <span className={'rtag ' + v}>{v}</span> : <span style={{ color: 'var(--n-200)' }}>·</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
