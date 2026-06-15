/* Strategy v2 — Objectives workspace (the OKR spine: Objectives tree + Strategy
   map). Faithful 1:1 UI port of the design package's views_c OkrTreeView and
   StrategyMapView. The design's window.SD globals are replaced by DB-driven
   hooks: useStrategyOkr (objectives + KRs), useStrategyFoundation (pillars) and
   useStrategyInitiatives (per-objective initiative links). No window globals,
   no localStorage. The ?view= switch (tree · map) is driven by app nav. */

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bar, HumanNote, Icon, PageHead } from './StrategyToolsKit'
import { krPct } from './strategyDerive'
import { useStrategyOkr, type StrategyOkrObjective } from '../../hooks/useStrategyOkr'
import { useStrategyFoundation } from '../../hooks/useStrategyFoundation'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import type { StrategyInitiative, StrategyPillar } from '../../types/strategyTools'

/* CSS custom properties (`--ac`) are set via inline style throughout the
   design's markup; React.CSSProperties doesn't model them, so allow them. */
type CSSVars = React.CSSProperties & Record<string, string | number>

type ObjectivesView = 'tree' | 'map'

/* A pillar "group" the tree/map render under. The design grouped objectives by
   a known pillar; objectives whose pillar is '' or unknown land in a synthetic
   neutral group so the section markup still renders. */
type PillarGroup = {
  key: string
  name: string
  q: string
  color: string
  objectives: StrategyOkrObjective[]
}

const UNALIGNED_COLOR = 'var(--n-400)'

/** Group objectives by pillar code, ordered by the pillars' position; a final
 *  "Unaligned" group collects objectives with no (or an unknown) pillar. */
function groupByPillar(objectives: StrategyOkrObjective[], pillars: StrategyPillar[]): PillarGroup[] {
  const byCode: Record<string, StrategyPillar> = {}
  for (const p of pillars) byCode[p.code] = p
  const groups: PillarGroup[] = pillars.map((p) => ({
    key: p.code,
    name: p.name,
    q: p.missionQuestion,
    color: p.color,
    objectives: objectives.filter((o) => o.pillar === p.code),
  }))
  const unaligned = objectives.filter((o) => !o.pillar || !byCode[o.pillar])
  if (unaligned.length) {
    groups.push({ key: '__unaligned', name: 'No pillar', q: 'Objectives not yet aligned to a strategic pillar.', color: UNALIGNED_COLOR, objectives: unaligned })
  }
  return groups
}

/* ───────────────────────── STRATEGY MAP ───────────────────────── */

function StrategyMapView({ objectives, pillars, initiatives, setView }: {
  objectives: StrategyOkrObjective[]
  pillars: StrategyPillar[]
  initiatives: StrategyInitiative[]
  setView: (v: ObjectivesView) => void
}) {
  // Bands come from pillars ordered by position; unaligned objectives are not
  // part of the balanced scorecard, so they fold into a trailing band only if
  // any exist (keeps the cause/effect ladder intact when every objective is
  // aligned).
  const groups = groupByPillar(objectives, pillars)
  return (
    <div>
      <PageHead title="Strategy map" sub="The 2026 plan as a balanced scorecard. Read bottom-up: people and process capability drives customer outcomes, which drives financial results." />
      <HumanNote>A strategy map shows cause and effect between objectives — not a scoreboard. Lower perspectives are the means; upper perspectives are the ends.</HumanNote>
      <div style={{ height: 16 }} />
      <div className="smap">
        {groups.map((g) => (
          <div key={g.key} className="smap-band">
            <div className="smap-side" style={{ background: g.color }}>
              <div className="pn">{g.name}</div>
              <div className="pq">{g.q}</div>
            </div>
            <div className="smap-nodes">
              {g.objectives.map((o) => {
                const inis = initiatives.filter((i) => i.objectiveId === o.id)
                const onPace = o.krs.filter((k) => krPct(k.start, k.target, k.now) >= 0.55).length
                return (
                  <div key={o.id} className="snode" style={{ '--ac': g.color, borderColor: g.color } as CSSVars} onClick={() => setView('tree')}>
                    <div className="st">{o.title}</div>
                    <div className="sm">
                      <span style={{ color: g.color, fontWeight: 700 }}>{onPace} of {o.krs.length} KRs on pace</span>
                      <span style={{ color: 'var(--n-300)' }}>·</span>
                      <span>{inis.length} initiative{inis.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className="smap-legend">
          <span style={{ fontWeight: 700, color: 'var(--n-700)' }}>Read ↑</span>
          <span>Learning &amp; process <b>enable</b> →</span>
          <span>customer outcomes <b>drive</b> →</span>
          <span>financial results.</span>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── OKR TREE (Objectives) ───────────────────────── */

function OkrTreeView({ objectives, pillars, initiatives, onOpenInitiative }: {
  objectives: StrategyOkrObjective[]
  pillars: StrategyPillar[]
  initiatives: StrategyInitiative[]
  onOpenInitiative: () => void
}) {
  const groups = groupByPillar(objectives, pillars)
  // Open the first pillar's objectives by default (the design opened the "fin"
  // pillar — here the first band stands in for that lead perspective).
  const firstKey = groups[0]?.key
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const o of objectives) init[o.id] = o.pillar !== '' && o.pillar === firstKey
    return init
  })
  const pillarByCode = useMemo(() => {
    const m: Record<string, StrategyPillar> = {}
    for (const p of pillars) m[p.code] = p
    return m
  }, [pillars])
  const iniAccent = (code: string) => pillarByCode[code]?.color ?? UNALIGNED_COLOR

  return (
    <div>
      <PageHead title="OKR tree" sub="Objectives and key results under each pillar, with the initiatives driving them. Expand an objective to see progress to target." />
      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 22 }}>
          <div className="row ac" style={{ gap: 10, marginBottom: 12 }}>
            <span className="pdot" style={{ background: g.color, width: 11, height: 11 }} />
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 17, color: 'var(--n-900)' }}>{g.name}</span>
            <span style={{ fontSize: 12.5, color: 'var(--n-500)' }}>{g.q}</span>
          </div>
          <div className="tree">
            {g.objectives.map((o) => {
              const inis = initiatives.filter((i) => i.objectiveId === o.id)
              const isOpen = !!open[o.id]
              return (
                <div key={o.id} className="tnode">
                  <div className="tnode__head" style={{ '--ac': g.color } as CSSVars} onClick={() => setOpen((s) => ({ ...s, [o.id]: !s[o.id] }))}>
                    <Icon name="cright" cls={'tnode__chev' + (isOpen ? ' open' : '')} />
                    <div style={{ flex: 1 }}>
                      <div className="tnode__t">{o.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--n-500)', marginTop: 3 }}>{o.krs.length} key results · {inis.length} initiatives · owner {o.owner || '—'}</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="tnode__body">
                      {o.krs.map((k) => (
                        <div key={k.id} className="kr">
                          <div className="kr__t">{k.kr}</div>
                          <div className="kr__track"><Bar pct={krPct(k.start, k.target, k.now) * 100} color={g.color} /></div>
                          <div className="kr__nums">{k.now}{k.unit} <span style={{ color: 'var(--n-400)' }}>/ {k.target}{k.unit}</span></div>
                        </div>
                      ))}
                      {inis.length > 0 && (
                        <div className="divtop">
                          <div className="eyebrow" style={{ marginBottom: 8 }}>Initiatives</div>
                          <div className="tinis">
                            {inis.map((i) => (
                              <div key={i.id} className="tini" onClick={onOpenInitiative}>
                                <span className="pdot" style={{ background: iniAccent(i.pillar) }} />{i.key} · {i.title}
                                <span style={{ color: 'var(--n-400)', fontWeight: 600 }} className="tnum">{i.progress}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── WORKSPACE (container) ───────────────────────── */

export function ObjectivesWorkspace() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const view = (params.get('view') || 'tree') as ObjectivesView
  const setView = (v: ObjectivesView) => setParams({ view: v })

  const okr = useStrategyOkr()
  const { pillars } = useStrategyFoundation()
  const { initiatives } = useStrategyInitiatives()

  const openInitiatives = () => navigate('/planlegging/initiativer?view=overview')

  if (okr.loading) {
    return (
      <div>
        <PageHead title="Mål" sub="Laster mål…" />
      </div>
    )
  }

  return (
    <div>
      {okr.error && <HumanNote>{okr.error}</HumanNote>}
      {view === 'map'
        ? <StrategyMapView objectives={okr.objectives} pillars={pillars} initiatives={initiatives} setView={setView} />
        : <OkrTreeView objectives={okr.objectives} pillars={pillars} initiatives={initiatives} onOpenInitiative={openInitiatives} />}
    </div>
  )
}

export default ObjectivesWorkspace
