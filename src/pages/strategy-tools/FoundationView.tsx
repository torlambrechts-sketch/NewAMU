/* View: Foundation — vision, mission, ambition, values, strategic intent.
   Faithful 1:1 port of the design's Foundation view (cascade + detail boards,
   inline editors, and the 5-step guided wizard). The design's localStorage
   state machine (klarert_foundation_v1) is replaced by useStrategyFoundation:
   the displayed foundation merges DB rows over DEFAULT_FOUNDATION, and every
   edit flows through updateFoundation/updatePillar (optimistic + debounced).
   Per-pillar objective/initiative counts don't exist yet, so the count badges
   render 0 (markup preserved) until those tables land in a later wave. */

import { useEffect, useState } from 'react'
import { Icon, PageHead, HumanNote, Field, SideWindow, useToolsData } from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { useStrategyFoundation } from '../../hooks/useStrategyFoundation'
import type {
  AmbitionStat,
  FoundationValue,
  StrategyFoundation,
  StrategyPillar,
} from '../../types/strategyTools'
import type { CSSProperties } from 'react'

/* ───────────────────────── view-model (design's nested shape) ───────────────────────── */

type FdnPillar = { id: string; name: string; q: string; color: string }
type Fdn = {
  vision: { text: string; tag: string }
  mission: { title: string; body: string }
  ambition: { title: string; stats: AmbitionStat[] }
  values: FoundationValue[]
  intent: { lead: string }
  pillars: FdnPillar[]
}

const DEFAULT_FOUNDATION: Fdn = {
  vision: {
    text: "To be the Nordics' most trusted independent wealth partner — where every client's capital is managed with clarity, conscience and care.",
    tag: 'Pundit Invest AS · the destination that anchors every decision',
  },
  mission: {
    title: 'We help Nordic families and businesses grow and protect their wealth — through transparent advice, disciplined investing and human judgement.',
    body: 'Our work is the same every day: understand each client deeply, invest their capital with care, and stand behind the advice we give. Compliance and conscience are not constraints on that mission — they are how we keep it.',
  },
  ambition: {
    title: 'Manage 18 BNOK for 4,000 clients across Norway, Sweden and Denmark — at top-quartile client trust and a cost-to-income ratio below 55%.',
    stats: [
      { big: '18', unit: 'BNOK', label: 'Assets under management' },
      { big: '4 000', unit: '', label: 'Clients across the Nordics' },
      { big: '<55', unit: '%', label: 'Cost-to-income ratio' },
    ],
  },
  values: [
    { t: 'Clarity over complexity', b: "We explain, we don't obscure. A client should always understand what we do with their money — and why." },
    { t: 'The score informs; a person decides', b: 'Data sharpens judgement, it never replaces it. Every number meets a human before it reaches a client.' },
    { t: 'Compliance is care', b: 'Doing things right is how we protect the people who trust us. Rigour is not red tape — it is respect.' },
    { t: 'Long-term by default', b: 'We invest, advise and build for decades, not quarters. Patience is our edge in a noisy market.' },
    { t: 'Earn trust daily', b: 'Trust is the one asset we cannot buy back. We treat every interaction as a chance to deserve it again.' },
    { t: 'Grow our people', b: 'Strong advisors make strong portfolios. We develop the team that compounds the firm.' },
  ],
  intent: {
    lead: 'In 2026 we will deepen the trust of our existing clients while opening the Nordic mid-market — funded by operational excellence and powered by a team built to compound. We choose to win on clarity and care, not on price. Four pillars carry that intent into action:',
  },
  pillars: [],
}

/* Merge DB foundation over the design defaults: empty text falls back to the
   example copy, empty arrays fall back to the example arrays. */
function mergeFoundation(
  foundation: StrategyFoundation,
  pillars: StrategyPillar[],
): Fdn {
  const pf: FdnPillar[] = pillars.map((p) => ({ id: p.id, name: p.name, q: p.missionQuestion, color: p.color }))
  return {
    vision: {
      text: foundation.visionText || DEFAULT_FOUNDATION.vision.text,
      tag: foundation.visionTag || DEFAULT_FOUNDATION.vision.tag,
    },
    mission: {
      title: foundation.missionTitle || DEFAULT_FOUNDATION.mission.title,
      body: foundation.missionBody || DEFAULT_FOUNDATION.mission.body,
    },
    ambition: {
      title: foundation.ambitionTitle || DEFAULT_FOUNDATION.ambition.title,
      stats: foundation.ambitionStats.length ? foundation.ambitionStats : DEFAULT_FOUNDATION.ambition.stats,
    },
    values: foundation.values.length ? foundation.values : DEFAULT_FOUNDATION.values,
    intent: { lead: foundation.intentLead || DEFAULT_FOUNDATION.intent.lead },
    pillars: pf,
  }
}

/* Translate a full nested-object replace back into hook patches. The design's
   editors call set(nextFdn); we diff against the previous view-model and emit
   updateFoundation()/updatePillar() for whatever changed. */
type FdnActions = {
  updateFoundation: (patch: Partial<StrategyFoundation>) => void
  updatePillar: (id: string, patch: Partial<Pick<StrategyPillar, 'name' | 'missionQuestion' | 'color'>>) => void
}
function commitFoundation(prev: Fdn, next: Fdn, act: FdnActions): void {
  const patch: Partial<StrategyFoundation> = {}
  if (next.vision.text !== prev.vision.text) patch.visionText = next.vision.text
  if (next.vision.tag !== prev.vision.tag) patch.visionTag = next.vision.tag
  if (next.mission.title !== prev.mission.title) patch.missionTitle = next.mission.title
  if (next.mission.body !== prev.mission.body) patch.missionBody = next.mission.body
  if (next.ambition.title !== prev.ambition.title) patch.ambitionTitle = next.ambition.title
  if (next.ambition.stats !== prev.ambition.stats) patch.ambitionStats = next.ambition.stats
  if (next.values !== prev.values) patch.values = next.values
  if (next.intent.lead !== prev.intent.lead) patch.intentLead = next.intent.lead
  if (Object.keys(patch).length) act.updateFoundation(patch)

  next.pillars.forEach((np) => {
    const op = prev.pillars.find((x) => x.id === np.id)
    if (!op) return
    const pPatch: Partial<Pick<StrategyPillar, 'name' | 'missionQuestion' | 'color'>> = {}
    if (np.name !== op.name) pPatch.name = np.name
    if (np.q !== op.q) pPatch.missionQuestion = np.q
    if (np.color !== op.color) pPatch.color = np.color
    if (Object.keys(pPatch).length) act.updatePillar(np.id, pPatch)
  })
}

type SetFdn = (next: Fdn) => void
type Ctx = { toast: (msg: string) => void; setView: (view: string) => void }

/* inline-editable text — display when not editing, input/textarea when editing */
function Fed({ editing, value, onChange, multiline, dark, placeholder, className, style }: {
  editing: boolean
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  dark?: boolean
  placeholder?: string
  className?: string
  style?: CSSProperties
}) {
  if (!editing) {
    if (multiline) return <div className={className} style={style}>{value}</div>
    return <div className={className} style={style}>{value}</div>
  }
  const cls = (className || '') + ' fdn-ed' + (dark ? ' fdn-ed--dark' : '')
  if (multiline) return <textarea className={cls} style={style} value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} />
  return <input className={cls} style={style} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

/* ---- the detailed presentation (rich cards; editing + highlight aware) ---- */
function FoundationDetail({ fdn, editing, set, highlight, ctx }: {
  fdn: Fdn
  editing: boolean
  set: SetFdn
  highlight: string | null
  ctx: Ctx
}) {
  const hl = (id: string) => (highlight === id ? ' wt-hl' : '')
  const setVision = (k: keyof Fdn['vision'], v: string) => set({ ...fdn, vision: { ...fdn.vision, [k]: v } })
  const setMission = (k: keyof Fdn['mission'], v: string) => set({ ...fdn, mission: { ...fdn.mission, [k]: v } })
  const setAmbitionTitle = (v: string) => set({ ...fdn, ambition: { ...fdn.ambition, title: v } })
  const setAmbitionStats = (s: AmbitionStat[]) => set({ ...fdn, ambition: { ...fdn.ambition, stats: s } })
  const setStat = (i: number, k: keyof AmbitionStat, v: string) => { const s = fdn.ambition.stats.map((x, j) => (j === i ? { ...x, [k]: v } : x)); setAmbitionStats(s) }
  const setValue = (i: number, k: keyof FoundationValue, v: string) => set({ ...fdn, values: fdn.values.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })
  const addValue = () => set({ ...fdn, values: [...fdn.values, { t: '', b: '' }] })
  const delValue = (i: number) => set({ ...fdn, values: fdn.values.filter((_, j) => j !== i) })
  const setPillar = (i: number, k: keyof FdnPillar, v: string) => set({ ...fdn, pillars: (fdn.pillars || []).map((x, j) => (j === i ? { ...x, [k]: v } : x)) })

  return (
    <div className={'fdn' + (editing ? ' fdn-editing' : '')}>
      {/* VISION */}
      <div className={'fdn-hero' + hl('vision')}>
        <div className="fdn-ey"><Icon name="compass" cls="sm" /> Vision · our north star</div>
        <Fed editing={editing} multiline dark value={fdn.vision.text} placeholder="Our north-star statement…"
          className="fdn-vision" onChange={(v) => setVision('text', v)} style={editing ? { marginTop: 16 } : undefined} />
        <div className="fdn-tag"><Icon name="building" cls="sm" />
          <Fed editing={editing} dark value={fdn.vision.tag} placeholder="A short anchoring line…"
            className="" onChange={(v) => setVision('tag', v)} style={editing ? { color: '#cfe0d6', maxWidth: 420 } : { display: 'inline' }} />
        </div>
      </div>

      {/* MISSION + AMBITION */}
      <div className="fdn-2">
        <div className={'fdn-card' + hl('mission')} style={{ '--ac': '#3f7d5a' } as CSSProperties}>
          <div className="fc-ey"><Icon name="target" cls="sm" /> Mission · why we exist</div>
          <Fed editing={editing} multiline value={fdn.mission.title} placeholder="Why does the company exist?"
            className="fc-t" onChange={(v) => setMission('title', v)} />
          <Fed editing={editing} multiline value={fdn.mission.body} placeholder="A supporting sentence or two…"
            className="fc-b" onChange={(v) => setMission('body', v)} />
        </div>
        <div className={'fdn-card' + hl('ambition')} style={{ '--ac': '#2f5d8a' } as CSSProperties}>
          <div className="fc-ey"><Icon name="trend" cls="sm" /> Ambition · where we'll be</div>
          <Fed editing={editing} multiline value={fdn.ambition.title} placeholder="The medium-term aspiration…"
            className="fc-t" onChange={(v) => setAmbitionTitle(v)} />
          <div className="fdn-stats">
            {fdn.ambition.stats.map((s, i) => (
              <div key={i} className="fdn-stat">
                {editing ? (
                  <div className="fdn-stat-edit">
                    <div className="row1">
                      <input className="fdn-ed v" value={s.big} placeholder="18" onChange={(e) => setStat(i, 'big', e.target.value)} />
                      <input className="fdn-ed unit" value={s.unit} placeholder="BNOK" onChange={(e) => setStat(i, 'unit', e.target.value)} />
                    </div>
                    <input className="fdn-ed" style={{ fontSize: 11 }} value={s.label} placeholder="What it measures" onChange={(e) => setStat(i, 'label', e.target.value)} />
                  </div>
                ) : (
                  <span style={{ display: 'contents' }}>
                    <div className="v">{s.big}{s.unit && <span style={{ fontSize: 14, color: 'var(--n-500)' }}> {s.unit}</span>}</div>
                    <div className="l">{s.label}</div>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* VALUES */}
      <div>
        <div className="sec-head"><span className="st">Values</span><span className="sd">How we work — the convictions behind every strategic choice</span></div>
        <div className="val-grid">
          {fdn.values.map((v, i) => (
            <div key={i} className="val">
              {editing && fdn.values.length > 1 && <button className="val-del" onClick={() => delValue(i)} aria-label="Remove value"><Icon name="x" cls="xs" /></button>}
              <div className="vn">{String(i + 1).padStart(2, '0')}</div>
              <Fed editing={editing} value={v.t} placeholder="Value name" className="vt" onChange={(val) => setValue(i, 't', val)} />
              <Fed editing={editing} multiline value={v.b} placeholder="What this value means in practice…" className="vb" onChange={(val) => setValue(i, 'b', val)} />
            </div>
          ))}
          {editing && (
            <div className="val-add" onClick={addValue}><Icon name="plus" cls="lg" /><div style={{ fontSize: 13, fontWeight: 600 }}>Add value</div></div>
          )}
        </div>
      </div>

      {/* STRATEGIC INTENT */}
      <div>
        <div className="sec-head"><span className="st">Strategic intent</span><span className="sd">The bridge from vision to the 2026 plan</span></div>
        <div className={'intent' + hl('intent')}>
          <Fed editing={editing} multiline value={fdn.intent.lead} placeholder="How does this year's strategy carry the vision forward?"
            className="intent-lead" onChange={(v) => set({ ...fdn, intent: { ...fdn.intent, lead: v } })} />
          <div className="intent-pillars">
            {(fdn.pillars || []).map((p, i) => (
              <div key={p.id || i} className="ipill" style={{ '--ac': p.color } as CSSProperties} onClick={() => !editing && ctx.setView('map')}>
                <div className="ip-n">Pillar {String(i + 1).padStart(2, '0')}</div>
                <Fed editing={editing} value={p.name} placeholder="Pillar name" className="ip-t" onChange={(v) => setPillar(i, 'name', v)} />
                <Fed editing={editing} multiline value={p.q} placeholder="What this pillar drives…" className="ip-d" onChange={(v) => setPillar(i, 'q', v)} />
              </div>
            ))}
          </div>
          {!editing && (
            <div className="row ac" style={{ gap: 14, marginTop: 24, flexWrap: 'wrap' }}>
              <button className="btn btn--primary sm" onClick={() => ctx.setView('overview')}><Icon name="grid" cls="sm" /> See the 2026 plan</button>
              <button className="btn sm" onClick={() => ctx.setView('okr')}><Icon name="target" cls="sm" /> Objectives & key results</button>
              <span className="mini-link" onClick={() => ctx.setView('map')}>View the strategy map <Icon name="cright" cls="xs" /></span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---- the connected cascade ("golden thread") ---- */
function CascEd({ editing, value, onChange, multiline, dark, placeholder, className, style }: {
  editing: boolean
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  dark?: boolean
  placeholder?: string
  className?: string
  style?: CSSProperties
}) {
  if (!editing) return <div className={className} style={style}>{value || <span style={{ opacity: .5 }}>{placeholder}</span>}</div>
  const cls = (className || '') + ' casc-ed' + (dark ? ' casc-ed--dark' : '')
  if (multiline) return <textarea className={cls} style={style} value={value} placeholder={placeholder} rows={2} onChange={(e) => onChange(e.target.value)} />
  return <input className={cls} style={style} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

function FoundationCascade({ fdn, editing, set, highlight, ctx }: {
  fdn: Fdn
  editing: boolean
  set: SetFdn
  highlight: string | null
  ctx: Ctx
}) {
  const hl = (id: string) => (highlight === id ? ' wt-hl' : '')
  const setVision = (k: keyof Fdn['vision'], v: string) => set({ ...fdn, vision: { ...fdn.vision, [k]: v } })
  const setMission = (k: keyof Fdn['mission'], v: string) => set({ ...fdn, mission: { ...fdn.mission, [k]: v } })
  const setAmbitionTitle = (v: string) => set({ ...fdn, ambition: { ...fdn.ambition, title: v } })
  const setAmbitionStats = (s: AmbitionStat[]) => set({ ...fdn, ambition: { ...fdn.ambition, stats: s } })
  const setStat = (i: number, k: keyof AmbitionStat, v: string) => setAmbitionStats(fdn.ambition.stats.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const setValue = (i: number, k: keyof FoundationValue, v: string) => set({ ...fdn, values: fdn.values.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })
  const addValue = () => set({ ...fdn, values: [...fdn.values, { t: '', b: '' }] })
  const delValue = (i: number) => set({ ...fdn, values: fdn.values.filter((_, j) => j !== i) })
  const setPillar = (i: number, k: keyof FdnPillar, v: string) => set({ ...fdn, pillars: (fdn.pillars || []).map((x, j) => (j === i ? { ...x, [k]: v } : x)) })

  return (
    <div className="casc">
      {/* flow legend */}
      <div className="casc-legend">
        <span className="seg"><span className="d" style={{ background: '#1a3d32' }} />Why <small>vision · mission</small></span>
        <span className="arr">→</span>
        <span className="seg"><span className="d" style={{ background: '#b8862f' }} />What <small>ambition · intent</small></span>
        <span className="arr">→</span>
        <span className="seg"><span className="d" style={{ background: '#2f7757' }} />How <small>pillars · objectives</small></span>
      </div>

      {/* VISION */}
      <div className="casc-level">
        <div className={'casc-card hero' + hl('vision')} style={{ '--ac': '#9ec3b1' } as CSSProperties}>
          <div className="casc-tag"><span className="casc-step">1</span><span className="lbl">Vision · our north star</span></div>
          <CascEd editing={editing} multiline dark value={fdn.vision.text} placeholder="Our long-term north star…" className="casc-vision" onChange={(v) => setVision('text', v)} style={editing ? { marginTop: 14 } : undefined} />
          <div className="casc-anchor"><Icon name="building" cls="sm" />
            <CascEd editing={editing} dark value={fdn.vision.tag} placeholder="A short anchoring line…" className="" onChange={(v) => setVision('tag', v)} style={editing ? { color: '#cfe0d6' } : { display: 'inline' }} />
          </div>
        </div>
        <div className="casc-conn" />
      </div>

      {/* MISSION */}
      <div className="casc-level">
        <div className={'casc-card' + hl('mission')} style={{ '--ac': '#3f7d5a' } as CSSProperties}>
          <div className="casc-tag" style={{ color: '#3f7d5a' }}><span className="casc-step">2</span><span className="lbl">Mission · why we exist</span><span className="meta">present tense</span></div>
          <CascEd editing={editing} multiline value={fdn.mission.title} placeholder="Why does the company exist?" className="casc-h" onChange={(v) => setMission('title', v)} />
          <CascEd editing={editing} multiline value={fdn.mission.body} placeholder="A supporting sentence or two…" className="casc-sub" onChange={(v) => setMission('body', v)} />
        </div>
        <div className="casc-conn" />
      </div>

      {/* AMBITION */}
      <div className="casc-level">
        <div className={'casc-card' + hl('ambition')} style={{ '--ac': '#2f5d8a' } as CSSProperties}>
          <div className="casc-tag" style={{ color: '#2f5d8a' }}><span className="casc-step">3</span><span className="lbl">Ambition · where we'll be</span><span className="meta">measurable</span></div>
          <CascEd editing={editing} multiline value={fdn.ambition.title} placeholder="The medium-term aspiration…" className="casc-h" onChange={(v) => setAmbitionTitle(v)} />
          <div className="casc-stats">
            {fdn.ambition.stats.map((s, i) => (
              <div key={i} className="casc-stat">
                {editing ? (
                  <div className="casc-stat-edit">
                    <div className="r1"><input value={s.big} placeholder="18" onChange={(e) => setStat(i, 'big', e.target.value)} /><input value={s.unit} placeholder="BNOK" onChange={(e) => setStat(i, 'unit', e.target.value)} /></div>
                    <input style={{ fontSize: 11 }} value={s.label} placeholder="What it measures" onChange={(e) => setStat(i, 'label', e.target.value)} />
                  </div>
                ) : (
                  <span style={{ display: 'contents' }}>
                    <div className="v">{s.big}{s.unit && <small> {s.unit}</small>}</div>
                    <div className="l">{s.label}</div>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="casc-conn" />
      </div>

      {/* STRATEGIC INTENT */}
      <div className="casc-level">
        <div className={'casc-card' + hl('intent')} style={{ '--ac': '#b8862f' } as CSSProperties}>
          <div className="casc-tag" style={{ color: '#9a6c12' }}><span className="casc-step">4</span><span className="lbl">Strategic intent · the bridge</span><span className="meta">this year</span></div>
          <CascEd editing={editing} multiline value={fdn.intent.lead} placeholder="How does this year's strategy carry the vision forward?" className="casc-sub" style={{ fontSize: 14.5, color: 'var(--n-800)', marginTop: 11 }} onChange={(v) => set({ ...fdn, intent: { ...fdn.intent, lead: v } })} />
        </div>
        <div className="casc-conn lg" />
      </div>

      {/* PILLARS — fan out, linked to live objectives/initiatives */}
      <div className="casc-fan">
        <div className="casc-bus" />
        <div className="casc-pillars">
          {(fdn.pillars || []).map((p, i) => {
            // Per-pillar objective/initiative counts arrive in a later wave;
            // render 0 to keep the badge markup without inventing data.
            const objs = 0
            const inis = 0
            return (
              <div key={p.id || i} className="casc-pillar" style={{ '--ac': p.color } as CSSProperties} onClick={() => !editing && ctx.setView('okr')}>
                <div className="pn">Pillar {String(i + 1).padStart(2, '0')}</div>
                <CascEd editing={editing} value={p.name} placeholder="Pillar name" className="pt" onChange={(v) => setPillar(i, 'name', v)} />
                <CascEd editing={editing} multiline value={p.q} placeholder="What this pillar drives…" className="pq" onChange={(v) => setPillar(i, 'q', v)} />
                <div className="plink">
                  <span className="chip"><Icon name="target" cls="ic xs" /> {objs} obj</span>
                  <span style={{ color: 'var(--n-300)' }}>·</span>
                  <span className="chip"><Icon name="grid" cls="ic xs" /> {inis} init</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* flows into the plan */}
      {!editing && (
        <div className="casc-flows" style={{ marginTop: 22 }}>
          <span style={{ fontSize: 12, color: 'var(--n-500)', fontWeight: 600 }}>The thread continues into</span>
          <button className="casc-flowbtn" onClick={() => ctx.setView('okr')}><Icon name="target" cls="sm" /> Objectives</button>
          <button className="casc-flowbtn" onClick={() => ctx.setView('overview')}><Icon name="grid" cls="sm" /> Initiatives</button>
          <button className="casc-flowbtn" onClick={() => ctx.setView('align')}><Icon name="sitemap" cls="sm" /> Alignment map</button>
        </div>
      )}

      {/* VALUES — bedrock */}
      <div className="casc-bedrock">
        <div className="casc-bedrock-h"><span className="ln" /><span className="lbl"><Icon name="shield" cls="xs" /> Underpinned by our values</span><span className="ln" /></div>
        <div className="casc-vals">
          {fdn.values.map((v, i) => (
            <div key={i} className="casc-val">
              {editing && fdn.values.length > 1 && <button className="vdel" onClick={() => delValue(i)} aria-label="Remove value"><Icon name="x" cls="xs" /></button>}
              <div className="vn">{String(i + 1).padStart(2, '0')}</div>
              <CascEd editing={editing} value={v.t} placeholder="Value name" className="vt" onChange={(val) => setValue(i, 't', val)} />
              <CascEd editing={editing} multiline value={v.b} placeholder="What this value means in practice…" className="vb" onChange={(val) => setValue(i, 'b', val)} />
            </div>
          ))}
          {editing && <div className="casc-val-add" onClick={addValue}><Icon name="plus" cls="lg" /><div style={{ fontSize: 12.5, fontWeight: 600 }}>Add value</div></div>}
        </div>
      </div>
    </div>
  )
}

/* ---- guided wizard ---- */
type WzStep = { id: string; title: string; eyebrow: string; prompt: string; hint: string }
const WZ_STEPS: WzStep[] = [
  { id: 'vision', title: 'Vision', eyebrow: 'Guided · North star',
    prompt: 'What is your long-term north star?', hint: "One ambitious, enduring sentence — where the company is ultimately headed. It should outlast any single year's plan." },
  { id: 'mission', title: 'Mission', eyebrow: 'Guided · Why we exist',
    prompt: 'Why does the company exist, today?', hint: 'Who you serve and how. Present-tense and concrete — the work you do every day.' },
  { id: 'ambition', title: 'Ambition', eyebrow: 'Guided · Where we\'ll be',
    prompt: 'What will success look like in a few years?', hint: 'A measurable mid-term aspiration. Add up to three headline numbers that make it real.' },
  { id: 'values', title: 'Values', eyebrow: 'Guided · How we work',
    prompt: 'What convictions guide how you work?', hint: 'Add several. Each is a short name plus a sentence on what it means in practice.' },
  { id: 'intent', title: 'Strategic intent', eyebrow: 'Guided · The bridge',
    prompt: 'How does this year\'s strategy carry the vision forward?', hint: 'A short paragraph connecting the vision to this year — then name the four pillars that carry it into action.' },
]

function FoundationWizard({ draft, set, onClose, onFinish, onStep }: {
  draft: Fdn
  set: SetFdn
  onClose: () => void
  onFinish: () => void
  onStep: (id: string) => void
}) {
  const [i, setI] = useState(0)
  const step = WZ_STEPS[i]
  useEffect(() => { onStep(step.id) }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  const last = i === WZ_STEPS.length - 1
  const setVision = (k: keyof Fdn['vision'], v: string) => set({ ...draft, vision: { ...draft.vision, [k]: v } })
  const setMission = (k: keyof Fdn['mission'], v: string) => set({ ...draft, mission: { ...draft.mission, [k]: v } })
  const setAmbitionTitle = (v: string) => set({ ...draft, ambition: { ...draft.ambition, title: v } })
  const setAmbitionStats = (s: AmbitionStat[]) => set({ ...draft, ambition: { ...draft.ambition, stats: s } })
  const setStat = (idx: number, k: keyof AmbitionStat, v: string) => setAmbitionStats(draft.ambition.stats.map((x, j) => (j === idx ? { ...x, [k]: v } : x)))
  const setVal = (idx: number, k: keyof FoundationValue, v: string) => set({ ...draft, values: draft.values.map((x, j) => (j === idx ? { ...x, [k]: v } : x)) })
  const addVal = () => set({ ...draft, values: [...draft.values, { t: '', b: '' }] })
  const delVal = (idx: number) => set({ ...draft, values: draft.values.filter((_, j) => j !== idx) })
  const setPil = (idx: number, k: keyof FdnPillar, v: string) => set({ ...draft, pillars: (draft.pillars || []).map((x, j) => (j === idx ? { ...x, [k]: v } : x)) })

  return (
    <SideWindow open onClose={onClose} eyebrow={step.eyebrow} title={step.title}
      footer={<div style={{ display: 'contents' }}>
        <button className="btn" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}><Icon name="cleft" cls="sm" /> Back</button>
        <div style={{ flex: 1 }} />
        {last
          ? <button className="btn btn--primary" onClick={onFinish}><Icon name="ok" cls="sm" /> Save foundation</button>
          : <button className="btn btn--primary" onClick={() => setI((x) => x + 1)}>Next <Icon name="cright" cls="sm" /></button>}
      </div>}>
      <div>
        <div className="wt-prog">{WZ_STEPS.map((s, k) => <div key={s.id} className={'wt-seg' + (k < i ? ' done' : k === i ? ' cur' : '')} />)}</div>
        <div className="wt-step" style={{ marginTop: 8 }}>Step {i + 1} of {WZ_STEPS.length}</div>
      </div>
      <div className="wt-prompt">{step.prompt}</div>
      <div className="wt-hint"><Icon name="help" cls="sm" style={{ marginRight: 6, verticalAlign: '-3px', color: 'var(--forest)' }} /> {step.hint}</div>

      {step.id === 'vision' && (
        <div style={{ display: 'contents' }}>
          <Field label="Vision statement"><textarea className="ed-text" value={draft.vision.text} placeholder="To be the…" onChange={(e) => setVision('text', e.target.value)} /></Field>
          <Field label="Anchor line" opt><input className="input" value={draft.vision.tag} placeholder="A short line under the vision" onChange={(e) => setVision('tag', e.target.value)} /></Field>
        </div>
      )}
      {step.id === 'mission' && (
        <div style={{ display: 'contents' }}>
          <Field label="Mission statement"><textarea className="ed-text" value={draft.mission.title} placeholder="We help…" onChange={(e) => setMission('title', e.target.value)} /></Field>
          <Field label="Supporting detail" opt><textarea className="ed-text" value={draft.mission.body} placeholder="A sentence or two of context…" onChange={(e) => setMission('body', e.target.value)} /></Field>
        </div>
      )}
      {step.id === 'ambition' && (
        <div style={{ display: 'contents' }}>
          <Field label="Ambition statement"><textarea className="ed-text" value={draft.ambition.title} placeholder="By 2028 we will…" onChange={(e) => setAmbitionTitle(e.target.value)} /></Field>
          <Field label="Headline numbers" opt>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="wz-stat-row" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--n-400)' }}>
                <span>Value</span><span>Unit</span><span>Label</span>
              </div>
              {draft.ambition.stats.map((s, k) => (
                <div key={k} className="wz-stat-row">
                  <input value={s.big} placeholder="18" onChange={(e) => setStat(k, 'big', e.target.value)} />
                  <input value={s.unit} placeholder="BNOK" onChange={(e) => setStat(k, 'unit', e.target.value)} />
                  <input value={s.label} placeholder="What it measures" onChange={(e) => setStat(k, 'label', e.target.value)} />
                </div>
              ))}
            </div>
          </Field>
        </div>
      )}
      {step.id === 'values' && (
        <div className="field">
          <div className="wt-chips">
            {draft.values.map((v, k) => (
              <div key={k} style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, position: 'relative' }}>
                <div className="row ac" style={{ gap: 8 }}>
                  <span className="vn" style={{ width: 28, height: 28, fontSize: 12 }}>{String(k + 1).padStart(2, '0')}</span>
                  <input className="input" style={{ flex: 1 }} value={v.t} placeholder="Value name" onChange={(e) => setVal(k, 't', e.target.value)} />
                  {draft.values.length > 1 && <button className="ed-del" onClick={() => delVal(k)}><Icon name="x" cls="xs" /></button>}
                </div>
                <textarea className="ed-text" style={{ marginTop: 8, minHeight: 54 }} value={v.b} placeholder="What this value means in practice…" onChange={(e) => setVal(k, 'b', e.target.value)} />
              </div>
            ))}
          </div>
          <button className="ed-add" style={{ marginTop: 10 }} onClick={addVal}><Icon name="plus" cls="xs" /> Add value</button>
        </div>
      )}
      {step.id === 'intent' && (
        <div style={{ display: 'contents' }}>
          <Field label="Strategic intent"><textarea className="ed-text" style={{ minHeight: 120 }} value={draft.intent.lead} placeholder="In 2026 we will…" onChange={(e) => set({ ...draft, intent: { ...draft.intent, lead: e.target.value } })} /></Field>
          <Field label="The pillars that carry the intent">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {(draft.pillars || []).map((p, k) => (
                <div key={p.id || k} style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderLeft: '3px solid ' + p.color, borderRadius: 10, padding: 11 }}>
                  <div className="row ac" style={{ gap: 8 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', color: 'var(--n-400)', flex: 'none' }}>P{String(k + 1).padStart(2, '0')}</span>
                    <input className="input" style={{ flex: 1 }} value={p.name} placeholder="Pillar name" onChange={(e) => setPil(k, 'name', e.target.value)} />
                  </div>
                  <input className="input" style={{ marginTop: 7, fontSize: 12.5 }} value={p.q} placeholder="What this pillar drives…" onChange={(e) => setPil(k, 'q', e.target.value)} />
                </div>
              ))}
            </div>
          </Field>
        </div>
      )}
    </SideWindow>
  )
}

/* ---- main view ---- */
export function FoundationView() {
  const { foundation, pillars, updateFoundation, updatePillar } = useStrategyFoundation()
  const toast = useToolsToast()
  // useToolsData is part of the design's foundation context; touch it so the
  // view stays wired to the people/date provider even if it reads no field yet.
  useToolsData()

  const [editing, setEditing] = useState(false)
  const [wizard, setWizard] = useState<{ draft: Fdn } | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [mode, setMode] = useState<'cascade' | 'detail'>('cascade')

  // The persisted foundation, merged over the design's example as the fallback.
  const fdn = mergeFoundation(foundation, pillars)
  // ctx mirrors the design's { toast, setView }. There is no in-view router in
  // the tools shell yet, so navigation links are inert (kept for layout parity).
  const ctx: Ctx = { toast, setView: () => {} }

  // Apply a full-object replace from the design's editors as hook patches.
  const setFdn: SetFdn = (next) => commitFoundation(fdn, next, { updateFoundation, updatePillar })
  const setDisplay: SetFdn = wizard ? ((d) => setWizard({ draft: d })) : setFdn
  const display = wizard ? wizard.draft : fdn

  const startWizard = (from: boolean) => { setEditing(false); setWizard({ draft: from ? JSON.parse(JSON.stringify(fdn)) : blankFoundation(pillars) }) }
  const finishWizard = () => {
    if (wizard) {
      const d = wizard.draft
      updateFoundation({
        visionText: d.vision.text,
        visionTag: d.vision.tag,
        missionTitle: d.mission.title,
        missionBody: d.mission.body,
        ambitionTitle: d.ambition.title,
        ambitionStats: d.ambition.stats,
        values: d.values,
        intentLead: d.intent.lead,
      })
      d.pillars.forEach((p) => updatePillar(p.id, { name: p.name, missionQuestion: p.q, color: p.color }))
    }
    setWizard(null); setHighlight(null); toast('Foundation saved')
  }

  const Board = mode === 'cascade' || wizard ? FoundationCascade : FoundationDetail

  // Design's resetExample: overwrite the org's foundation with the example copy.
  const resetExample = () => {
    updateFoundation({
      visionText: DEFAULT_FOUNDATION.vision.text,
      visionTag: DEFAULT_FOUNDATION.vision.tag,
      missionTitle: DEFAULT_FOUNDATION.mission.title,
      missionBody: DEFAULT_FOUNDATION.mission.body,
      ambitionTitle: DEFAULT_FOUNDATION.ambition.title,
      ambitionStats: DEFAULT_FOUNDATION.ambition.stats,
      values: DEFAULT_FOUNDATION.values,
      intentLead: DEFAULT_FOUNDATION.intent.lead,
    })
    toast('Reset to example')
  }

  const actions = wizard ? null : (editing ? (
    <div style={{ display: 'contents' }}>
      <button className="btn sm" onClick={resetExample}><Icon name="repeat" cls="sm" /> Reset to example</button>
      <button className="btn btn--primary sm" onClick={() => { setEditing(false); toast('Foundation saved') }}><Icon name="ok" cls="sm" /> Done editing</button>
    </div>
  ) : (
    <div style={{ display: 'contents' }}>
      <div className="casc-toggle">
        <button className={'casc-tbtn' + (mode === 'cascade' ? ' on' : '')} onClick={() => setMode('cascade')}><Icon name="sitemap" cls="sm" /> Cascade</button>
        <button className={'casc-tbtn' + (mode === 'detail' ? ' on' : '')} onClick={() => setMode('detail')}><Icon name="layers" cls="sm" /> Detail</button>
      </div>
      <button className="btn sm" onClick={() => setEditing(true)}><Icon name="pencil" cls="sm" /> Edit</button>
      <button className="btn btn--primary sm" onClick={() => startWizard(false)}><Icon name="compass" cls="sm" /> New foundation</button>
    </div>
  ))

  return (
    <div>
      <PageHead
        title="Foundation"
        sub="The golden thread of the strategy — vision to mission to ambition to intent, fanning into the pillars and the live plan. Build it with the guided wizard, or edit any part inline."
        actions={actions} />

      {wizard
        ? <HumanNote>Walk through each step on the right — the cascade builds live and highlights the element you're shaping. Save when you're done, or close to discard.</HumanNote>
        : editing
          ? <div className="humannote" style={{ marginBottom: 4 }}><Icon name="shield" /><p>Click any field to edit. Add or remove values, change the headline numbers — everything saves automatically.</p></div>
          : <HumanNote>Read it top to bottom: each element flows into the next, and the pillars connect straight to your objectives and initiatives. A foundation guides judgement; it doesn't replace it.</HumanNote>}

      <div style={{ height: 20 }} />
      <Board fdn={display} editing={editing || !!wizard} set={setDisplay} highlight={wizard ? highlight : null} ctx={ctx} />

      {wizard && <FoundationWizard draft={wizard.draft} set={(d) => setWizard({ draft: d })}
        onClose={() => { setWizard(null); setHighlight(null) }} onFinish={finishWizard} onStep={setHighlight} />}
    </div>
  )
}

/* A blank draft for the wizard — empty fields, the org's real pillars kept so
   the intent step can name them. Mirrors the design's blankFoundation(). */
function blankFoundation(pillars: StrategyPillar[]): Fdn {
  return {
    vision: { text: '', tag: '' },
    mission: { title: '', body: '' },
    ambition: { title: '', stats: [{ big: '', unit: '', label: '' }, { big: '', unit: '', label: '' }, { big: '', unit: '', label: '' }] },
    values: [{ t: '', b: '' }],
    intent: { lead: '' },
    pillars: pillars.map((p) => ({ id: p.id, name: p.name, q: p.missionQuestion, color: p.color })),
  }
}

export default FoundationView
