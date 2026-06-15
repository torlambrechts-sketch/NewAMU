/* Strategy v2 — Accountability read/edit view (ownership gap queue, "what I'm
   accountable for", role charters, and status-change history). Faithful 1:1 UI
   port of the design package's views_accountability.jsx. The design's window.SD
   globals + synthetic CHARTERS/STATUS_EVENTS are replaced by live hooks:
   useStrategyInitiatives (initiatives), useStrategyCadence (check-ins + the
   decision log), useStrategyOrgGraph (role charters, editable), and the people
   lookup from useToolsData — object-centric, never a people-ranking. */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Card, HealthBadge, HumanNote, Icon, KPI, PageHead, useToolsData } from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { ageLabel } from './strategyDerive'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import { useStrategyCadence, type StrategyCheckin } from '../../hooks/useStrategyCadence'
import { useStrategyOrgGraph } from '../../hooks/useStrategyOrgGraph'
import type { StrategyInitiative } from '../../types/strategyTools'

const CHECKIN_WINDOW = 14

/* Latest check-in age (in whole days) for an initiative; large when none exists. */
function staleDaysFor(checkins: StrategyCheckin[], iniId: string): number {
  let newest = 0
  for (const c of checkins) {
    if (c.initiativeId !== iniId) continue
    const t = new Date(c.checkedAt).getTime()
    if (!Number.isNaN(t) && t > newest) newest = t
  }
  if (newest === 0) return 9999 // never checked in — going quiet
  return Math.max(0, Math.floor((Date.now() - newest) / 86400000))
}

/* Defensive owner chip — the design used window.OwnerChip; Avatar resolves the
   name + initials from the people context, falling back to "unassigned". */
function OwnerChip({ id }: { id?: string }) {
  const { P } = useToolsData()
  if (!id) return <span style={{ fontSize: 11.5, color: 'var(--n-400)' }}>unassigned</span>
  const p = P[id]
  return (
    <div className="cellrow" style={{ gap: 7 }}>
      <Avatar id={id} size="xs" />
      <span style={{ fontSize: 12, color: 'var(--n-600)' }}>{(p?.name ?? id).split(' ')[0]}</span>
    </div>
  )
}

/* ---------------- GAP QUEUE ---------------- */
function GapTab() {
  const navigate = useNavigate()
  const toast = useToolsToast()
  const { initiatives } = useStrategyInitiatives()
  const { checkins } = useStrategyCadence()

  // ownership gaps: unowned/unaligned objects, at-risk going quiet, stuck work.
  const orphans = initiatives.filter((i) => !i.owner || !i.objectiveId)
  const staleRisk = initiatives.filter(
    (i) => (i.health === 'risk' || i.health === 'off') && staleDaysFor(checkins, i.id) > CHECKIN_WINDOW,
  )
  const blockedNoOwner: StrategyInitiative[] = [] // tasks not loaded here — render empty gracefully

  return (
    <div>
      <HumanNote>Gaps attach to <i>things</i>, never to people. This queue surfaces unowned objects, at-risk goals going quiet, and stuck work — so nothing falls through. There is no completion-rate leaderboard, by design.</HumanNote>
      <div className="kgrid k3" style={{ margin: '16px 0' }}>
        <KPI icon="alert" label="Unaligned objects" value={orphans.length} tone={orphans.length ? 'crit' : ''} sub="no owner or parent" />
        <KPI icon="clock" label="At-risk & going quiet" value={staleRisk.length} sub="no check-in past window" />
        <KPI icon="branch" label="Blocked work" value={blockedNoOwner.length} sub="needs a decision" />
      </div>

      <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--critical)' }}>Unowned / unaligned</div>
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        {orphans.length === 0 ? <div style={{ padding: 16, fontSize: 13, color: 'var(--n-500)' }}>None — every object has an owner and a parent.</div>
          : orphans.map((o) => (
            <div key={o.id} className="gap-card">
              <span className="gap-ic"><Icon name="alert" cls="sm" /></span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{o.title}</div><div style={{ fontSize: 12, color: 'var(--n-500)' }}>{!o.owner && !o.objectiveId ? 'no owner · no parent' : !o.owner ? 'no owner' : 'no parent'}</div></div>
              <OwnerChip id={o.owner} />
              <button className="btn btn--primary sm" onClick={() => toast('Aligned to a pillar · owner confirmed')}><Icon name="sitemap" cls="sm" /> Align</button>
            </div>
          ))}
      </Card>

      <div className="eyebrow" style={{ marginBottom: 10 }}>At-risk & going quiet</div>
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        {staleRisk.length === 0 ? <div style={{ padding: 16, fontSize: 13, color: 'var(--n-500)' }}>None — every at-risk goal has a recent check-in.</div>
          : staleRisk.map((i) => (
            <div key={i.id} className="gap-card">
              <HealthBadge h={i.health} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{i.title}</div><div style={{ fontSize: 12, color: 'var(--n-500)' }}>{i.key} · last update {ageLabel(staleDaysFor(checkins, i.id))}</div></div>
              <OwnerChip id={i.owner} />
              <button className="btn sm" onClick={() => navigate('/planlegging/kadens-strategi?view=checkins')}><Icon name="check" cls="sm" /> Nudge</button>
            </div>
          ))}
      </Card>
    </div>
  )
}

/* ---------------- MINE ---------------- */
function MineTab({ onCharter }: { onCharter: () => void }) {
  const navigate = useNavigate()
  const { P, currentUserId, currentUserName } = useToolsData()
  const { initiatives } = useStrategyInitiatives()
  const { checkins } = useStrategyCadence()
  const me = currentUserId
  const owned = initiatives.filter((i) => i.owner === me)
  const onTeam = initiatives.filter((i) => (i.team || []).includes(me) && i.owner !== me)
  const meName = (me && P[me]?.name) || currentUserName || 'You'
  const ownerName = (i: StrategyInitiative) => (i.owner && P[i.owner]?.name) || i.ownerName || '—'
  return (
    <div>
      <div className="row ac" style={{ gap: 11, marginBottom: 16 }}>
        <Avatar id={me} size="md" />
        <div><div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--n-900)' }}>{meName}</div><div style={{ fontSize: 12.5, color: 'var(--n-500)' }}>accountable for {owned.length} initiatives</div></div>
        <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={onCharter}><Icon name="clip" cls="sm" /> My charter</button>
      </div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Accountable for · {owned.length}</div>
      {owned.length === 0 ? (
        <Card style={{ padding: 16, fontSize: 13, color: 'var(--n-500)', marginBottom: 18 }}>Nothing is assigned to you yet — pick up an unaligned object from the gap queue.</Card>
      ) : (
        <table className="tbl" style={{ marginBottom: 18 }}>
          <thead><tr><th>Initiative</th><th>Pillar</th><th>Status</th><th style={{ width: 150 }}>Progress</th><th>Last check-in</th></tr></thead>
          <tbody>
            {owned.map((i) => {
              const sd = staleDaysFor(checkins, i.id)
              return (
                <tr key={i.id} onClick={() => navigate('/planlegging/initiativer?view=overview')}>
                  <td><span className="tt">{i.title}</span> <span style={{ color: 'var(--n-400)', fontSize: 12 }}>{i.key}</span></td>
                  <td>{i.pillar ? <span className="badge badge--neutral">{i.pillar}</span> : <span style={{ color: 'var(--n-300)' }}>·</span>}</td>
                  <td><HealthBadge h={i.health} /></td>
                  <td><div className="statline"><span className="mini-bar"><i style={{ width: i.progress + '%', background: 'var(--forest)' }} /></span><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--n-600)' }} className="tnum">{i.progress}%</span></div></td>
                  <td><span className="stale-badge" style={{ background: sd > 14 ? '#f7e7e0' : 'var(--n-100)', color: sd > 14 ? '#a8553a' : 'var(--n-500)' }}><Icon name="clock" cls="xs" /> {ageLabel(sd)}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="eyebrow" style={{ marginBottom: 10 }}>On the team · {onTeam.length}</div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {onTeam.length === 0 ? <div style={{ padding: 16, fontSize: 13, color: 'var(--n-500)' }}>You are not on another owner's team right now.</div>
          : onTeam.map((i) => (
            <div key={i.id} className="member-row" style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => navigate('/planlegging/initiativer?view=overview')}>
              <span className="pdot" style={{ background: 'var(--forest)' }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{i.title}</div><div style={{ fontSize: 12, color: 'var(--n-500)' }}>led by {ownerName(i)}</div></div>
              <HealthBadge h={i.health} />
            </div>
          ))}
      </Card>
    </div>
  )
}

/* ---------------- CHARTERS ---------------- */
function ChartersTab() {
  const { charters, updateCharter } = useStrategyOrgGraph()
  const [sel, setSel] = useState<string>('')
  const selId = sel || charters[0]?.id || ''
  const c = charters.find((x) => x.id === selId)

  function setListItem(field: 'responsibilities' | 'priorities', idx: number, value: string) {
    if (!c) return
    const next = [...c[field]]
    next[idx] = value
    void updateCharter(c.id, { [field]: next })
  }

  return (
    <div className="set-shell">
      <div className="set-nav">
        <div className="set-navgrp">Leadership team</div>
        {charters.length === 0 && <div style={{ padding: 11, fontSize: 12.5, color: 'var(--n-500)' }}>No charters yet.</div>}
        {charters.map((p) => (
          <div key={p.id} className={'set-item' + (selId === p.id ? ' on' : '')} onClick={() => setSel(p.id)}>
            <Avatar id={p.person} size="xs" /> {(p.person || '—').split(' ')[0]}
          </div>
        ))}
      </div>
      <div className="set-panel">
        {!c ? (
          <Card style={{ padding: 18, fontSize: 13, color: 'var(--n-500)' }}>Select a charter to see what the role owns, decides and is driving now.</Card>
        ) : (
          <div className="charter">
            <div className="charter-head">
              <div className="row ac" style={{ gap: 12 }}>
                <Avatar id={c.person} size="md" />
                <div><div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 20, color: 'var(--n-900)' }}>{c.person || '—'}</div><div style={{ fontSize: 13, color: 'var(--n-500)' }}>Role charter</div></div>
                <span className="badge badge--neutral" style={{ marginLeft: 'auto' }}>v{c.version} · current</span>
              </div>
              <textarea
                value={c.purpose}
                onChange={(e) => void updateCharter(c.id, { purpose: e.target.value })}
                rows={2}
                style={{ width: '100%', fontSize: 14.5, color: 'var(--n-700)', marginTop: 14, lineHeight: 1.6, fontStyle: 'italic', border: '1px solid var(--n-100)', borderRadius: 8, background: 'transparent', resize: 'vertical', fontFamily: 'inherit', padding: 8 }}
              />
            </div>
            <div className="charter-sec"><div className="lbl">Responsibilities</div>{c.responsibilities.map((r, k) => <div key={k} className="charter-li"><input value={r} onChange={(e) => setListItem('responsibilities', k, e.target.value)} style={{ flex: 1, fontSize: 13.5, color: 'var(--n-700)', border: '1px solid transparent', background: 'transparent', fontFamily: 'inherit' }} /></div>)}</div>
            <div className="charter-sec"><div className="lbl">Decision rights</div><div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{c.decisions.map((d, k) => <span key={k} className="badge badge--info">{d}</span>)}</div></div>
            <div className="charter-sec"><div className="lbl">Key stakeholders</div><div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{c.stakeholders.map((s, k) => <span key={k} className="badge badge--neutral">{s}</span>)}</div></div>
            <div className="charter-sec"><div className="lbl">Priorities · next 90 days</div>{c.priorities.map((p, k) => <div key={k} className="charter-li"><input value={p} onChange={(e) => setListItem('priorities', k, e.target.value)} style={{ flex: 1, fontSize: 13.5, color: 'var(--n-700)', border: '1px solid transparent', background: 'transparent', fontFamily: 'inherit' }} /></div>)}</div>
          </div>
        )}
        <div style={{ height: 14 }} />
        <HumanNote>A charter makes accountability explicit — what this role owns, what it decides, and what it's driving now. Goals are checked against it for coherence.</HumanNote>
      </div>
    </div>
  )
}

/* ---------------- STATUS HISTORY ---------------- */
function HistoryTab() {
  const { fmtDate } = useToolsData()
  const { decisions } = useStrategyCadence()
  const { initiatives } = useStrategyInitiatives()
  const dotC: Record<string, string> = { decision: '#2f7757', milestone: '#2f5d8a', risk: '#b3382a', update: '#b8862f', edit: '#737373' }
  const iniById = (id: string | null) => (id ? initiatives.find((x) => x.id === id) : undefined)
  return (
    <div>
      <HumanNote>Every status change is logged with who, when and why — no silent moves. Owners can mark a goal worse than its score suggests, never quietly better.</HumanNote>
      <div style={{ height: 16 }} />
      <div className="status-hist">
        {decisions.length === 0 && <div style={{ fontSize: 13, color: 'var(--n-500)' }}>No status changes logged yet.</div>}
        {decisions.map((e) => {
          const ini = iniById(e.initiativeId)
          return (
            <div key={e.id} className="sh-item">
              <div className="sh-date">{fmtDate(e.date)}</div>
              <div className="sh-main">
                <div className="sh-dot" style={{ background: dotC[e.type] || 'var(--n-400)' }} />
                <div className="row ac" style={{ gap: 9, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{ini ? ini.title : e.title}</span>
                  {ini && <span className="badge badge--neutral">{ini.key}</span>}
                </div>
                <div className="row ac" style={{ gap: 8, fontSize: 12.5, color: 'var(--n-600)' }}>
                  <span className="badge badge--neutral">{e.type}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--n-600)', marginTop: 7, lineHeight: 1.5 }}>{e.detail || e.title}</div>
                <div className="row ac" style={{ gap: 7, marginTop: 7, fontSize: 11.5, color: 'var(--n-400)' }}><Avatar id={e.who} size="xs" /> {e.who || '—'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- MAIN ---------------- */
type AccTab = 'gaps' | 'mine' | 'acc-charter' | 'history'

export function AccountabilityView() {
  const [tab, setTab] = useState<AccTab>('gaps')
  const { initiatives } = useStrategyInitiatives()
  const orphans = initiatives.filter((i) => !i.owner || !i.objectiveId).length
  const tabs: Array<{ id: AccTab; label: string; icon: string }> = [
    { id: 'gaps', label: `Gap queue · ${orphans}`, icon: 'alert' },
    { id: 'mine', label: "What I'm accountable for", icon: 'user' },
    { id: 'acc-charter', label: 'Charters', icon: 'clip' },
    { id: 'history', label: 'Status history', icon: 'clock' },
  ]
  return (
    <div>
      <PageHead title="Accountability"
        sub="One visible owner on every object, gaps surfaced as a queue, and role charters that make decision rights explicit." />
      <div className="subtabs">
        {tabs.map((t) => <div key={t.id} className={'subtab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}><Icon name={t.icon} cls="sm" />{t.label}</div>)}
      </div>
      {tab === 'gaps' && <GapTab />}
      {tab === 'mine' && <MineTab onCharter={() => setTab('acc-charter')} />}
      {tab === 'acc-charter' && <ChartersTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}
