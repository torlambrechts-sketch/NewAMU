/* Strategy v2 — "My Work" role-scoped home. A faithful 1:1 port of the design
   package's MyWorkView (components_v2.jsx): the morning greeting, four stat
   tiles, and the four home cards (check-ins due · needs attention · today's
   nudges · the "get to a live strategy" activation checklist).

   The design's window.SD globals are replaced by real hooks: initiatives from
   useStrategyInitiatives, check-ins/nudges from useStrategyCadence, and the
   acting user from useToolsData. Check-in due/staleness is derived from the
   check-in rows (no SD.checkinDue/staleDays). ctx.setView/openDetail/openWizard
   become react-router navigation or a toast — there is no in-page detail route
   nor onboarding wizard yet, so those degrade gracefully (see header of each
   degraded spot). All CSS classNames + copy are kept verbatim. */

import { useNavigate } from 'react-router-dom'
import { Icon, useToolsData, HealthBadge } from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { ageLabel } from './strategyDerive'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import { useStrategyCadence } from '../../hooks/useStrategyCadence'
import type { StrategyCheckin } from '../../hooks/useStrategyCadence'

const CHECKIN_WINDOW = 14 // days — a check-in is "due" if older than this (or never)

/* Nudge type → icon + accent (the design's NF_ICON map). */
const NF_ICON: Record<string, { ic: string; c: string }> = {
  STALE_GOAL: { ic: 'clock', c: '#b8862f' },
  GOAL_BLOCKED: { ic: 'alert', c: '#b3382a' },
  COMMITMENT_BROKEN: { ic: 'flag', c: '#a8553a' },
  SYNC_FAILURE: { ic: 'bolt', c: '#b3382a' },
  STALE_VALUE: { ic: 'activity', c: '#b8862f' },
  GUARDRAIL: { ic: 'shield', c: '#b3382a' },
}

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

export function MyWorkView() {
  const navigate = useNavigate()
  const toast = useToolsToast()
  const { P, currentUserId, currentUserName } = useToolsData()
  const { initiatives } = useStrategyInitiatives()
  const { checkins, nudges } = useStrategyCadence()

  const me = currentUserId
  const due = initiatives
    .filter((i) => checkinDue(checkins, i.id))
    .map((i) => ({ i, stale: staleDays(checkins, i.id) }))
    .sort((a, b) => b.stale - a.stale)
  const myInis = initiatives.filter((i) => i.owner === me)
  const myNudges = nudges.filter((n) => n.status === 'SENT').sort((a, b) => b.importance - a.importance).slice(0, 3)
  const atRisk = initiatives.filter((i) => i.health === 'risk' || i.health === 'off')
  const avg = initiatives.length ? Math.round(initiatives.reduce((a, i) => a + i.progress, 0) / initiatives.length) : 0

  const actSteps = [
    { t: 'Confirm the four strategic pillars', done: true },
    { t: 'Set objectives & key results', done: true },
    { t: 'Connect a live data source', done: true },
    { t: 'Invite your leadership team', done: false },
    { t: 'Schedule the weekly review', done: false },
  ]
  const doneCount = actSteps.filter((s) => s.done).length

  // Navigation shims for the design's ctx.* calls (no in-page detail route nor
  // onboarding wizard yet — see file header).
  const openCheckins = () => navigate('/planlegging/kadens-strategi?view=checkins')
  const openInitiatives = () => navigate('/planlegging/initiativer?view=overview')

  return (
    <div>
      <div className="mw-hero">
        {/* Design showed SD.cycle.label + "% elapsed"; no cycle model here, so a neutral static eyebrow. */}
        <div className="fdn-ey" style={{ color: '#9ec3b1' }}><Icon name="sun" cls="sm" /> This week</div>
        <div className="mw-greet">Good morning, {currentUserName}.</div>
        <div className="mw-sub">{due.length} check-ins are due and {atRisk.length} initiatives need attention this week. Here's where your judgement is needed.</div>
        <div className="mw-statline">
          <div className="mw-stat"><div className="v">{avg}%</div><div className="l">Portfolio progress</div></div>
          <div className="mw-stat"><div className="v">{due.length}</div><div className="l">Check-ins due</div></div>
          <div className="mw-stat"><div className="v">{atRisk.length}</div><div className="l">Need attention</div></div>
          <div className="mw-stat"><div className="v">{myInis.length}</div><div className="l">In my remit</div></div>
        </div>
      </div>

      <div className="mw-grid">
        <div>
          <div className="mw-card">
            <div className="mw-ch"><Icon name="check" cls="sm" /><span className="t">Your check-ins due</span><span className="more" onClick={openCheckins}>Open all</span></div>
            {due.length === 0 ? <div style={{ padding: 18, fontSize: 13, color: 'var(--n-500)' }}>All caught up.</div>
              : due.slice(0, 4).map(({ i, stale }) => {
                const lc = lastCheckinFor(checkins, i.id)
                return (
                  <div key={i.id} className="mw-row" onClick={openCheckins}>
                    {/* Design used SD.PL[i.pillar].color; no pillar palette here, so a neutral dot. */}
                    <span className="pdot" style={{ background: 'var(--n-300)' }} />
                    <div style={{ flex: 1 }}><div className="mw-rt">{i.title}</div><div className="mw-rm">{i.key} · last update {ageLabel(lc ? daysSince(lc.checkedAt) : 99)}</div></div>
                    <span className="stale-badge"><Icon name="clock" cls="xs" /> {stale > 90 ? 'never' : stale + 'd'}</span>
                    <button className="btn btn--primary sm" onClick={(e) => { e.stopPropagation(); openCheckins() }}>Check in</button>
                  </div>
                )
              })}
          </div>

          <div className="mw-card">
            <div className="mw-ch"><Icon name="alert" cls="sm" /><span className="t">Needs your attention</span><span className="more" onClick={openInitiatives}>Health & risk</span></div>
            {atRisk.map((i) => (
              <div key={i.id} className="mw-row" onClick={openInitiatives}>
                <span className={'sdot ' + i.health} />
                <div style={{ flex: 1 }}><div className="mw-rt">{i.title}</div><div className="mw-rm">{i.key} · {P[i.owner]?.name ?? i.ownerName ?? '—'}</div></div>
                <HealthBadge h={i.health} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mw-card">
            <div className="mw-ch"><Icon name="bell" cls="sm" /><span className="t">Today's nudges</span><span className="more" onClick={openCheckins}>Inbox</span></div>
            {myNudges.map((n) => { const m = NF_ICON[n.nudgeType] || { ic: 'alert', c: '#737373' }; return (
              <div key={n.id} className="mw-row" onClick={openCheckins}>
                <span className="nf-ic" style={{ background: m.c, width: 28, height: 28 }}><Icon name={m.ic} cls="xs" /></span>
                <div style={{ flex: 1 }}><div className="mw-rt" style={{ fontSize: 13 }}>{n.title}</div><div className="mw-rm">{ageLabel(daysSince(n.createdAt))}</div></div>
              </div>
            ) })}
          </div>

          <div className="activate">
            <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="eyebrow">Get to a live strategy</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>{doneCount}/{actSteps.length}</span>
            </div>
            <div className="act-prog"><i style={{ width: doneCount / actSteps.length * 100 + '%' }} /></div>
            {actSteps.map((s, k) => (
              <div key={k} className="act-step" onClick={() => toast('Aktiveringsveiviseren kommer snart.')}>
                <span className={'act-check' + (s.done ? ' done' : '')}>{s.done && <Icon name="ok" cls="xs" />}</span>
                <span className={'act-t' + (s.done ? ' done' : '')}>{s.t}</span>
                {!s.done && <Icon name="cright" cls="xs" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MyWorkView
