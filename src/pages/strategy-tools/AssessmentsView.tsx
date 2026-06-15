/* View: Assessments — interactive diagnostics with stored, versioned results.
   Library → runner (intro / questions / results) → history (trend) + multi-rater
   team campaigns. Faithful 1:1 port of the design package's views_assessments.jsx,
   rewired to be DB-driven via useStrategyAssessments (no localStorage / globals).
   Primitives, people/date context and toast come from the shared StrategyTools kit. */

import { useMemo, useState, type CSSProperties } from 'react'
import {
  Icon, Avatar, Bar, SideWindow, HumanNote, PageHead, useToolsData,
} from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import {
  ASSESSMENTS, BARS, ASSESSMENT_ORDER, ASSESSMENT_GROUPS,
  percentile, band, scoreRun, syntheticGap,
  type AssessmentDef,
} from './assessmentDefs'
import { useStrategyAssessments } from '../../hooks/useStrategyAssessments'
import type {
  AssessmentResult,
  AssessmentRun,
  AssessmentCampaign,
  CampaignRespondent,
  RunMode,
  AssessmentResponse,
  AssessmentComment,
} from '../../types/strategyTools'

/* ---------- charts ---------- */
function Radar({ dims, color = '#1a3d32', size = 230 }: { dims: { id: string; name: string; value: number; color?: string }[]; color?: string; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size * 0.37, n = dims.length
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]
  const rings = [0.25, 0.5, 0.75, 1]
  const poly = dims.map((d, i) => pt(i, R * (d.value / 100)).join(',')).join(' ')
  return (
    <svg width={size} height={size} style={{ maxWidth: '100%' }}>
      {rings.map((r, k) => (
        <polygon key={k} points={dims.map((_, i) => pt(i, R * r).join(',')).join(' ')} fill="none" stroke="#e3ddcc" strokeWidth="1" />
      ))}
      {dims.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e3ddcc" strokeWidth="1" /> })}
      <polygon points={poly} fill={color} fillOpacity="0.16" stroke={color} strokeWidth="2" />
      {dims.map((d, i) => { const [x, y] = pt(i, R * (d.value / 100)); return <circle key={i} cx={x} cy={y} r="3.5" fill={color} /> })}
      {dims.map((d, i) => {
        const [x, y] = pt(i, R + 16); const anchor = Math.abs(x - cx) < 12 ? 'middle' : x > cx ? 'start' : 'end'
        return <text key={i} x={x} y={y} textAnchor={anchor} fontSize="10.5" fontWeight="600" fill="#525252">{d.name.split(' ')[0]}</text>
      })}
    </svg>
  )
}

function Quad2x2({ x, y, xl, yl }: { x: number; y: number; xl: string; yl: string }) {
  const px = Math.max(6, Math.min(94, x)), py = Math.max(6, Math.min(94, 100 - y))
  return (
    <div>
      <div className="quad2">
        <div className="axis v" /><div className="axis h" />
        <div className="qz" style={{ top: '16%', left: '52%' }}>Ready &amp; sharp</div>
        <div className="qz" style={{ top: '16%', right: '52%', textAlign: 'center' }}>Eager but unclear</div>
        <div className="qz" style={{ bottom: '16%', right: '52%' }}>Stuck</div>
        <div className="qz" style={{ bottom: '16%', left: '52%' }}>Clear, not ready</div>
        <div className="dot" style={{ left: px + '%', top: py + '%' }} />
        <div className="ql" style={{ top: 4, left: '50%', transform: 'translateX(-50%)' }}>{yl} ↑</div>
        <div className="ql" style={{ bottom: 4, right: 8 }}>{xl} →</div>
      </div>
    </div>
  )
}

function relTimeA(ts: string): string {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 86400) return 'today'
  if (d < 172800) return 'yesterday'
  return Math.floor(d / 86400) + 'd ago'
}

/* ---------- library card ---------- */
function AssessmentCard({ a, runs, campaigns, onStart, onSend }: {
  a: AssessmentDef
  runs: AssessmentRun[]
  campaigns: AssessmentCampaign[]
  onStart: () => void
  onSend: () => void
}) {
  const last = runs[0]
  const activeCamp = (campaigns || []).find((c) => c.respondents.some((r) => r.status !== 'done'))
  return (
    <div className="as-card" style={{ '--ac': a.ac } as CSSProperties} onClick={onStart}>
      <div className="row ac" style={{ justifyContent: 'space-between' }}>
        <span className="as-ic"><Icon name={a.icon} /></span>
        <span className={'as-flag ' + a.flag}>{a.flagLabel}</span>
      </div>
      <div className="as-title">{a.name}</div>
      <div className="as-desc">{a.desc}</div>
      <div className="as-fw">Based on {a.framework}</div>
      <div className="as-meta">
        <span className="mi"><Icon name="clock" cls="xs" /> {a.time}</span>
        {a.multirater && <span className="mi"><Icon name="users" cls="xs" /> Multi-rater</span>}
        {a.perceptionGap && <span className="mi"><Icon name="activity" cls="xs" /> Perception gap</span>}
      </div>
      <div className="as-foot">
        <button className="btn btn--primary sm" onClick={(e) => { e.stopPropagation(); onStart() }}>
          <Icon name="cright" cls="sm" /> {last ? 'Take again' : 'Start'}
        </button>
        {a.multirater && <button className="btn sm" onClick={(e) => { e.stopPropagation(); onSend() }}><Icon name="users" cls="sm" /> Send to team</button>}
      </div>
      {(last || activeCamp) && <div className="as-spark" style={{ marginTop: 10 }}>
        {activeCamp ? <span><Icon name="users" cls="xs" /> Campaign live · {activeCamp.respondents.filter((r) => r.status === 'done').length}/{activeCamp.respondents.length} in</span>
          : last ? <span><Icon name="clock" cls="xs" /> Last: {last.composite}/100 · {relTimeA(last.ts)}</span> : null}
      </div>}
    </div>
  )
}

/* ---------- per-question comment & response collectors ---------- */
type QListItem = { key: string; q: string; dim: string; color?: string }
function questionList(a: AssessmentDef): QListItem[] {
  if (a.kind === 'maturity') {
    const out: QListItem[] = []
    ;(a.dims || []).forEach((d) => d.items.forEach((it, i) => out.push({ key: d.id + ':' + i, q: it.q, dim: d.name, color: d.color })))
    return out
  }
  if (a.kind === 'slider') return (a.steps || []).map((s) => ({ key: s.id, q: s.q, dim: s.name }))
  if (a.kind === 'scenario') return (a.scenarios || []).map((s, i) => ({ key: 'q' + i, q: s.q, dim: 'Scenario ' + (i + 1) }))
  return []
}
function collectComments(a: AssessmentDef, ans: Record<string, unknown>): AssessmentComment[] {
  return questionList(a)
    .map((q) => ({ q: q.q, dim: q.dim, color: q.color, text: String(ans['_c' + q.key] ?? '').trim() }))
    .filter((c) => c.text)
}
function collectResponses(a: AssessmentDef, ans: Record<string, unknown>): AssessmentResponse[] {
  return questionList(a).map((q) => {
    let display = '—'
    if (a.kind === 'maturity') { const v = ans[q.key] as number | undefined; display = v ? BARS[v - 1] + ' (' + v + ')' : '—' }
    else if (a.kind === 'slider') { const v = ans[q.key] as number | undefined; display = v != null ? v + '/100' : '—' }
    else if (a.kind === 'scenario') {
      const pick = ans['_pick' + q.key] as number | undefined
      const sc = (a.scenarios || [])[parseInt(q.key.slice(1))]
      display = pick != null && sc ? sc.opts[pick].t : '—'
    }
    return { q: q.q, dim: q.dim, color: q.color, display, comment: String(ans['_c' + q.key] ?? '').trim() }
  })
}

/* ---------- individual response viewer (side window) ---------- */
function IndividualResponse({ a, pid, result, onClose }: {
  a: AssessmentDef
  pid: string | null
  result: AssessmentResult
  onClose: () => void
}) {
  const { P } = useToolsData()
  const responses = result.responses || []
  const bd = band(result.composite)
  const person = pid ? P[pid] : undefined
  return (
    <SideWindow open onClose={onClose} wide eyebrow={a.name} title={person ? person.name + ' · response' : 'Individual response'}
      footer={<div style={{ display: 'contents' }}><button className="btn btn--ghost" onClick={onClose}>Close</button></div>}>
      <div className="row ac" style={{ gap: 13, padding: '2px 0 6px' }}>
        {pid && <Avatar id={pid} size="md" />}
        <div style={{ flex: 1 }}>
          {person && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--n-900)' }}>{person.name}</div>}
          {person?.role && <div style={{ fontSize: 12, color: 'var(--n-500)' }}>{person.role}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 26, color: bd.color, lineHeight: 1 }}>{result.composite}</div>
          <div className="res-band" style={{ background: bd.color + '18', color: bd.color, marginTop: 4, display: 'inline-block' }}>{bd.label}</div>
        </div>
      </div>
      {/* dimension chips */}
      <div className="row ac" style={{ gap: 7, flexWrap: 'wrap', paddingBottom: 6 }}>
        {result.dims.map((d) => <span key={d.id} className="badge badge--neutral" style={{ borderLeft: '3px solid ' + (d.color || a.ac) }}>{d.name} {d.value}</span>)}
      </div>
      <div className="ir-divider" />
      <div className="flabel" style={{ marginBottom: 4 }}>Answers &amp; comments · {responses.length} questions</div>
      {responses.map((r, k) => (
        <div key={k} className="ir-q">
          <div className="ir-qhead">
            {r.dim && <span className="ir-dim" style={{ color: r.color || a.ac }}>{r.dim}</span>}
            <span className="ir-ans">{r.display}</span>
          </div>
          <div className="ir-qt">{r.q}</div>
          {r.comment && <div className="ir-comment"><Icon name="msgsq" cls="xs" /> {r.comment}</div>}
        </div>
      ))}
    </SideWindow>
  )
}

/* ---------- runner ---------- */
type RunPhase = 'intro' | 'q' | 'results'
type FlatQuestion = {
  key: string
  q: string
  help?: string
  dim?: { id: string; name: string; color: string }
  name?: string
  slider?: boolean
  scenario?: boolean
  lo?: string
  hi?: string
  opts?: { s: string; t: string }[]
}
function Runner({ a, onExit, onComplete, lastRuns }: {
  a: AssessmentDef
  onExit: () => void
  onComplete: (result: AssessmentResult, answers: Record<string, unknown>, mode: RunMode) => void
  lastRuns: TrendRun[]
}) {
  const [phase, setPhase] = useState<RunPhase>('intro') // intro | q | results
  const [mode, setMode] = useState<RunMode>('self')
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<AssessmentResult | null>(null)

  // flatten questions
  const questions = useMemo<FlatQuestion[]>(() => {
    if (a.kind === 'maturity') {
      const out: FlatQuestion[] = []
      ;(a.dims || []).forEach((d) => d.items.forEach((it, idx) => out.push({ key: d.id + ':' + idx, dim: d, q: it.q, help: it.help })))
      return out
    }
    if (a.kind === 'slider') return (a.steps || []).map((s) => ({ key: s.id, slider: true, name: s.name, q: s.q, lo: s.lo, hi: s.hi }))
    return (a.scenarios || []).map((s, idx) => ({ key: 'sc' + idx, scenario: true, q: s.q, opts: s.opts }))
  }, [a])

  function answer(key: string, val: unknown) { setAnswers((p) => ({ ...p, [key]: val })) }
  function finish(ans: Record<string, unknown>) {
    const r = scoreRun(a, ans as Record<string, number | string>)
    r.comments = collectComments(a, ans)
    r.responses = collectResponses(a, ans)
    setResult(r); setPhase('results')
    onComplete(r, ans, mode)
  }
  function next() { if (i < questions.length - 1) setI(i + 1); else finish(answers) }
  function back() { if (i > 0) setI(i - 1); else setPhase('intro') }

  if (phase === 'intro') {
    return (
      <div className="run-wrap">
        <div className="crumb" onClick={onExit}><Icon name="cleft" cls="sm" /> Assessments</div>
        <div className="run-intro">
          <div className="run-hero" style={{ '--ac': a.ac, background: a.ac } as CSSProperties}>
            <div className="rk">{a.flagLabel} · {a.time}</div>
            <div className="rt">{a.name}</div>
            <div className="rd">{a.desc}</div>
          </div>
          <div className="run-body">
            <div className="run-feat"><span className="fi"><Icon name="clip" cls="sm" /></span><div><div className="ft">{questions.length} questions · transparent scoring</div><div className="fs">Every weight is published — open the methodology on your results to see exactly how the score is built.</div></div></div>
            {a.multirater && <div className="run-feat"><span className="fi"><Icon name="users" cls="sm" /></span><div><div className="ft">Multi-rater {a.perceptionGap ? 'perception gap' : 'alignment gap'}</div><div className="fs">{a.perceptionGap ? 'Compare your self-view with how your reports would score you.' : "See where your leadership team disagrees — divergence is the signal."}</div></div></div>}
            <div className="run-feat"><span className="fi"><Icon name="trend" cls="sm" /></span><div><div className="ft">Benchmarked &amp; longitudinal</div><div className="fs">A live percentile vs. a peer pool, plus a trend line that grows every time you re-take.</div></div></div>

            {a.multirater && (
              <div style={{ marginTop: 18 }}>
                <div className="flabel" style={{ marginBottom: 8 }}>How are you taking it?</div>
                <div className="mode-row">
                  <div className={'mode-opt' + (mode === 'self' ? ' on' : '')} onClick={() => setMode('self')}>
                    <div className="mt"><Icon name="user" cls="sm" /> Just me</div><div className="ms">A quick self-assessment.</div>
                  </div>
                  <div className={'mode-opt' + (mode === 'team' ? ' on' : '')} onClick={() => setMode('team')}>
                    <div className="mt"><Icon name="users" cls="sm" /> {a.perceptionGap ? 'Self + report view' : 'Leadership team'}</div><div className="ms">{a.perceptionGap ? 'Adds the perception-gap insight.' : 'Adds the alignment-gap insight.'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="row ac" style={{ gap: 10, marginTop: 22 }}>
              <button className="btn btn--primary" onClick={() => { setI(0); setAnswers({}); setPhase('q') }}><Icon name="cright" cls="sm" /> Begin</button>
              <button className="btn btn--ghost" onClick={onExit}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'q') {
    const q = questions[i]; const val = answers[q.key]
    const canNext = q.slider ? true : val != null
    return (
      <div className="q-shell">
        <div className="crumb" onClick={onExit}><Icon name="cleft" cls="sm" /> {a.name}</div>
        <div className="q-prog"><i style={{ width: ((i + (canNext ? 1 : 0)) / questions.length) * 100 + '%' }} /></div>
        <div className="q-progmeta"><span>Question {i + 1} of {questions.length}</span><span>{Math.round((i) / questions.length * 100)}% complete</span></div>

        {q.dim && <div className="q-dim" style={{ color: q.dim.color }}>{q.dim.name}</div>}
        {q.name && !q.dim && <div className="q-dim" style={{ color: a.ac }}>{q.name}</div>}
        <div className="q-text">{q.q}</div>
        {q.help && <div className="q-help">{q.help}</div>}

        {q.slider ? (
          <div className="sl-wrap">
            <div className="sl-val">{val != null ? (val as number) : 50}</div>
            <input className="sl-input" type="range" min="0" max="100" value={val != null ? (val as number) : 50} onChange={(e) => answer(q.key, +e.target.value)} />
            <div className="sl-scale"><span>{q.lo}</span><span>{q.hi}</span></div>
          </div>
        ) : q.scenario ? (
          <div style={{ marginTop: 24 }}>
            {(q.opts || []).map((o, k) => (
              <div key={k} className={'sc-opt' + (answers['_pick' + q.key] === k ? ' on' : '')} onClick={() => { answer(q.key, o.s); setAnswers((p) => ({ ...p, [q.key]: o.s, ['_pick' + q.key]: k })) }}>
                <span className="sc-letter">{String.fromCharCode(65 + k)}</span><span className="sc-txt">{o.t}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="likert">
            {BARS.map((label, k) => {
              const score = k + 1
              return (
                <button key={k} className={'lk-opt' + (val === score ? ' on' : '')} onClick={() => answer(q.key, score)}>
                  <span className="lk-num">{score}</span><span className="lk-txt">{label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="q-comment">
          <div className="q-comment-lbl"><Icon name="msgsq" cls="xs" /> Add a comment <span style={{ color: 'var(--n-400)', fontWeight: 500 }}>(optional)</span></div>
          <textarea className="ed-text" style={{ minHeight: 52 }} value={String(answers['_c' + q.key] ?? '')} placeholder="Context, an example, or why you scored it this way…" onChange={(e) => answer('_c' + q.key, e.target.value)} />
        </div>

        <div className="row ac" style={{ gap: 10, marginTop: 28, justifyContent: 'space-between' }}>
          <button className="btn" onClick={back}><Icon name="cleft" cls="sm" /> Back</button>
          <button className="btn btn--primary" disabled={!canNext} onClick={next}>
            {i === questions.length - 1 ? <span style={{ display: 'contents' }}><Icon name="ok" cls="sm" /> See results</span> : <span style={{ display: 'contents' }}>Next <Icon name="cright" cls="sm" /></span>}
          </button>
        </div>
      </div>
    )
  }

  // results
  return result ? <Results a={a} result={result} mode={mode} onExit={onExit} onRetake={() => { setAnswers({}); setI(0); setResult(null); setPhase('intro') }} lastRuns={lastRuns} /> : null
}

/* ---------- results ---------- */
type TrendRun = { ts: string; composite: number; id?: string }
function Results({ a, result, mode, onExit, onRetake, lastRuns }: {
  a: AssessmentDef
  result: AssessmentResult
  mode: RunMode
  onExit: () => void
  onRetake: () => void
  lastRuns: TrendRun[]
}) {
  const bd = band(result.composite)
  const pct = a.bench ? percentile(result.composite, a.bench) : null
  const recs = buildRecs(a, result)
  const prev = (lastRuns || []).filter((r) => r.id !== 'current')
  const gapVal = (a.multirater && mode === 'team') ? syntheticGap(a, result) : null

  return (
    <div>
      <div className="crumb" onClick={onExit}><Icon name="cleft" cls="sm" /> Assessments</div>
      <div className="phead" style={{ marginBottom: 16 }}>
        <div className="phead__t">
          <div className="row ac" style={{ gap: 10 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: a.ac }}>{a.name}</span></div>
          <div className="h1 sm" style={{ marginTop: 4 }}>Your results</div>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={onRetake}><Icon name="repeat" cls="sm" /> Retake</button>
          <button className="btn btn--primary sm" onClick={() => window.print()}><Icon name="download" cls="sm" /> Export PDF</button>
        </div>
      </div>

      {a.kind === 'scenario' ? (
        <ScenarioResults a={a} result={result} />
      ) : (
        <div style={{ display: 'contents' }}>
          <div className="res-hero">
            <div className="res-score" style={{ borderColor: bd.color + '30' }}>
              <div className="big">{result.composite}</div><div className="of">out of 100</div>
              <div className="res-band" style={{ background: bd.color + '18', color: bd.color }}>{bd.label}</div>
            </div>
            <div>
              <div className="res-lead">{leadLine(a, result, bd)}</div>
              <div className="res-leadsub">{leadSub(pct)}</div>
              {pct != null && a.bench && (
                <div className="bench" style={{ marginTop: 14 }}>
                  <div className="bench-track" /><div className="bench-you" data-l={'You · ' + pct + 'th pct'} style={{ left: pct + '%' }} />
                  <div className="bench-scale"><span>Peer pool · {a.bench.n.toLocaleString()} {a.id === 'oneonone' ? 'managers' : 'teams'}</span><span>Top 1%</span></div>
                </div>
              )}
            </div>
          </div>

          <div className="res-2">
            <div className="res-card">
              <div className="ct">Dimension radar</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Radar dims={result.dims} color={a.ac} /></div>
              <div style={{ marginTop: 14 }}>
                {result.dims.map((d) => (
                  <div key={d.id} className="dim-row">
                    <div className="dim-head">
                      <span className="dim-name"><span className="pdot" style={{ background: d.color || a.ac }} />{d.name}</span>
                      <span className="dim-val">{d.value}/100</span>
                    </div>
                    <Bar pct={d.value} color={d.color || a.ac} thin />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {a.quad && (
                <div className="res-card">
                  <div className="ct">Quality vs. readiness</div>
                  <Quad2x2 x={(result.dims.find((d) => d.id === a.quad?.x) || { value: 0 }).value || 0} y={(result.dims.find((d) => d.id === a.quad?.y) || { value: 0 }).value || 0} xl={a.quad.xl} yl={a.quad.yl} />
                </div>
              )}
              {gapVal != null && (
                <div className="res-card">
                  <div className="ct">{a.perceptionGap ? 'Perception gap' : 'Alignment gap'}</div>
                  <div className="gap-viz">
                    <div className="gap-lab"><span>{a.perceptionGap ? 'How reports would score you' : "Team's lowest view"}</span><span style={{ fontWeight: 700 }}>{gapVal}</span></div>
                    <div className="gap-bar"><div className="gap-seg" style={{ left: 0, width: gapVal + '%', background: '#cdd9e6' }} /><div className="gap-seg" style={{ left: gapVal + '%', width: (result.composite - gapVal) + '%', background: '#f0d8cd' }} /></div>
                    <div className="gap-lab"><span>Your self-view</span><span style={{ fontWeight: 700 }}>{result.composite}</span></div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--n-600)', lineHeight: 1.5, marginTop: 12 }}>
                    A <b>{result.composite - gapVal}-point</b> gap. {a.perceptionGap ? 'You rate your 1:1s higher than your reports likely would — the single most useful thing to close.' : "Your team doesn't fully agree on the strategy. Divergence, not the average, is where the work is."}
                  </div>
                </div>
              )}
              <div className="res-card">
                <div className="ct">Prioritised actions</div>
                {recs.map((r, k) => (
                  <div key={k} className="rec-item">
                    <span className="rec-num">{k + 1}</span>
                    <div><div className="rec-t">{r.t}</div><span className="rec-tag">{r.tag}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {prev.length > 0 && (
            <div className="res-card" style={{ marginTop: 16 }}>
              <div className="ct">Your trend · longitudinal</div>
              <TrendLine runs={[...prev].reverse().concat([{ ts: 'now', composite: result.composite }])} color={a.ac} />
            </div>
          )}

          <details className="method" style={{ marginTop: 16 }}>
            <summary><Icon name="shield" cls="sm" /> How this score is built — transparent methodology</summary>
            <p>Each statement is rated 1–5 on a behaviourally-anchored scale, averaged within its dimension and rescaled to 0–100. The composite is a published weighted mean — no black box.</p>
            {a.weights && Object.entries(a.weights).map(([k, w]) => {
              const d = (a.dims || []).find((x) => x.id === k)
              return <div key={k} className="wrow"><span>{d ? d.name : k}</span><span style={{ fontWeight: 700 }}>weight {Math.round(w * 100)}%</span></div>
            })}
            {pct != null && a.bench && <p style={{ marginTop: 8 }}>Your percentile compares your composite to a peer pool of {a.bench.n.toLocaleString()} respondents (mean {a.bench.mean}). Framework basis: {a.framework}.</p>}
          </details>
        </div>
      )}
    </div>
  )
}

function ScenarioResults({ a, result }: { a: AssessmentDef; result: AssessmentResult }) {
  const dom = result.dominant, blind = result.blind
  if (!dom || !blind) return null
  return (
    <div style={{ display: 'contents' }}>
      <div className="res-hero" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <div className="row ac" style={{ gap: 10, marginBottom: 8 }}><span className="as-flag flag">Dominant style</span></div>
          <div className="res-lead" style={{ fontSize: 24 }}>You lead mostly by <b style={{ color: a.ac }}>{dom.name}</b>.</div>
          <div className="res-leadsub">Your blind spot is <b>{blind.name}</b> — used in just {blind.value}% of situations. The strongest leaders flex across all four as the person and moment demand.</div>
        </div>
      </div>
      <div className="res-2">
        <div className="res-card"><div className="ct">Style mix</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Radar dims={result.dims} color={a.ac} /></div>
        </div>
        <div className="res-card"><div className="ct">Where your responses landed</div>
          {result.dims.map((d) => (
            <div key={d.id} className="dim-row">
              <div className="dim-head"><span className="dim-name">{d.name}{d.id === dom.id && <span className="rec-tag" style={{ margin: 0 }}>dominant</span>}</span><span className="dim-val">{d.value}%</span></div>
              <Bar pct={d.value} color={a.ac} thin />
            </div>
          ))}
          <div className="rec-item" style={{ marginTop: 8 }}><span className="rec-num">1</span><div><div className="rec-t">Try one {blind.name.toLowerCase()} move this week — ask a question where you'd normally give the answer.</div><span className="rec-tag">Situational Leadership</span></div></div>
        </div>
      </div>
    </div>
  )
}

function TrendLine({ runs, color }: { runs: { ts: string; composite: number }[]; color: string }) {
  const w = 600, h = 90, pad = 10
  const pts = runs.map((r, i): [number, number] => [pad + (i / Math.max(1, runs.length - 1)) * (w - pad * 2), h - pad - (r.composite / 100) * (h - pad * 2)])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(0) + ' ' + p[1].toFixed(0)).join(' ')
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} style={{ width: '100%', height: 100 }}>
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="4" fill={color} /><text x={p[0]} y={p[1] - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#525252">{runs[i].composite}</text></g>)}
    </svg>
  )
}

/* ---------- recommendation builder ---------- */
type Rec = { t: string; tag: string }
function buildRecs(a: AssessmentDef, result: AssessmentResult): Rec[] {
  if (a.kind === 'slider') {
    const weakest = result.dims.slice().sort((x, y) => x.value - y.value)[0]
    return [
      { t: `Your weakest kernel element is ${weakest.name.toLowerCase()} (${weakest.value}/100). Sharpen this first — a kernel is only as strong as its weakest link.`, tag: 'Rumelt kernel' },
      { t: 'Write your strategy as one sentence: the challenge, your approach, and the few coordinated actions.', tag: 'Guiding policy' },
    ]
  }
  const sorted = result.dims.slice().sort((x, y) => x.value - y.value)
  const recMap: Record<string, string> = {
    quality: "Run a Rumelt 'kernel check' — name the real challenge and the explicit trade-offs you're making.",
    readiness: 'Assign one accountable owner to every objective and lock a review cadence before adding new work.',
    alignment: 'Hold a leadership-team alignment session — surface where your top-three priorities diverge.',
    conversation: "Hand the agenda to your reports and start each 1:1 with 'what's most on your mind?'.",
    cadence: "Protect 1:1s as unmovable — cancelling signals they don't matter. Aim for zero cancellations a month.",
    coaching: 'Shift from answers to questions — use GROW to coach through one problem instead of solving it.',
  }
  const tagMap: Record<string, string> = { quality: 'Rumelt', readiness: 'Implementation Compass', alignment: 'McKinsey 7S', conversation: 'Rogelberg', cadence: 'Gallup', coaching: 'GROW' }
  return sorted.slice(0, 3).map((d) => ({ t: recMap[d.id] || ('Focus on improving ' + d.name + '.'), tag: tagMap[d.id] || a.name }))
}
function leadLine(a: AssessmentDef, result: AssessmentResult, bd: { label: string }): string {
  if (a.quad) {
    const q = result.dims.find((d) => d.id === a.quad?.x)?.value ?? 0, r = result.dims.find((d) => d.id === a.quad?.y)?.value ?? 0
    if (q >= 55 && r >= 55) return "Your strategy is well-formed and you're ready to execute it."
    if (q >= 55 && r < 55) return "Your strategy is sound — but you're not yet ready to execute it."
    if (q < 55 && r >= 55) return "You're geared to execute — but the strategy itself needs sharpening."
    return 'Both the strategy and your readiness to execute need work.'
  }
  if (a.id === 'oneonone') return 'Your 1:1 practice is ' + bd.label.toLowerCase() + ' — here\'s where to focus.'
  return 'Your kernel is ' + bd.label.toLowerCase() + '.'
}
function leadSub(pct: number | null): string {
  const base = pct != null ? `That places you in the ${pct}th percentile of peers. ` : ''
  return base + 'The radar and prioritised actions below show exactly where to put your next effort.'
}

/* ---------- history / versions side window ---------- */
function HistoryPanel({ a, runs, onClose, onView, onRename, onDelete }: {
  a: AssessmentDef
  runs: AssessmentRun[]
  onClose: () => void
  onView: (r: AssessmentRun) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <SideWindow open onClose={onClose} eyebrow={a.name} title="Saved results"
      footer={<div style={{ display: 'contents' }}><button className="btn btn--ghost" onClick={onClose}>Close</button></div>}>
      {runs.length === 0 && <div className="ver-empty"><Icon name="clock" cls="lg" /><div style={{ marginTop: 8 }}>No saved results yet.</div></div>}
      {runs.length > 1 && (
        <div className="res-card" style={{ marginBottom: 14 }}>
          <div className="ct">Trend</div>
          <TrendLine runs={[...runs].reverse()} color={a.ac} />
        </div>
      )}
      {runs.map((r) => {
        const bd = band(r.composite)
        return (
          <div key={r.id} className="ver-item">
            <div className="ver-top">
              <span className="trend-score" style={{ width: 38, height: 38, fontSize: 15, background: bd.color + '18', color: bd.color }}>{r.composite}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input className="ver-label" value={r.name} onChange={(e) => onRename(r.id, e.target.value)} />
                <div className="ver-meta">{relTimeA(r.ts)} <span style={{ color: 'var(--n-300)' }}>·</span> {r.mode === 'team' ? 'Multi-rater' : 'Self'} <span style={{ color: 'var(--n-300)' }}>·</span> {bd.label}</div>
              </div>
            </div>
            <div className="ver-actions">
              <button className="btn sm" onClick={() => onView(r)}><Icon name="search" cls="sm" /> View</button>
              <button className="btn btn--ghost sm" onClick={() => onDelete(r.id)}><Icon name="x" cls="sm" /> Delete</button>
            </div>
          </div>
        )
      })}
    </SideWindow>
  )
}

/* ---------- campaigns: launch, status, compiled group result ---------- */
const SYNTH_COMMENTS: Record<string, string[]> = {
  quality: ['The one-sentence test still trips us up.', "We've made real choices this year.", 'Differentiation is clearer to us than to clients.'],
  readiness: ['Ownership is the weak link.', 'Cadence has improved a lot.', "Funding doesn't always follow the strategy."],
  alignment: ["Top-3 priorities aren't shared below ExCo.", 'Cascade works in my unit.', 'Cross-functional decisions still clash.'],
  ability: ["We're short on data talent.", "Best people aren't on the biggest bets.", 'Performance issues linger too long.'],
  architecture: ['Decision rights are murky.', 'Information is slow to reach the front line.', 'Incentives reward activity, not outcomes.'],
  agility: ["We can't reallocate fast enough — this is our gap.", 'We rarely kill failing initiatives.', 'Adapting the plan takes too long.'],
  clarity: ['I get the strategy; my team less so.', 'Needs to be more specific.', 'Line of sight is good in finance.'],
  capacity: ['Too many priorities at once.', 'Urgent always beats important.', 'No protected strategic time.'],
  commitment: ['Leaders model it well.', 'Feels like compliance, not ownership.', 'Energy is genuinely high.'],
  followthrough: ['Say-do ratio needs work.', 'Accountability is improving.', 'We close loops better than last year.'],
  awareness: ['The why is clear to leadership only.', 'Cost of inaction landed well.', 'Needs wider communication.'],
  desire: ['WIIFM not addressed for middle layer.', 'Real appetite at the top.', 'Resistance is being ignored.'],
  knowledge: ['Training gaps remain.', 'Process knowledge is thin.', 'Good guidance available.'],
  reinforcement: ['Risk it fades after launch.', "Wins aren't celebrated enough.", 'Metrics not yet in place.'],
  conversation: ["Reports don't drive the agenda yet.", 'Safety is good in my team.', 'I talk too much.'],
  cadence: ['I cancel too often.', 'Consistent and protected.', 'Frequency varies by person.'],
  coaching: ['More telling than asking.', 'Follow-through is solid.', 'Career rarely comes up.'],
}
function synthRespResult(a: AssessmentDef): AssessmentResult {
  // plausible per-person result with realistic spread + comments on ~half the dims
  const aDims = a.dims || []
  const weights = a.weights || {}
  const dims = aDims.map((d) => ({ id: d.id, name: d.name, color: d.color, value: Math.max(28, Math.min(96, Math.round(50 + (Math.random() - 0.35) * 60))) }))
  const composite = Math.round(dims.reduce((s, dd) => s + dd.value * (weights[dd.id] || 0), 0))
  const responses: AssessmentResponse[] = []; const comments: AssessmentComment[] = []
  aDims.forEach((d) => d.items.forEach((it) => {
    const dv = dims.find((x) => x.id === d.id)?.value ?? 0
    const score = Math.max(1, Math.min(5, Math.round(1 + dv / 25 + (Math.random() - 0.5))))
    const pool = SYNTH_COMMENTS[d.id]; const cmt = (pool && Math.random() < 0.28) ? pool[Math.floor(Math.random() * pool.length)] : ''
    responses.push({ q: it.q, dim: d.name, color: d.color, display: BARS[score - 1] + ' (' + score + ')', comment: cmt })
    if (cmt) comments.push({ q: it.q, dim: d.name, color: d.color, text: cmt })
  }))
  return { dims, composite, responses, comments }
}
type AggDim = { id: string; name: string; color?: string; value: number; min: number; max: number }
type Aggregate = {
  dims: AggDim[]
  composite: number
  spread: number
  agreement: { k: string; label: string }
  n: number
}
function aggregate(a: AssessmentDef, done: { pid: string; result: AssessmentResult }[]): Aggregate {
  // done: [{pid, result}]
  const dims: AggDim[] = (a.dims || []).map((d) => {
    const vals = done.map((r) => r.result.dims.find((x) => x.id === d.id)?.value ?? 0)
    const mean = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
    return { id: d.id, name: d.name, color: d.color, value: mean, min: Math.min(...vals), max: Math.max(...vals) }
  })
  const composites = done.map((r) => r.result.composite)
  const composite = Math.round(composites.reduce((s, v) => s + v, 0) / composites.length)
  const spread = Math.round(dims.reduce((s, d) => s + (d.max - d.min), 0) / dims.length)
  const agreement = spread <= 15 ? { k: 'high', label: 'High agreement' } : spread <= 30 ? { k: 'mod', label: 'Moderate agreement' } : { k: 'low', label: 'Low agreement — divergence' }
  return { dims, composite, spread, agreement, n: done.length }
}

function CampaignLaunch({ a, onClose, onLaunch }: {
  a: AssessmentDef
  onClose: () => void
  onLaunch: (pids: string[], due: string, msg: string) => void
}) {
  const { people, P } = useToolsData()
  const [sel, setSel] = useState<string[]>(people.map((p) => p.id))
  const [due, setDue] = useState('2026-06-30')
  const [msg, setMsg] = useState('Please complete the ' + a.name + ' before our next leadership session. It takes about ' + a.time + '.')
  const toggle = (pid: string) => setSel((s) => s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid])
  return (
    <SideWindow open onClose={onClose} eyebrow={a.name} title="Send to the leadership team"
      footer={<div style={{ display: 'contents' }}>
        <button className="btn btn--primary" disabled={sel.length === 0} onClick={() => onLaunch(sel, due, msg)}><Icon name="bolt" cls="sm" /> Send to {sel.length}</button>
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
      </div>}>
      <div className="wt-hint"><Icon name="users" cls="sm" style={{ marginRight: 6, verticalAlign: '-3px', color: 'var(--forest)' }} /> Each person completes it independently. You'll see their status and a compiled group result with the divergence between raters surfaced — not averaged away.</div>
      <NField2 label={'Recipients · ' + sel.length + ' of ' + people.length}>
        <div className="camp-launch-list">
          {people.map((p) => {
            const on = sel.includes(p.id)
            const person = P[p.id]
            return (
              <div key={p.id} className={'camp-pick' + (on ? ' on' : '')} onClick={() => toggle(p.id)}>
                <span className="camp-check">{on && <Icon name="ok" cls="xs" />}</span>
                <Avatar id={p.id} size="sm" />
                <div style={{ flex: 1 }}><div className="nm">{p.name}</div>{person?.role && <div className="rl">{person.role}</div>}</div>
              </div>
            )
          })}
        </div>
      </NField2>
      <NField2 label="Due date"><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></NField2>
      <NField2 label="Message" opt><textarea className="ed-text" value={msg} onChange={(e) => setMsg(e.target.value)} /></NField2>
    </SideWindow>
  )
}
function NField2({ label, opt, children }: { label: string; opt?: boolean; children: React.ReactNode }) {
  return <div className="field"><div className="flabel">{label}{opt && <span className="opt" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--n-400)' }}> (optional)</span>}</div>{children}</div>
}

function CampaignView({ a, campaign, onExit, onSimulate, onSimulateAll, onRemind, onDelete }: {
  a: AssessmentDef
  campaign: AssessmentCampaign
  onExit: () => void
  onSimulate: (pid: string) => void
  onSimulateAll: () => void
  onRemind: () => void
  onDelete: () => void
}) {
  const { P, fmtDate } = useToolsData()
  const [openResp, setOpenResp] = useState<string | null>(null)
  const resp = campaign.respondents
  const done = resp.filter((r) => r.status === 'done')
  const pct = Math.round(done.length / resp.length * 100)
  const aggDone = done.filter((r): r is CampaignRespondent & { result: AssessmentResult } => r.result != null).map((r) => ({ pid: r.pid, result: r.result }))
  const agg = aggDone.length ? aggregate(a, aggDone) : null
  const bd = agg ? band(agg.composite) : null
  const recs = agg ? buildRecs(a, agg) : []
  const allComments: AssessmentComment[] = []
  done.forEach((r) => (r.result?.comments || []).forEach((c) => allComments.push({ ...c, pid: r.pid })))
  const ownerPerson = campaign.owner ? P[campaign.owner] : undefined

  return (
    <div>
      <div className="crumb" onClick={onExit}><Icon name="cleft" cls="sm" /> Assessments</div>
      <div className="phead" style={{ marginBottom: 16 }}>
        <div className="phead__t">
          <div className="row ac" style={{ gap: 10 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: a.ac }}>{a.name}</span><span className="badge badge--info">Team campaign</span></div>
          <div className="h1 sm" style={{ marginTop: 4 }}>{campaign.title}</div>
          <div className="row ac" style={{ gap: 9, marginTop: 8, color: 'var(--n-500)', fontSize: 13 }}>
            <Avatar id={campaign.owner} size="xs" /> Sent by {(ownerPerson?.name ?? '').split(' ')[0]} · {relTimeA(campaign.ts)} · due {fmtDate(campaign.due)}
          </div>
        </div>
        <div className="actions">
          {done.length < resp.length && <button className="btn sm" onClick={onSimulateAll}><Icon name="bolt" cls="sm" /> Collect remaining</button>}
          <button className="btn sm" onClick={onRemind}><Icon name="bell" cls="sm" /> Remind pending</button>
          <button className="btn sm" onClick={onDelete}><Icon name="x" cls="sm" /> Delete</button>
        </div>
      </div>

      {/* progress */}
      <div className="camp-card" style={{ '--ac': a.ac, marginBottom: 18 } as CSSProperties}>
        <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="eyebrow">Response rate</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--n-700)' }} className="tnum">{done.length} of {resp.length} · {pct}%</span>
        </div>
        <div className="camp-prog-track">
          <i style={{ width: pct + '%', background: '#2f7757' }} />
          <i style={{ width: Math.round(resp.filter((r) => r.status === 'started').length / resp.length * 100) + '%', background: '#5b8fc9' }} />
        </div>
        <div className="camp-stat-row">
          <span className="s"><span className="resp-status done" style={{ padding: '2px 8px' }}>Completed</span> <b>{done.length}</b></span>
          <span className="s"><span className="resp-status started" style={{ padding: '2px 8px' }}>In progress</span> <b>{resp.filter((r) => r.status === 'started').length}</b></span>
          <span className="s"><span className="resp-status sent" style={{ padding: '2px 8px' }}>Not started</span> <b>{resp.filter((r) => r.status === 'sent').length}</b></span>
        </div>
      </div>

      <div className="res-2">
        {/* respondents */}
        <div className="res-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ct" style={{ padding: '16px 18px 0' }}>Respondents</div>
          <div style={{ marginTop: 10 }}>
            {resp.map((r) => {
              const person = P[r.pid]; const sbd = r.result ? band(r.result.composite) : null
              const commentCount = r.result?.comments?.length ?? 0
              return (
                <div key={r.pid} className={'resp-row' + (r.result ? ' clickable' : '')} onClick={() => r.result && setOpenResp(r.pid)}>
                  <Avatar id={r.pid} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{person?.name ?? r.name ?? '—'}</div><div style={{ fontSize: 11.5, color: 'var(--n-500)' }}>{person?.role ?? ''}{r.result && commentCount ? ' · ' + commentCount + ' comment' + (commentCount > 1 ? 's' : '') : ''}</div></div>
                  <span className={'resp-status ' + r.status}>{r.status === 'done' ? 'Completed' : r.status === 'started' ? 'In progress' : 'Sent'}</span>
                  {r.result && sbd ? <span style={{ display: 'contents' }}><span className="resp-score" style={{ color: sbd.color }}>{r.result.composite}</span><Icon name="cright" cls="sm" style={{ color: 'var(--n-300)' }} /></span>
                    : <button className="btn btn--ghost sm" onClick={(e) => { e.stopPropagation(); onSimulate(r.pid) }}><Icon name="ok" cls="xs" /> Record</button>}
                </div>
              )
            })}
          </div>
        </div>

        {/* compiled group result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {agg && bd ? (
            <div style={{ display: 'contents' }}>
              <div className="res-card">
                <div className="ct">Compiled group result · {agg.n} of {resp.length}</div>
                <div className="row ac" style={{ gap: 18, flexWrap: 'wrap' }}>
                  <div className="res-score" style={{ width: 110, height: 110, borderColor: bd.color + '30', borderWidth: 7 }}>
                    <div className="big" style={{ fontSize: 36 }}>{agg.composite}</div><div className="of">group avg</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className="res-band" style={{ background: bd.color + '18', color: bd.color, display: 'inline-block' }}>{bd.label}</div>
                    <div style={{ marginTop: 10 }}><span className={'agreement-pill ' + agg.agreement.k}><Icon name="users" cls="xs" /> {agg.agreement.label}</span></div>
                    <div style={{ fontSize: 12.5, color: 'var(--n-600)', lineHeight: 1.5, marginTop: 10 }}>Average spread of <b>{agg.spread} pts</b> between the highest and lowest rater across dimensions. {agg.agreement.k === 'low' ? 'Where the team diverges is the conversation to have.' : 'The team is largely aligned on the picture.'}</div>
                  </div>
                </div>
              </div>
              <div className="res-card">
                <div className="ct">By dimension · group mean &amp; range</div>
                {agg.dims.map((d) => (
                  <div key={d.id} className="agg-row">
                    <div className="agg-head"><span className="agg-name"><span className="pdot" style={{ background: d.color || a.ac }} />{d.name}</span><span className="agg-val">{d.value}<span style={{ color: 'var(--n-400)', fontWeight: 500 }}> · {d.min}–{d.max}</span></span></div>
                    <div className="agg-track">
                      <div className="agg-range" style={{ left: d.min + '%', width: (d.max - d.min) + '%', background: d.color || a.ac }} />
                      <div className="agg-mean" style={{ left: d.value + '%', background: d.color || a.ac }} />
                    </div>
                  </div>
                ))}
                <div className="agg-legend"><span>▮ range (min–max across raters)</span><span>▏ group mean</span></div>
              </div>
              <div className="res-card">
                <div className="ct">Group recommendations</div>
                {recs.map((r, k) => (
                  <div key={k} className="rec-item"><span className="rec-num">{k + 1}</span><div><div className="rec-t">{r.t}</div><span className="rec-tag">{r.tag}</span></div></div>
                ))}
              </div>
              {allComments.length > 0 && (
                <div className="res-card">
                  <div className="ct">Comments from the team · {allComments.length}</div>
                  {allComments.map((c, k) => {
                    const cp = c.pid ? P[c.pid] : undefined
                    return (
                      <div key={k} className="cmt-item">
                        <Avatar id={c.pid} size="xs" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cmt-meta">{(cp?.name ?? '').split(' ')[0]} {c.dim && <span style={{ color: c.color }}>· {c.dim}</span>}</div>
                          <div className="cmt-text">“{c.text}”</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="res-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div className="halo" style={{ margin: '0 auto 12px' }}><Icon name="users" cls="lg" /></div>
              <div style={{ fontWeight: 700, color: 'var(--n-700)' }}>No responses yet</div>
              <div style={{ fontSize: 13, color: 'var(--n-500)', marginTop: 6 }}>The compiled group result appears once people complete it. Use “Collect remaining” to simulate responses.</div>
            </div>
          )}
        </div>
      </div>
      {openResp && (() => { const r = resp.find((x) => x.pid === openResp); return r && r.result ? <IndividualResponse a={a} pid={openResp} result={r.result} onClose={() => setOpenResp(null)} /> : null })()}
    </div>
  )
}

/* ---------- main ---------- */
type Viewing = { a: AssessmentDef; result: AssessmentResult; mode: RunMode }
export function AssessmentsView() {
  const { P, currentUserId, currentUserName } = useToolsData()
  const toast = useToolsToast()
  const { results, campaigns, complete, renameRun, deleteRun, launchCampaign, recordResp, deleteCampaign } = useStrategyAssessments()

  const [running, setRunning] = useState<string | null>(null) // assessment id
  const [viewing, setViewing] = useState<Viewing | null>(null) // { a, result, mode }
  const [history, setHistory] = useState<string | null>(null) // assessment id
  const [launching, setLaunching] = useState<string | null>(null) // assessment id
  const [campaignId, setCampaignId] = useState<string | null>(null) // open campaign

  const runsFor = (id: string): AssessmentRun[] => (results[id] || []).slice().sort((x, y) => new Date(y.ts).getTime() - new Date(x.ts).getTime())
  const campsFor = (id: string): AssessmentCampaign[] => campaigns.filter((c) => c.aid === id).slice().sort((x, y) => new Date(y.ts).getTime() - new Date(x.ts).getTime())

  async function handleLaunch(aid: string, pids: string[], due: string, msg: string) {
    const a = ASSESSMENTS[aid]
    const id = await launchCampaign(aid, a.name + ' · leadership round', currentUserId, currentUserName, msg, due, pids.map((pid) => ({ pid, name: P[pid]?.name ?? '' })))
    setLaunching(null)
    if (id) { setCampaignId(id); toast('Sent to ' + pids.length + ' people') }
  }
  async function simulateResp(cid: string, pid: string) {
    const c = campaigns.find((x) => x.id === cid)
    if (!c) return
    await recordResp(cid, pid, P[pid]?.name ?? '', synthRespResult(ASSESSMENTS[c.aid]))
    toast('Response recorded')
  }
  async function simulateAll(cid: string) {
    const c = campaigns.find((x) => x.id === cid)
    if (!c) return
    const a = ASSESSMENTS[c.aid]
    for (const r of c.respondents) {
      if (r.status !== 'done') await recordResp(cid, r.pid, P[r.pid]?.name ?? '', synthRespResult(a))
    }
    toast('Responses collected')
  }
  async function deleteCamp(cid: string) {
    await deleteCampaign(cid); setCampaignId(null); toast('Campaign deleted')
  }

  async function handleComplete(a: AssessmentDef, result: AssessmentResult, mode: RunMode) {
    await complete(a.id, a.name + ' · ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), mode, result.composite, result)
    toast('Result saved to history')
  }
  function handleRename(aid: string, rid: string, name: string) { void renameRun(aid, rid, name) }
  async function handleDeleteRun(aid: string, rid: string) { await deleteRun(aid, rid); toast('Result deleted') }

  if (campaignId) {
    const camp = campaigns.find((c) => c.id === campaignId)
    if (camp) return <CampaignView a={ASSESSMENTS[camp.aid]} campaign={camp} onExit={() => setCampaignId(null)}
      onSimulate={(pid) => { void simulateResp(camp.id, pid) }} onSimulateAll={() => { void simulateAll(camp.id) }}
      onRemind={() => toast('Reminder sent to pending respondents')} onDelete={() => { void deleteCamp(camp.id) }} />
  }
  if (viewing) {
    return <Results a={viewing.a} result={viewing.result} mode={viewing.mode} onExit={() => setViewing(null)} onRetake={() => { setViewing(null); setRunning(viewing.a.id) }} lastRuns={runsFor(viewing.a.id).map((r) => ({ ts: r.ts, composite: r.composite, id: r.id }))} />
  }
  if (running) {
    const a = ASSESSMENTS[running]
    return <Runner a={a} onExit={() => setRunning(null)}
      onComplete={(result, _answers, mode) => { void handleComplete(a, result, mode) }}
      lastRuns={runsFor(running).map((r) => ({ ts: r.ts, composite: r.composite, id: r.id }))} />
  }

  const totalRuns = Object.values(results).reduce((s, arr) => s + arr.length, 0)
  const card = (id: string) => <AssessmentCard key={id} a={ASSESSMENTS[id]} runs={runsFor(id)} campaigns={campsFor(id)} onStart={() => setRunning(id)} onSend={() => setLaunching(id)} />

  return (
    <div>
      <PageHead title="Assessments" sub="Interactive, value-driven diagnostics — score your strategy and leadership against named frameworks, send them to the whole team, and compile the group view."
        actions={totalRuns > 0 ? <span className="badge badge--neutral"><Icon name="clock" cls="xs" /> {totalRuns} saved result{totalRuns > 1 ? 's' : ''}</span> : null} />
      <HumanNote>A score informs a conversation; it doesn't replace judgement. Every weight here is published, the benchmark is shown, and divergence between raters is treated as the signal — not smoothed away.</HumanNote>

      {campaigns.length > 0 && (
        <div style={{ display: 'contents' }}>
          <div style={{ height: 22 }} />
          <div className="eyebrow" style={{ marginBottom: 12 }}>Team campaigns · {campaigns.length}</div>
          <div className="as-grid" style={{ marginBottom: 4 }}>
            {campaigns.slice().sort((x, y) => new Date(y.ts).getTime() - new Date(x.ts).getTime()).map((c) => {
              const a = ASSESSMENTS[c.aid]; const done = c.respondents.filter((r) => r.status === 'done')
              const pct = Math.round(done.length / c.respondents.length * 100)
              const aggDone = done.filter((r): r is CampaignRespondent & { result: AssessmentResult } => r.result != null).map((r) => ({ pid: r.pid, result: r.result }))
              const agg = aggDone.length ? aggregate(a, aggDone) : null; const bd = agg ? band(agg.composite) : null
              return (
                <div key={c.id} className="camp-card" style={{ '--ac': a.ac, cursor: 'pointer' } as CSSProperties} onClick={() => setCampaignId(c.id)}>
                  <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="dim-name" style={{ fontWeight: 700 }}><span className="as-ic" style={{ width: 26, height: 26, background: a.ac }}><Icon name={a.icon} cls="xs" /></span> {a.name}</span>
                    {agg && bd ? <span className="badge" style={{ background: bd.color + '18', color: bd.color }}>{agg.composite}/100</span> : <span className="badge badge--neutral">{pct}%</span>}
                  </div>
                  <div className="camp-prog-track"><i style={{ width: pct + '%', background: '#2f7757' }} /></div>
                  <div className="row ac" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--n-500)', fontWeight: 600 }}>{done.length} of {c.respondents.length} completed</span>
                    <div className="astack">{c.respondents.slice(0, 5).map((r) => <Avatar key={r.pid} id={r.pid} size="xs" />)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ height: 22 }} />
      {ASSESSMENT_GROUPS.map((g, gi) => (
        <div key={g.label} style={{ marginBottom: gi < ASSESSMENT_GROUPS.length - 1 ? 24 : 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{g.label}</div>
          <div className="as-grid">{g.ids.map(card)}</div>
        </div>
      ))}

      {totalRuns > 0 && (
        <div style={{ display: 'contents' }}>
          <div style={{ height: 26 }} />
          <div className="eyebrow" style={{ marginBottom: 12 }}>Saved results &amp; trends</div>
          <div className="as-grid">
            {ASSESSMENT_ORDER.filter((id) => runsFor(id).length).map((id) => {
              const a = ASSESSMENTS[id]; const runs = runsFor(id); const last = runs[0]; const bd = band(last.composite)
              return (
                <div key={id} className="res-card" style={{ cursor: 'pointer' }} onClick={() => setHistory(id)}>
                  <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className="dim-name" style={{ fontWeight: 700 }}><span className="as-ic" style={{ width: 26, height: 26, background: a.ac }}><Icon name={a.icon} cls="xs" /></span> {a.name}</span>
                    <span className="badge badge--neutral">{runs.length} run{runs.length > 1 ? 's' : ''}</span>
                  </div>
                  {runs.length > 1 ? <TrendLine runs={[...runs].reverse().map((r) => ({ composite: r.composite, ts: r.ts }))} color={a.ac} />
                    : <div style={{ fontSize: 13, color: 'var(--n-500)' }}>Latest: <b style={{ color: bd.color }}>{last.composite}/100</b> · {bd.label}</div>}
                  <div className="row ac" style={{ gap: 8, marginTop: 12 }}>
                    <button className="btn sm" onClick={(e) => { e.stopPropagation(); setViewing({ a, result: last.result, mode: last.mode }) }}><Icon name="search" cls="sm" /> Latest</button>
                    <button className="btn sm" onClick={(e) => { e.stopPropagation(); setHistory(id) }}><Icon name="clock" cls="sm" /> History</button>
                    <button className="btn btn--primary sm" onClick={(e) => { e.stopPropagation(); setRunning(id) }}><Icon name="repeat" cls="sm" /> Retake</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {history && <HistoryPanel a={ASSESSMENTS[history]} runs={runsFor(history)} onClose={() => setHistory(null)}
        onView={(r) => { const h = history; setHistory(null); setViewing({ a: ASSESSMENTS[h], result: r.result, mode: r.mode }) }}
        onRename={(rid, name) => handleRename(history, rid, name)} onDelete={(rid) => { void handleDeleteRun(history, rid) }} />}

      {launching && <CampaignLaunch a={ASSESSMENTS[launching]} onClose={() => setLaunching(null)}
        onLaunch={(pids, due, msg) => { void handleLaunch(launching, pids, due, msg) }} />}
    </div>
  )
}
