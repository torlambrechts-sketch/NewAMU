/* Strategy v2 — Cadence workspace (the cadence engine).
   Faithful 1:1 UI port of the design package's Cadence group (views_checkins /
   views_reviews / views_d's decision log): Check-ins & reminders, Reviews
   (Weekly auto-agenda · Business review · 1:1) and the Decision log. The
   design's window.SD globals + AppV2 `ctx` are replaced by DB-driven hooks
   (useStrategyCadence / useStrategyInitiatives / useStrategyFoundation /
   useStrategyOkr) and the shared people/date context (useToolsData) — no
   window globals, no localStorage. The active view is driven by `?view=`
   (checkins · reviews · history), mirroring ExecutionWorkspace; the in-app
   nav drives it, so there is no in-page top tab strip.

   Graceful degradation (the app doesn't load these signals yet):
   · per-measure value inputs in the composer + per-measure digest deltas →
     omitted (measures aren't loaded here);
   · Weekly "Blocked work" lane → empty (tasks not loaded);
   · Weekly "Breached guardrails" lane → empty (measures not loaded);
   · Effectiveness table → derived from the nudge list grouped by nudgeType;
   · Settings tab → local state with a toast('Saved') stub (the real
     nudge-prefs live in the separate Strategy settings page). */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Avatar,
  Bar,
  Card,
  Field,
  HealthBadge,
  HumanNote,
  Icon,
  KPI,
  PageHead,
  Seg,
  SideWindow,
  useToolsData,
} from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { ageLabel } from './strategyDerive'
import {
  useStrategyCadence,
  type CheckinStatus,
  type DecisionType,
  type StrategyCheckin,
  type StrategyNudge,
  type NudgeStatus,
} from '../../hooks/useStrategyCadence'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import { useStrategyFoundation } from '../../hooks/useStrategyFoundation'
import { useStrategyOkr } from '../../hooks/useStrategyOkr'
import type { StrategyInitiative, StrategyPillar } from '../../types/strategyTools'

/* CSS custom properties (`--ac`) are set via inline style throughout the
   design's markup; React.CSSProperties doesn't model them, so allow them. */
type CSSVars = React.CSSProperties & Record<string, string | number>

/* The design read window.SD.PL[pid].color; here we resolve pillar accent via a
   code→pillar map built from useStrategyFoundation. */
type PillarMap = Record<string, StrategyPillar>

const CHECKIN_WINDOW = 14 // days — a check-in is "due" if older than this (or never)

/** Days since an ISO timestamp (0 if missing/invalid). */
function daysSince(iso: string): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

/** Latest check-in for an initiative (by checkedAt desc), or null. */
function lastCheckinFor(checkins: StrategyCheckin[], iniId: string): StrategyCheckin | null {
  const mine = checkins.filter((c) => c.initiativeId === iniId)
  if (mine.length === 0) return null
  return mine.slice().sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0]
}

/** Due = no check-in yet, or the latest is older than the cadence window. */
function checkinDue(checkins: StrategyCheckin[], iniId: string): boolean {
  const lc = lastCheckinFor(checkins, iniId)
  if (!lc) return true
  return daysSince(lc.checkedAt) > CHECKIN_WINDOW
}

/** Staleness in days (very large when never checked in, so it sorts first). */
function staleDays(checkins: StrategyCheckin[], iniId: string): number {
  const lc = lastCheckinFor(checkins, iniId)
  return lc ? daysSince(lc.checkedAt) : 999
}

/* ───────────────────────── EmptyState (design's window.EmptyState) ───────────────────────── */

function EmptyState({ icon, title, sub }: { icon?: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="halo"><Icon name={icon || 'search'} cls="lg" /></div>
      <div style={{ fontWeight: 700, color: 'var(--n-700)', fontSize: 15 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, maxWidth: 360 }}>{sub}</div>}
    </div>
  )
}

/* ═══════════════════════════ CHECK-INS ═══════════════════════════ */

const NUDGE_ICON: Record<string, { ic: string; c: string }> = {
  STALE_GOAL: { ic: 'clock', c: '#b8862f' }, GOAL_BLOCKED: { ic: 'alert', c: '#b3382a' },
  PLAN_STALE: { ic: 'clock', c: '#b8862f' }, COMMITMENT_BROKEN: { ic: 'flag', c: '#a8553a' },
  SYNC_FAILURE: { ic: 'bolt', c: '#b3382a' }, STALE_VALUE: { ic: 'activity', c: '#b8862f' },
  GUARDRAIL: { ic: 'shield', c: '#b3382a' },
}
const STATUS_OPTS: Array<{ v: CheckinStatus; label: string }> = [
  { v: 'on', label: 'On track' }, { v: 'risk', label: 'At risk' }, { v: 'off', label: 'Off track' },
]
const CONF_LABEL = ['—', 'very low', 'low', 'medium', 'high', 'very high']

/* ---------------- COMPOSER (side window) ---------------- */
function CheckinComposer({ ini, lastCi, onClose, onSubmit }: {
  ini: StrategyInitiative
  lastCi: StrategyCheckin | null
  onClose: () => void
  onSubmit: (v: { status: CheckinStatus; conf: number; note: string }) => void
}) {
  const { P } = useToolsData()
  const [status, setStatus] = useState<CheckinStatus>(lastCi ? lastCi.status : ini.health)
  const [conf, setConf] = useState<number>(lastCi ? lastCi.confidence : 3)
  const [note, setNote] = useState('')
  const ownerName = P[ini.owner]?.name ?? ini.ownerName ?? '—'

  return (
    <SideWindow open onClose={onClose} eyebrow={`Check-in · ${ini.key}`} title={ini.title}
      footer={<div style={{ display: 'contents' }}>
        <button className="btn btn--primary" onClick={() => onSubmit({ status, conf, note })}><Icon name="ok" cls="sm" /> Submit check-in</button>
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
      </div>}>
      <div className="row ac" style={{ gap: 10, fontSize: 12.5, color: 'var(--n-500)' }}>
        <Avatar id={ini.owner} size="xs" /> {ownerName}
        <span style={{ color: 'var(--n-300)' }}>·</span>
        {lastCi ? <span>Last check-in {ageLabel(daysSince(lastCi.checkedAt))}</span> : <span>No previous check-in</span>}
      </div>

      <Field label="Status">
        <Seg<CheckinStatus> value={status} onChange={setStatus} options={STATUS_OPTS} />
        <div style={{ fontSize: 11.5, color: 'var(--n-400)', marginTop: 6, fontStyle: 'italic' }}>You can mark it worse than the score suggests, never better — honesty over optics.</div>
      </Field>

      <Field label={`Confidence — ${CONF_LABEL[conf]}`}>
        <input className="conf-slider" type="range" min="1" max="5" value={conf} onChange={(e) => setConf(+e.target.value)} />
        <div className="conf-scale"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
      </Field>

      {/* The design surfaced per-measure value inputs here; measures aren't
          loaded in this workspace yet, so that block is omitted. The status +
          confidence + note still flow to the tree via createCheckin. */}

      <Field label="Note" opt>
        <textarea className="ed-text" value={note} placeholder="What moved, what's blocked, what's next…" onChange={(e) => setNote(e.target.value)} />
      </Field>
      <HumanNote>A check-in is a note to your team, not a grade. The bands inform the conversation; you decide what it means.</HumanNote>
    </SideWindow>
  )
}

/* ---------------- MY CHECK-INS ---------------- */
function MyCheckinsTab({ initiatives, checkins, pillars, onCompose }: {
  initiatives: StrategyInitiative[]
  checkins: StrategyCheckin[]
  pillars: PillarMap
  onCompose: (i: StrategyInitiative) => void
}) {
  const { P } = useToolsData()
  const accent = (code: string) => pillars[code]?.color ?? 'var(--forest)'
  const due = initiatives.filter((i) => checkinDue(checkins, i.id))
    .map((i) => ({ i, stale: staleDays(checkins, i.id) }))
    .sort((a, b) => b.stale - a.stale)
  const recent = checkins.slice().sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)).slice(0, 4)
  const iniById = (id: string | null) => (id ? initiatives.find((x) => x.id === id) : undefined)

  return (
    <div className="ci-grid">
      <div>
        <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="eyebrow">Due now · {due.length}</div>
          <span style={{ fontSize: 12, color: 'var(--n-500)' }}>Ordered by staleness · weekly cadence</span>
        </div>
        {due.length === 0
          ? <EmptyState icon="check" title="All caught up" sub="No goals are past their check-in window." />
          : <div className="ci-queue">
              {due.map(({ i, stale }) => {
                const lc = lastCheckinFor(checkins, i.id)
                const ownerFirst = (P[i.owner]?.name ?? i.ownerName ?? '—').split(' ')[0]
                return (
                  <div key={i.id} className="ci-card" style={{ '--ac': accent(i.pillar) } as CSSVars}>
                    <div className="ci-main">
                      <div className="ci-t">{i.title}</div>
                      <div className="ci-meta">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="pdot" style={{ background: accent(i.pillar) }} />{i.key}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar id={i.owner} size="xs" />{ownerFirst}</span>
                        <span className="stale-badge"><Icon name="clock" cls="xs" /> {lc ? ageLabel(daysSince(lc.checkedAt)) : 'never'}</span>
                      </div>
                    </div>
                    <div className="ci-due">
                      <span className="ci-overdue">{stale > 90 ? 'Overdue' : stale - CHECKIN_WINDOW + ' days over'}</span>
                      <button className="btn btn--primary sm" onClick={() => onCompose(i)}><Icon name="check" cls="sm" /> Check in</button>
                    </div>
                  </div>
                )
              })}
            </div>}
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Recent check-ins</div>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {recent.length === 0
            ? <div style={{ padding: '13px 16px', fontSize: 13, color: 'var(--n-500)' }}>No check-ins yet.</div>
            : recent.map((c) => {
                const ini = iniById(c.initiativeId)
                const whoName = P[c.who]?.name ?? c.who ?? '—'
                return (
                  <div key={c.id} style={{ padding: '13px 16px', borderBottom: '1px solid var(--n-100)' }}>
                    <div className="row ac" style={{ gap: 9, marginBottom: 5 }}>
                      <HealthBadge h={c.status} />
                      <span style={{ fontSize: 12, color: 'var(--n-400)', marginLeft: 'auto' }}>{ageLabel(daysSince(c.checkedAt))}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{ini?.title ?? 'Initiative'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--n-600)', marginTop: 4, lineHeight: 1.5 }}>{c.note}</div>
                    <div className="row ac" style={{ gap: 7, marginTop: 8, fontSize: 11.5, color: 'var(--n-400)' }}>
                      <Avatar id={c.who} size="xs" /> {whoName} · confidence {c.confidence}/5
                    </div>
                  </div>
                )
              })}
        </Card>
      </div>
    </div>
  )
}

/* ---------------- NUDGE INBOX ---------------- */
function NudgeInboxTab({ nudges, updateNudge }: {
  nudges: StrategyNudge[]
  updateNudge: (id: string, status: NudgeStatus) => void
}) {
  const active = nudges.filter((n) => n.status === 'SENT' || n.status === 'SNOOZED')
  const resolved = nudges.filter((n) => n.status === 'ACTIONED' || n.status === 'DISMISSED')

  return (
    <div className="ci-grid">
      <div>
        <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="eyebrow">Inbox · {active.length}</div>
          <span style={{ fontSize: 12, color: 'var(--n-500)' }}>Cap 5/week · over cap, only critical sends</span>
        </div>
        <Card className="p5">
          <div className="nudge-list">
            {active.map((n) => {
              const meta = NUDGE_ICON[n.nudgeType] || { ic: 'alert', c: '#737373' }
              return (
                <div key={n.id} className="nudge">
                  <div className="nudge-ic" style={{ background: meta.c }}><Icon name={meta.ic} cls="sm" /></div>
                  <div className="nudge-body">
                    <div className="nudge-top">
                      <span className="nudge-t">{n.title}</span>
                      <span className={'nudge-pri ' + n.priority}>{n.priority}</span>
                      {n.status === 'SNOOZED' && <span className="badge badge--neutral">Snoozed</span>}
                    </div>
                    <div className="nudge-rationale">{n.rationale}</div>
                    <div className="nudge-foot">
                      <span className="nudge-act" onClick={() => updateNudge(n.id, 'ACTIONED')}><Icon name="cright" cls="xs" /> {n.subjectKind === 'initiative' ? 'Check in' : n.subjectKind === 'source' ? 'Fix source' : n.subjectKind === 'task' ? 'Open task' : 'View'}</span>
                      <span className="nudge-act muted" onClick={() => updateNudge(n.id, 'SNOOZED')}><Icon name="clock" cls="xs" /> Snooze</span>
                      <span className="nudge-act muted" onClick={() => updateNudge(n.id, 'DISMISSED')}><Icon name="x" cls="xs" /> Dismiss</span>
                      <span className="nudge-chan" style={{ marginLeft: 'auto' }}><Icon name={n.channel === 'EMAIL' ? 'mail' : 'bell'} cls="xs" /> {n.channel === 'EMAIL' ? 'Email · reply-in-place' : 'In-app'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {active.length === 0 && <div className="empty" style={{ padding: '30px 0' }}><div className="halo"><Icon name="check" cls="lg" /></div><div style={{ fontWeight: 700, color: 'var(--n-700)' }}>Inbox zero</div></div>}
          </div>
        </Card>

        {resolved.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Resolved</div>
            <Card className="p5">
              <div className="nudge-list">
                {resolved.map((n) => {
                  return (
                    <div key={n.id} className="nudge resolved">
                      <div className="nudge-ic" style={{ background: n.status === 'ACTIONED' ? '#2f7757' : 'var(--n-400)' }}><Icon name={n.status === 'ACTIONED' ? 'ok' : 'x'} cls="sm" /></div>
                      <div className="nudge-body">
                        <div className="nudge-top"><span className="nudge-t">{n.title}</span>
                          <span className="badge badge--neutral">{n.status === 'ACTIONED' ? 'Actioned' : 'Dismissed'}</span></div>
                        <div className="nudge-rationale">{n.rationale}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}
      </div>

      <div>
        <ReplyInPlaceCard />
        <div style={{ height: 18 }} />
        <DigestCard activeCount={active.length} />
      </div>
    </div>
  )
}

function ReplyInPlaceCard() {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Reply-in-place email</div>
      <div className="email-mock">
        <div className="email-head">
          <div className="email-row"><b>From</b> Klarert &lt;nudges@klarert.com&gt;</div>
          <div className="email-row"><b>Subject</b> Quick check-in: Margin &amp; cost program</div>
        </div>
        <div className="email-body">
          No update on this goal in 23 days and the cycle is 80% elapsed. Reply to this email to update it — no login needed.
          <div className="email-reply">
            <div className="lbl">Reply ↩</div>
            9 on track — vendor exits locked, automation next
          </div>
          <div className="email-parsed">
            <span className="parsed-chip"><Icon name="activity" cls="xs" /> Savings → 9 MNOK</span>
            <span className="parsed-chip"><Icon name="check" cls="xs" /> Status → On track</span>
            <span className="parsed-chip"><Icon name="pencil" cls="xs" /> Note saved</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--n-400)', marginTop: 12, fontStyle: 'italic' }}>One signed, single-goal token per email. AchieveIt saw reply-in-place lift update compliance from 20% to 90%.</div>
        </div>
      </div>
    </div>
  )
}

function DigestCard({ activeCount }: { activeCount: number }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Weekly digest</div>
      <div className="digest">
        <div className="digest-head"><div className="dh-t">Your week in strategy</div><div className="dh-s">Monday 08:00 · one email, not a drip</div></div>
        <div className="digest-sec">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--n-500)', marginBottom: 6 }}>Due this week</div>
          <div style={{ fontSize: 13, color: 'var(--n-700)' }}>{activeCount} nudge{activeCount === 1 ? '' : 's'} folded into this digest (under your weekly cap)</div>
        </div>
        {/* The design listed per-measure movement deltas here; measures aren't
            loaded in this workspace, so that section is omitted. */}
      </div>
    </div>
  )
}

/* ---------------- EFFECTIVENESS ---------------- */
type EffRow = { type: string; sent: number; actioned: number; dismissed: number; outcomeRate: number }

function EffectivenessTab({ nudges }: { nudges: StrategyNudge[] }) {
  // Derived from the nudge list (the design read a dedicated nudgeEffectiveness
  // telemetry table that isn't loaded here): group by nudgeType, count sent /
  // actioned / dismissed, and treat the action rate as the outcome rate.
  const byType: Record<string, EffRow> = {}
  for (const n of nudges) {
    const row = (byType[n.nudgeType] ||= { type: n.nudgeType, sent: 0, actioned: 0, dismissed: 0, outcomeRate: 0 })
    if (n.status !== 'PENDING') row.sent += 1
    if (n.status === 'ACTIONED') row.actioned += 1
    if (n.status === 'DISMISSED') row.dismissed += 1
  }
  const eff = Object.values(byType).map((r) => ({ ...r, outcomeRate: r.sent ? r.actioned / r.sent : 0 }))
    .sort((a, b) => b.outcomeRate - a.outcomeRate)
  const totalSent = eff.reduce((a, e) => a + e.sent, 0)
  const totalActioned = eff.reduce((a, e) => a + e.actioned, 0)
  const outcomeMet = totalSent ? Math.round(eff.reduce((a, e) => a + e.outcomeRate * e.sent, 0) / totalSent * 100) : 0

  return (
    <div>
      <HumanNote>This is product telemetry — whether a nudge <i>type</i> changes behaviour — never per-person response tracking. The system proposes muting low-outcome types; a person decides.</HumanNote>
      <div style={{ height: 16 }} />
      <div className="kgrid k3" style={{ marginBottom: 18 }}>
        <KPI icon="bell" label="Nudges sent" value={totalSent} sub="last 90 days" />
        <KPI icon="check" label="Action rate" value={(totalSent ? Math.round(totalActioned / totalSent * 100) : 0) + '%'} sub={`${totalActioned} actioned`} />
        <KPI icon="target" label="Outcome met" value={outcomeMet + '%'} sub="behaviour actually changed" />
      </div>
      <Card className="p5">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Outcome rate by nudge type</div>
        {eff.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--n-500)' }}>No nudges sent yet.</div>
          : eff.map((e) => (
              <div key={e.type} className="eff-row">
                <div className="eff-name">{e.type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  <div style={{ fontSize: 11, color: 'var(--n-400)', fontWeight: 500 }}>{e.sent} sent · {e.dismissed} dismissed</div></div>
                <div className="eff-track"><div className="eff-fill" style={{ width: e.outcomeRate * 100 + '%', background: e.outcomeRate >= 0.6 ? '#3f9d6c' : e.outcomeRate >= 0.45 ? '#d6a32a' : '#d24b3b' }} /></div>
                <div className="eff-pct">{Math.round(e.outcomeRate * 100)}%</div>
              </div>
            ))}
        <div className="humannote" style={{ marginTop: 16 }}><Icon name="shield" /><p>Low-converting nudge types fall below the muting threshold. Grounded suggestion: switch those to the weekly digest instead of real-time.</p></div>
      </Card>
    </div>
  )
}

/* ---------------- SETTINGS ---------------- */
function SettingsTab({ onSaved }: { onSaved: () => void }) {
  // Local state + a toast('Saved') stub. The canonical nudge-prefs live in the
  // separate Strategy settings page; this keeps the design's delivery-policy
  // markup without writing back from here.
  const [prefs, setPrefs] = useState({
    quietHours: true, quietFrom: '18:00', quietTo: '08:00', timezone: 'Europe/Oslo',
    capPerWeek: 5, channelsOn: ['IN_APP', 'EMAIL'] as string[],
  })
  const set = <K extends keyof typeof prefs>(k: K, v: (typeof prefs)[K]) => { setPrefs((p) => ({ ...p, [k]: v })); onSaved() }
  return (
    <div style={{ maxWidth: 640 }}>
      <Card className="p5">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Delivery policy</div>
        <div style={{ fontSize: 12.5, color: 'var(--n-500)', marginBottom: 10 }}>One attention budget, one cap, one quiet-hours policy across every nudge type.</div>
        <div className="setrow">
          <div><div className="sk">Quiet hours</div><div className="sd">No nudges {prefs.quietFrom}–{prefs.quietTo} · {prefs.timezone}</div></div>
          <div className={'toggle' + (prefs.quietHours ? ' on' : '')} onClick={() => set('quietHours', !prefs.quietHours)}><i /></div>
        </div>
        <div className="setrow">
          <div><div className="sk">Weekly priority cap</div><div className="sd">Beyond this, only critical nudges send; the rest fold into the digest</div></div>
          <div className="stepper">
            <button className="step-b" onClick={() => set('capPerWeek', Math.max(1, prefs.capPerWeek - 1))}>−</button>
            <span className="step-v">{prefs.capPerWeek}</span>
            <button className="step-b" onClick={() => set('capPerWeek', Math.min(15, prefs.capPerWeek + 1))}>+</button>
          </div>
        </div>
        <div className="setrow">
          <div><div className="sk">In-app</div><div className="sd">Nudge inbox + badge</div></div>
          <div className={'toggle' + (prefs.channelsOn.includes('IN_APP') ? ' on' : '')} onClick={() => set('channelsOn', prefs.channelsOn.includes('IN_APP') ? prefs.channelsOn.filter((c) => c !== 'IN_APP') : [...prefs.channelsOn, 'IN_APP'])}><i /></div>
        </div>
        <div className="setrow">
          <div><div className="sk">Email reply-in-place</div><div className="sd">Update a goal by replying to the reminder</div></div>
          <div className={'toggle' + (prefs.channelsOn.includes('EMAIL') ? ' on' : '')} onClick={() => set('channelsOn', prefs.channelsOn.includes('EMAIL') ? prefs.channelsOn.filter((c) => c !== 'EMAIL') : [...prefs.channelsOn, 'EMAIL'])}><i /></div>
        </div>
        <div className="setrow">
          <div><div className="sk">Slack / Teams</div><div className="sd">Deliver nudges where people work · connect in Data sources</div></div>
          <span className="badge badge--neutral">Slack connected</span>
        </div>
      </Card>
      <div style={{ height: 14 }} />
      <HumanNote>Adaptive cadence: goals whose measures are fully fed by live data and trending on track nag less often — reminders concentrate where human judgement is actually needed.</HumanNote>
    </div>
  )
}

/* ---------------- CHECK-INS VIEW ---------------- */
function CheckinsView({ cadence, initiatives, pillars }: {
  cadence: ReturnType<typeof useStrategyCadence>
  initiatives: StrategyInitiative[]
  pillars: PillarMap
}) {
  const toast = useToolsToast()
  const { currentUserName } = useToolsData()
  const [tab, setTab] = useState('queue')
  const [compose, setCompose] = useState<StrategyInitiative | null>(null)

  const dueCount = initiatives.filter((i) => checkinDue(cadence.checkins, i.id)).length
  const inboxCount = cadence.nudges.filter((n) => n.status === 'SENT' || n.status === 'SNOOZED').length
  const tabs = [
    { id: 'queue', label: `My check-ins · ${dueCount}`, icon: 'check' },
    { id: 'inbox', label: `Nudge inbox · ${inboxCount}`, icon: 'bell' },
    { id: 'eff', label: 'Effectiveness', icon: 'target' },
    { id: 'settings', label: 'Settings', icon: 'gear' },
  ]

  async function submit(v: { status: CheckinStatus; conf: number; note: string }) {
    if (compose) await cadence.createCheckin(compose.id, v.status, v.conf, v.note, currentUserName)
    setCompose(null)
    toast('Check-in submitted · ancestors updated')
  }

  return (
    <div>
      <PageHead title="Check-ins & reminders"
        sub="A weekly rhythm with self-explaining nudges. Update a goal in under a minute; the same value flows to the tree, the dashboard and the report."
        actions={<button className="btn btn--primary sm" onClick={() => { const i = initiatives.find((x) => checkinDue(cadence.checkins, x.id)); if (i) setCompose(i) }}><Icon name="check" cls="sm" /> Check in</button>} />
      <div className="subtabs ci-tabs">
        {tabs.map((t) => <div key={t.id} className={'subtab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}><Icon name={t.icon} cls="sm" />{t.label}</div>)}
      </div>
      {tab === 'queue' && <MyCheckinsTab initiatives={initiatives} checkins={cadence.checkins} pillars={pillars} onCompose={setCompose} />}
      {tab === 'inbox' && <NudgeInboxTab nudges={cadence.nudges} updateNudge={(id, status) => { void cadence.updateNudge(id, status) }} />}
      {tab === 'eff' && <EffectivenessTab nudges={cadence.nudges} />}
      {tab === 'settings' && <SettingsTab onSaved={() => toast('Saved')} />}

      {compose && (
        <CheckinComposer
          ini={compose}
          lastCi={lastCheckinFor(cadence.checkins, compose.id)}
          onClose={() => setCompose(null)}
          onSubmit={submit}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════ REVIEWS ═══════════════════════════ */

function sc10(x: number): string { return (x * 10).toFixed(1) }
function scoreColor(v10: number): string { return v10 >= 7 ? '#2f7757' : v10 >= 4 ? '#b8862f' : '#b3382a' }

/* ---------------- WEEKLY ---------------- */
type Lane = {
  id: string
  title: string
  icon: string
  c: string
  items: Array<{ key: string; title: string; ac: string; meta: string; badge?: string }>
}

function WeeklyTab({ cadence, initiatives, pillars }: {
  cadence: ReturnType<typeof useStrategyCadence>
  initiatives: StrategyInitiative[]
  pillars: PillarMap
}) {
  const { P } = useToolsData()
  const accent = (code: string) => pillars[code]?.color ?? 'var(--forest)'
  // Auto-composed lanes from live signals.
  const dueCheckins = initiatives.filter((i) => checkinDue(cadence.checkins, i.id)).map((i) => ({ i, stale: staleDays(cadence.checkins, i.id) }))
  const atRisk = initiatives.filter((i) => i.health === 'risk' || i.health === 'off')

  const lanes: Lane[] = [
    { id: 'risk', title: 'At-risk goals', icon: 'alert', c: '#b3382a',
      items: atRisk.map((i) => ({ key: i.key, title: i.title, ac: accent(i.pillar), meta: (P[i.owner]?.name ?? i.ownerName ?? '—').split(' ')[0], badge: i.health })) },
    { id: 'due', title: 'Check-ins due', icon: 'clock', c: '#b8862f',
      items: dueCheckins.map(({ i, stale }) => ({ key: i.key, title: i.title, ac: accent(i.pillar), meta: (stale > 90 ? 'never' : stale + 'd') + ' stale' })) },
    // Blocked work reads tasks, which aren't loaded here — render an empty lane.
    { id: 'blocked', title: 'Blocked work', icon: 'branch', c: '#a8553a', items: [] },
    // Breached guardrails read measures, which aren't loaded here — empty lane.
    { id: 'guard', title: 'Breached guardrails', icon: 'shield', c: '#b3382a', items: [] },
  ]
  const total = lanes.reduce((a, l) => a + l.items.length, 0)

  return (
    <div>
      <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <HumanNote>This agenda composed itself from live signals — nobody typed it. {total} items surfaced for the week; healthy goals stay off the agenda so the room spends time where judgement is needed.</HumanNote>
      </div>
      <div className="agenda-timer" style={{ marginBottom: 18 }}>
        <AgendaTimer />
      </div>
      <div className="wk-board">
        {lanes.map((l) => (
          <div key={l.id} className="wk-col">
            <div className="wk-col-h"><span className="ic" style={{ background: l.c }}><Icon name={l.icon} cls="sm" /></span><span className="t">{l.title}</span><span className="n">{l.items.length}</span></div>
            <div className="wk-body">
              {l.items.length === 0 ? <div style={{ fontSize: 12, color: 'var(--n-400)', textAlign: 'center', padding: '10px 0' }}>Nothing — all clear</div>
                : l.items.map((it, k) => (
                  <div key={k} className="wk-item" style={{ '--ac': it.ac } as CSSVars}>
                    <div className="wk-it">{it.title}</div>
                    <div className="wk-im">
                      <span style={{ fontWeight: 700, color: 'var(--n-400)' }}>{it.key}</span>
                      {it.badge ? <HealthBadge h={it.badge as StrategyInitiative['health']} /> : <span>{it.meta}</span>}
                      {it.badge && <span>· {it.meta}</span>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 18 }} />
      <DecisionsActions cadence={cadence} compact />
    </div>
  )
}

function AgendaTimer() {
  const [sec, setSec] = useState(0)
  const [run, setRun] = useState(false)
  useEffect(() => { if (!run) return; const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t) }, [run])
  const box = 30 * 60
  const pct = Math.min(100, sec / box * 100)
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return (
    <div style={{ display: 'contents' }}>
      <span className="timebox"><Icon name="clock" cls="xs" /> Timebox 30:00</span>
      <span style={{ fontFamily: 'var(--font-mono,monospace)', fontWeight: 700, fontSize: 15, color: pct > 90 ? 'var(--critical)' : 'var(--n-800)', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</span>
      <div className="bar" style={{ flex: 1 }}><i style={{ width: pct + '%', background: pct > 90 ? 'var(--critical)' : 'var(--forest)' }} /></div>
      <button className="btn sm" onClick={() => setRun((r) => !r)}><Icon name={run ? 'clock' : 'cright'} cls="sm" /> {run ? 'Pause' : 'Start'}</button>
      <button className="btn btn--ghost sm" onClick={() => { setSec(0); setRun(false) }}>Reset</button>
    </div>
  )
}

/* Shared decisions/actions capture — writes back to the strategy decision log.
   The design kept actions + decisions in local state; here both kinds persist
   via postDecision ('decision' → type:'decision', action → type:'update'). */
function DecisionsActions({ cadence, compact }: { cadence: ReturnType<typeof useStrategyCadence>; compact?: boolean }) {
  const toast = useToolsToast()
  const { P, currentUserName } = useToolsData()
  const [draft, setDraft] = useState('')
  const [kind, setKind] = useState<'decision' | 'action'>('decision')
  const recent = cadence.decisions.filter((d) => d.type === 'decision' || d.type === 'update').slice(0, 6)

  async function add() {
    const text = draft.trim()
    if (!text) return
    await cadence.postDecision({ type: kind === 'decision' ? 'decision' : 'update', title: text, detail: '', whoName: currentUserName })
    setDraft('')
    toast(kind === 'decision' ? 'Decision captured · linked to strategy' : 'Action captured · owner notified')
  }

  return (
    <Card className="p5">
      <div className="eyebrow" style={{ marginBottom: 12 }}>Decisions &amp; actions {compact && '· write back to the linked goal'}</div>
      <div className="capture-box" style={{ marginBottom: 14 }}>
        <Seg<'decision' | 'action'> value={kind} onChange={setKind} options={[{ v: 'decision', label: 'Decision' }, { v: 'action', label: 'Action' }]} />
        <input value={draft} placeholder={kind === 'decision' ? 'What did the room decide?' : 'Who does what by when?'} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }} />
        <button className="btn btn--primary sm" onClick={() => void add()}><Icon name="plus" cls="sm" /> Capture</button>
      </div>
      {recent.map((it) => {
        const isDecision = it.type === 'decision'
        const whoFirst = (P[it.who]?.name ?? it.who ?? '—').split(' ')[0]
        return (
          <div key={it.id} className="cap-item">
            <span className="cap-ic" style={{ background: isDecision ? '#1a3d32' : '#2f5d8a' }}><Icon name={isDecision ? 'flag' : 'check'} cls="xs" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, color: 'var(--n-900)', fontWeight: 500, lineHeight: 1.45 }}>{it.title}</div>
              <div className="row ac" style={{ gap: 8, marginTop: 6, fontSize: 11.5, color: 'var(--n-500)' }}>
                <span className="badge badge--neutral">{isDecision ? 'decision' : 'action'}</span>
                <Avatar id={it.who} size="xs" /> {whoFirst}
              </div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

/* ---------------- BUSINESS REVIEW (MBR/QBR) ---------------- */
function BusinessReviewTab({ cadence, initiatives, pillars }: {
  cadence: ReturnType<typeof useStrategyCadence>
  initiatives: StrategyInitiative[]
  pillars: PillarMap
}) {
  const { objectives } = useStrategyOkr()
  const pillarList = Object.values(pillars).sort((a, b) => a.position - b.position)

  // Pillar score = mean initiative score in the pillar (progress/100, health-penalised).
  const pillarScore = (code: string): number => {
    const inis = initiatives.filter((i) => i.pillar === code)
    if (inis.length === 0) return 0
    const sum = inis.reduce((a, i) => {
      const base = i.progress / 100
      const penalty = i.health === 'off' ? 0.25 : i.health === 'risk' ? 0.1 : 0
      return a + Math.max(0, base - penalty)
    }, 0)
    return sum / inis.length
  }
  const overall = pillarList.length ? pillarList.reduce((a, p) => a + pillarScore(p.code), 0) / pillarList.length : 0

  const exceptions: Array<{ t: string; k: string; why: string }> = []
  initiatives.filter((i) => i.health === 'risk' || i.health === 'off').forEach((i) => exceptions.push({ t: i.title, k: i.key, why: 'health ' + i.health }))
  // Guardrail exceptions read measures, which aren't loaded here — none added.

  const objStatus = (p: number) => (p >= 0.7 ? 'on' : p >= 0.4 ? 'risk' : 'off')

  return (
    <div>
      <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <HumanNote>Every number here is read live from the strategy spine — no slides re-keyed, no stale screenshots. The score informs; the room decides what to do about it.</HumanNote>
        <button className="btn sm"><Icon name="file" cls="sm" /> Generate board pack</button>
      </div>

      <div className="kgrid" style={{ marginBottom: 16 }}>
        <KPI icon="compass" label="Overall score" value={sc10(overall)} sub="weighted across pillars" tone="serif" />
        <KPI icon="check" label="On track" value={initiatives.filter((i) => i.health === 'on' || i.health === 'done').length + '/' + initiatives.length} sub="initiatives" />
        <KPI icon="alert" label="Exceptions" value={exceptions.length} tone={exceptions.length ? 'crit' : ''} sub="need a decision" />
        <KPI icon="cal" label="Objectives" value={objectives.length} sub="reading live" />
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Scorecard by pillar</div>
      <div className="mbr-score" style={{ marginBottom: 22 }}>
        {pillarList.map((p) => {
          const s = pillarScore(p.code)
          const s10 = +sc10(s)
          const objs = objectives.filter((o) => o.pillar === p.code)
          return (
            <div key={p.id} className="mbr-cell" style={{ '--ac': p.color } as CSSVars}>
              <div className="pn">{p.name}</div>
              <div className="sc" style={{ color: scoreColor(s10) }}>{sc10(s)}<span style={{ fontSize: 14, color: 'var(--n-400)' }}> /10</span></div>
              <div className="ov">{objs.length} objectives · {initiatives.filter((i) => i.pillar === p.code).length} initiatives</div>
              <div style={{ marginTop: 10 }}><Bar pct={s * 100} color={p.color} thin /></div>
            </div>
          )
        })}
      </div>

      <div className="row" style={{ gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Card className="p5 grow" style={{ minWidth: 320 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Objective walk · live</div>
          {objectives.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--n-500)' }}>No objectives yet.</div>
            : objectives.map((o) => {
                const s10 = +sc10(o.progress)
                const st = objStatus(o.progress)
                const pColor = pillars[o.pillar]?.color ?? 'var(--forest)'
                return (
                  <div key={o.id} className="row ac" style={{ gap: 12, padding: '10px 0', borderBottom: '1px solid var(--n-100)' }}>
                    <span className="pdot" style={{ background: pColor }} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--n-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.title}</div></div>
                    <span className={'spill ' + st}><span className="d" style={{ background: scoreColor(s10) }} />{sc10(o.progress)}</span>
                    <Avatar id={o.owner} size="xs" title={o.owner} />
                  </div>
                )
              })}
        </Card>
        <Card className="p5 grow" style={{ minWidth: 300 }}>
          <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--critical)' }}>Exception shelf · {exceptions.length}</div>
          {exceptions.length === 0 ? <div style={{ fontSize: 13, color: 'var(--n-500)' }}>No exceptions — everything is within tolerance.</div>
            : exceptions.map((e, k) => (
              <div key={k} className="row ac" style={{ gap: 11, padding: '11px 0', borderBottom: '1px solid var(--n-100)' }}>
                <span className="gap-ic" style={{ width: 30, height: 30 }}><Icon name="alert" cls="sm" /></span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--n-900)' }}>{e.t}</div><div style={{ fontSize: 11.5, color: 'var(--n-500)' }}>{e.why}</div></div>
                <span className="badge badge--neutral">{e.k}</span>
              </div>
            ))}
        </Card>
      </div>
      <div style={{ height: 18 }} />
      <DecisionsActions cadence={cadence} />
    </div>
  )
}

/* ---------------- 1:1 ---------------- */
const MOODS = ['😟', '😐', '🙂', '😀']

function OneOnOneTab({ cadence, initiatives }: {
  cadence: ReturnType<typeof useStrategyCadence>
  initiatives: StrategyInitiative[]
}) {
  const toast = useToolsToast()
  const { people, P, currentUserId, currentUserName } = useToolsData()
  const others = people.filter((p) => p.id !== currentUserId)
  const [withId, setWithId] = useState<string>(others[0]?.id ?? '')
  const [mood, setMood] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const person = withId ? P[withId] : undefined
  const personName = person?.name ?? '—'
  const personFirst = personName.split(' ')[0]
  const theirGoals = initiatives.filter((i) => i.owner === withId)
  const recent1on1 = cadence.reviews.filter((r) => r.reviewType === 'one_on_one').slice(0, 6)

  async function save() {
    if (!withId) return
    await cadence.createReview({
      reviewType: 'one_on_one',
      title: '1:1 · ' + personName,
      facilitatorName: currentUserName,
      subjectName: personName,
      mood,
      notes,
    })
    setMood(null); setNotes('')
    toast('1:1 logged · stays in this conversation')
  }

  return (
    <div>
      <div className="row ac" style={{ gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="eyebrow">1:1 with</span>
        <div className="seg">
          {others.map((p) => (
            <div key={p.id} className={'segopt' + (withId === p.id ? ' on' : '')} onClick={() => setWithId(p.id)}>{p.name.split(' ')[0]}</div>
          ))}
        </div>
      </div>
      <div className="oo-grid">
        <div>
          <Card className="p5">
            <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="eyebrow">Recent 1:1s · {personFirst}</div>
              <button className="btn sm" onClick={() => toast('Agenda drafted from open goals & check-ins')}><Icon name="sparkles" cls="sm" /> Draft agenda</button>
            </div>
            {recent1on1.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--n-500)', padding: '10px 0' }}>No 1:1s logged yet.</div>
              : recent1on1.map((r) => (
                  <div key={r.id} className="oo-topic">
                    <span className="oo-check" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{r.title}</div>
                      {r.mood !== null && <div style={{ fontSize: 11.5, color: 'var(--n-500)', marginTop: 3 }}>Mood {MOODS[r.mood] ?? '—'}</div>}
                    </div>
                  </div>
                ))}
          </Card>
          <div style={{ height: 16 }} />
          <Card className="p5">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Their goals · live</div>
            {theirGoals.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--n-500)' }}>No goals owned by {personFirst}.</div>
              : theirGoals.map((i) => (
                  <div key={i.id} className="row ac" style={{ gap: 11, padding: '9px 0', borderBottom: '1px solid var(--n-100)' }}>
                    <span className="pdot" style={{ background: 'var(--forest)' }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--n-900)' }}>{i.title}</span>
                    <HealthBadge h={i.health} />
                  </div>
                ))}
          </Card>
        </div>
        <div>
          <div className="confidential">
            <div className="lock"><Icon name="shield" cls="xs" /> Confidential · stays in this 1:1</div>
            <div style={{ fontSize: 13, color: 'var(--n-700)', marginTop: 8, lineHeight: 1.5 }}>How is {personFirst} feeling this week? This never leaves the conversation — no dashboard, no roll-up, no per-person score.</div>
            <div className="mood-row">
              {MOODS.map((e, k) => (
                <div key={k} className={'mood-btn' + (mood === k ? ' on' : '')} onClick={() => setMood(k)}>{e}</div>
              ))}
            </div>
            <textarea className="ed-text" style={{ marginTop: 12, minHeight: 80 }} placeholder="Private notes (only the two of you)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button className="btn btn--primary sm" disabled={!withId} onClick={() => void save()}><Icon name="ok" cls="sm" /> Log 1:1</button>
            </div>
          </div>
          <div style={{ height: 16 }} />
          <HumanNote>Wellbeing is a human matter, not a metric. Mood and private notes are confined to the two participants by design.</HumanNote>
        </div>
      </div>
    </div>
  )
}

/* ---------------- REVIEWS VIEW ---------------- */
function ReviewsView({ cadence, initiatives, pillars }: {
  cadence: ReturnType<typeof useStrategyCadence>
  initiatives: StrategyInitiative[]
  pillars: PillarMap
}) {
  const [tab, setTab] = useState('weekly')
  const tabs = [
    { id: 'weekly', label: 'Weekly', icon: 'cal' },
    { id: 'mbr', label: 'Business review', icon: 'bars' },
    { id: 'oneonone', label: '1:1', icon: 'msgsq' },
  ]
  return (
    <div>
      <PageHead title="Reviews"
        sub="The cadence that turns a plan into outcomes — a weekly operating rhythm, monthly business reviews, and 1:1s, all reading live strategy data."
        actions={<button className="btn sm"><Icon name="cal" cls="sm" /> Schedule cadence</button>} />
      <div className="subtabs">
        {tabs.map((t) => <div key={t.id} className={'subtab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}><Icon name={t.icon} cls="sm" />{t.label}</div>)}
      </div>
      {tab === 'weekly' && <WeeklyTab cadence={cadence} initiatives={initiatives} pillars={pillars} />}
      {tab === 'mbr' && <BusinessReviewTab cadence={cadence} initiatives={initiatives} pillars={pillars} />}
      {tab === 'oneonone' && <OneOnOneTab cadence={cadence} initiatives={initiatives} />}
    </div>
  )
}

/* ═══════════════════════════ DECISION LOG (HISTORY) ═══════════════════════════ */

const HTYPE: Record<DecisionType, { label: string; icon: string }> = {
  decision: { label: 'Decision', icon: 'flag' }, milestone: { label: 'Milestone', icon: 'award' },
  risk: { label: 'Risk', icon: 'alert' }, update: { label: 'Update', icon: 'activity' }, edit: { label: 'Edit', icon: 'pencil' },
}

function HistoryTimeline({ entries, initiatives, pillars, compact }: {
  entries: ReturnType<typeof useStrategyCadence>['decisions']
  initiatives: StrategyInitiative[]
  pillars: PillarMap
  compact?: boolean
}) {
  const { P, fmtDate } = useToolsData()
  const accent = (code: string) => pillars[code]?.color ?? 'var(--forest)'
  return (
    <div className="tline">
      {entries.map((h) => {
        const ini = h.initiativeId ? initiatives.find((x) => x.id === h.initiativeId) : null
        const whoName = P[h.who]?.name ?? h.who ?? '—'
        const whoRole = P[h.who]?.role
        return (
          <div key={h.id} className="tl-item">
            <div className="tl-date">{fmtDate(h.date)}</div>
            <div className="tl-main">
              <div className={'tl-dot ' + h.type}><i /></div>
              <div className="tl-card">
                <div className="row ac" style={{ gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className="badge badge--neutral"><Icon name={HTYPE[h.type].icon} cls="xs" />{HTYPE[h.type].label}</span>
                  {ini && !compact && <span className="chip"><span className="pdot" style={{ background: accent(ini.pillar) }} />{ini.key}</span>}
                </div>
                <div className="tlt">{h.title}</div>
                <div className="tld">{h.detail}</div>
                <div className="tlm"><Avatar id={h.who} size="xs" /> {whoName}{whoRole ? ` · ${whoRole}` : ''}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HistoryView({ cadence, initiatives, pillars }: {
  cadence: ReturnType<typeof useStrategyCadence>
  initiatives: StrategyInitiative[]
  pillars: PillarMap
}) {
  const toast = useToolsToast()
  const { currentUserName } = useToolsData()
  const [type, setType] = useState<'all' | DecisionType>('all')
  let entries = cadence.decisions.slice().sort((a, b) => b.date.localeCompare(a.date))
  if (type !== 'all') entries = entries.filter((h) => h.type === type)

  async function logDecision() {
    await cadence.postDecision({ type: 'decision', title: 'New decision', detail: 'Logged from the decision log.', whoName: currentUserName })
    toast('Decision logged')
  }

  return (
    <div>
      <div style={{ maxWidth: '100%' }}>
        <div className="phead" style={{ marginBottom: 18 }}>
          <div className="phead__t">
            <div className="h1">Decision log</div>
            <div className="sub">Every decision, milestone, risk and change to the 2026 plan — newest first. The audit trail behind the strategy.</div>
          </div>
          <div className="actions">
            <button className="btn btn--primary sm" onClick={() => void logDecision()}><Icon name="plus" cls="sm" /> Log a decision</button>
          </div>
        </div>
      </div>
      <div className="vbar" style={{ marginBottom: 20, width: 'fit-content' }}>
        {([['all', 'All'], ['decision', 'Decisions'], ['milestone', 'Milestones'], ['risk', 'Risks'], ['update', 'Updates'], ['edit', 'Edits']] as Array<['all' | DecisionType, string]>).map(([v, l]) => (
          <button key={v} className={'vbtn' + (type === v ? ' on' : '')} onClick={() => setType(v)}>{l}</button>
        ))}
      </div>
      {entries.length === 0
        ? <EmptyState icon="clock" title="No decision-log entries yet" sub="Decisions and actions captured in reviews appear here." />
        : <HistoryTimeline entries={entries} initiatives={initiatives} pillars={pillars} />}
    </div>
  )
}

/* ═══════════════════════════ WORKSPACE (container) ═══════════════════════════ */

type CadenceView = 'checkins' | 'reviews' | 'history'

export function StrategyCadenceWorkspace() {
  const [params] = useSearchParams()
  const view = (params.get('view') || 'checkins') as CadenceView
  const cadence = useStrategyCadence()
  const { initiatives, loading: iniLoading } = useStrategyInitiatives()
  const { pillars } = useStrategyFoundation()

  const pillarByCode: PillarMap = {}
  for (const p of pillars) pillarByCode[p.code] = p

  if (cadence.loading || iniLoading) {
    return (
      <div>
        <PageHead title="Cadence" sub="Laster kadens…" />
      </div>
    )
  }

  return (
    <div>
      {cadence.error && <HumanNote>{cadence.error}</HumanNote>}
      {view === 'checkins' && <CheckinsView cadence={cadence} initiatives={initiatives} pillars={pillarByCode} />}
      {view === 'reviews' && <ReviewsView cadence={cadence} initiatives={initiatives} pillars={pillarByCode} />}
      {view === 'history' && <HistoryView cadence={cadence} initiatives={initiatives} pillars={pillarByCode} />}
    </div>
  )
}
