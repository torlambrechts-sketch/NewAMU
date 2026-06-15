/* View: Settings — unified workspace hub. Modules, Members & roles, Branding,
   Frameworks, Custom fields, Templates, Notifications, Integrations,
   Import/export. Faithful 1:1 port of the design's Settings view; the design's
   window.SD globals are replaced by real persistence: useStrategyWorkspaceSettings
   (settings + nudge prefs, optimistic + debounced) and useToolsData (people).
   Roles, integrations sources, templates and import/export have no backing
   tables yet, so those sections stay local-only / stubbed (see inline notes). */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon, PageHead, HumanNote, Seg, Card, useToolsData } from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { useStrategyWorkspaceSettings } from '../../hooks/useStrategyWorkspaceSettings'
import type { CustomField, NudgePrefs } from '../../types/strategyTools'

/* ───────────────────────── static catalogues (design copy) ───────────────────────── */

type ModuleDef = { id: string; name: string; icon: string; on: boolean; locked?: boolean; desc: string }
const MODULES: ModuleDef[] = [
  { id: 'strategy', name: 'Strategy', icon: 'compass', on: true, locked: true, desc: 'Objectives, alignment, initiatives and the strategy spine.' },
  { id: 'reviews', name: 'Reviews', icon: 'cal', on: true, desc: 'Weekly cadence, business reviews and 1:1s reading live data.' },
  { id: 'checkins', name: 'Check-ins', icon: 'bell', on: true, desc: 'Weekly rhythm with self-explaining, capped nudges.' },
  { id: 'reports', name: 'Reporting', icon: 'file', on: true, desc: 'Board packs and exports from locked period snapshots.' },
  { id: 'frameworks', name: 'Frameworks', icon: 'clip', on: true, desc: 'SWOT, Porter, PESTEL and other analysis tools.' },
  { id: 'assess', name: 'Assessments', icon: 'target', on: false, desc: 'Trait bands and role-fit — object-centric, never ranking.' },
]
const ROLES = ['OWNER', 'ADMIN', 'LEAD', 'CONTRIBUTOR', 'VIEWER']

/* The design's active-framework segmented control. The persisted
   settings.activeFramework is a slug; map it to/from the display label. */
const FRAMEWORKS: Array<{ label: string; value: string }> = [
  { label: 'OKR', value: 'okr' },
  { label: 'Balanced Scorecard', value: 'balanced_scorecard' },
  { label: '4DX', value: '4dx' },
]

const ACCENTS = ['#1a3d32', '#2f5d8a', '#a8553a', '#6b21a8', '#b8862f']

type Sec = 'modules' | 'members' | 'branding' | 'frameworks' | 'fields' | 'templates' | 'notify' | 'integrations' | 'portability'
type NavGroup = { grp: string; items: Array<[Sec, string, string]> }
const NAV: NavGroup[] = [
  { grp: 'Workspace', items: [['modules', 'Modules', 'dash'], ['members', 'Members & roles', 'users'], ['branding', 'Branding', 'image']] },
  { grp: 'Strategy', items: [['frameworks', 'Frameworks', 'clip'], ['fields', 'Custom fields', 'grid'], ['templates', 'Templates', 'file']] },
  { grp: 'Connectivity', items: [['notify', 'Notifications', 'bell'], ['integrations', 'Integrations', 'bolt'], ['portability', 'Import / export', 'download']] },
]

/* A data source row, once the connectors table lands in a later wave. */
type DataSource = { id: string; name: string; kind: string; feeds?: number; status: 'connected' | 'error' | 'available' }

export function SettingsView() {
  const { settings, nudgePrefs, updateSettings, updateNudgePrefs } = useStrategyWorkspaceSettings()
  const toast = useToolsToast()
  const { people } = useToolsData()

  const [sec, setSec] = useState<Sec>('modules')
  const [roleMenu, setRoleMenu] = useState<string | null>(null)
  // local only — role persistence is a later wave (no strategy role table yet)
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({})

  // The data-sources table arrives in a later wave; render the design's empty state.
  const sources: DataSource[] = []

  const roleOf = (id: string): string => memberRoles[id] ?? 'CONTRIBUTOR'
  const moduleOn = (m: ModuleDef): boolean => settings.modulesEnabled[m.id] ?? m.on
  const setModule = (key: string, val: boolean): void =>
    updateSettings({ modulesEnabled: { ...settings.modulesEnabled, [key]: val } })

  const setCustomFields = (next: CustomField[]): void => updateSettings({ customFields: next })

  return (
    <div>
      <PageHead title="Settings" sub="One home for the workspace — modules, people, connections and configuration. Schema-validated so nothing here can break a view." />
      <div className="set-shell">
        <div className="set-nav">
          {NAV.map((g) => (
            <div key={g.grp}>
              <div className="set-navgrp">{g.grp}</div>
              {g.items.map(([id, label, icon]) => (
                <div key={id} className={'set-item' + (sec === id ? ' on' : '')} onClick={() => setSec(id)}><Icon name={icon} cls="sm" /> {label}</div>
              ))}
            </div>
          ))}
        </div>

        <div className="set-panel">
          {sec === 'modules' && (
            <div>
              <HumanNote>Six modules, off by default. Enable only what the team needs — each enables a focused mini-setup, so the product never overwhelms a new workspace.</HumanNote>
              <div style={{ height: 16 }} />
              <div className="module-grid">
                {MODULES.map((m) => {
                  const on = moduleOn(m)
                  return (
                    <div key={m.id} className="module-card" style={{ '--ac': 'var(--forest)' } as CSSProperties}>
                      <div className="row ac" style={{ justifyContent: 'space-between' }}>
                        <span className="mi"><Icon name={m.icon} /></span>
                        {m.locked ? <span className="badge badge--neutral">Core</span>
                          : <div className={'toggle' + (on ? ' on' : '')} onClick={() => { setModule(m.id, !on); toast(on ? m.name + ' disabled' : m.name + ' enabled') }}><i /></div>}
                      </div>
                      <div className="mn">{m.name}</div>
                      <div className="md">{m.desc}</div>
                      <span className={'badge badge--' + (on ? 'success' : 'neutral')}>{on ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {sec === 'members' && (
            <Card className="p5">
              <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="eyebrow">Members · {people.length}</div>
                <button className="btn btn--primary sm" onClick={() => toast('Invite sent')}><Icon name="plus" cls="sm" /> Invite</button>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--n-500)', marginBottom: 8 }}>Typed roles gate every action. Owners and admins manage shared config; leads own team goals; contributors check in; viewers read.</div>
              {people.map((m) => {
                const role = roleOf(m.id)
                return (
                  <div key={m.id} className="member-row">
                    <div className="avatar sm" title={m.name}>{m.initials}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{m.name}</div><div style={{ fontSize: 12, color: 'var(--n-500)' }}>{m.role ?? role}</div></div>
                    <div style={{ position: 'relative' }}>
                      <span className={'role-pill role-' + role} onClick={() => setRoleMenu(roleMenu === m.id ? null : m.id)}>{role} <Icon name="cdown" cls="xs" /></span>
                      {roleMenu === m.id && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', right: 0, zIndex: 20, background: '#fff', border: '1px solid var(--n-200)', borderRadius: 9, boxShadow: '0 10px 28px rgba(58,77,63,.14)', padding: 6, minWidth: 150 }}>
                          {ROLES.map((r) => (
                            <div key={r} onClick={() => { setMemberRoles((a) => ({ ...a, [m.id]: r })); setRoleMenu(null); toast('Roles are display-only for now') }}
                              style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: role === r ? 'var(--forest)' : 'var(--n-700)', background: role === r ? 'var(--forest-soft)' : 'transparent' }}>{r}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          {sec === 'branding' && (
            <Card className="p5">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Branding</div>
              <div className="brand-prev" style={{ marginBottom: 18 }}>
                <div className="brand-bar" style={{ background: settings.accentColor }}><span style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>P</span> Pundit Invest AS</div>
                <div style={{ padding: 16, background: '#fff' }}><div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--n-900)' }}>Board pack · Q2 2026</div><div style={{ fontSize: 12.5, color: 'var(--n-500)', marginTop: 4 }}>Your accent appears on reports, exports and the app chrome.</div></div>
              </div>
              <div className="setrow"><div><div className="sk">Accent colour</div><div className="sd">Used on report covers, exports and primary actions</div></div>
                <div className="swatch-row">{ACCENTS.map((c) => <div key={c} className={'swatch' + (settings.accentColor === c ? ' on' : '')} style={{ background: c }} onClick={() => updateSettings({ accentColor: c })} />)}</div>
              </div>
              <div className="setrow"><div><div className="sk">Workspace logo</div><div className="sd">Shown in the rail, login and report headers</div></div><button className="btn sm" onClick={() => toast('Logo upload arrives later')}><Icon name="image" cls="sm" /> Upload</button></div>
            </Card>
          )}

          {sec === 'frameworks' && (
            <Card className="p5">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Methodology</div>
              <div className="setrow"><div><div className="sk">Active framework</div><div className="sd">How goals render across the workspace</div></div>
                <Seg options={FRAMEWORKS.map((f) => ({ v: f.value, label: f.label }))} value={settings.activeFramework} onChange={(v) => updateSettings({ activeFramework: v })} />
              </div>
              <div className="setrow"><div><div className="sk">Per-framework validation</div><div className="sd">Advisory warnings, never hard blocks — guides, doesn't gate</div></div><div className={'toggle' + (settings.enforceFramework ? ' on' : '')} onClick={() => updateSettings({ enforceFramework: !settings.enforceFramework })}><i /></div></div>
              <div className="setrow"><div><div className="sk">Mixed-framework goals</div><div className="sd">Let a goal override the workspace framework, with a rationale</div></div><div className={'toggle' + (settings.allowMixed ? ' on' : '')} onClick={() => updateSettings({ allowMixed: !settings.allowMixed })}><i /></div></div>
              <div style={{ marginTop: 14 }}><button className="btn sm" onClick={() => toast('Open analysis frameworks arrives later')}><Icon name="clip" cls="sm" /> Open analysis frameworks</button></div>
            </Card>
          )}

          {sec === 'fields' && (
            <Card className="p5">
              <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="eyebrow">Custom fields</div>
                <button className="btn btn--primary sm" onClick={() => setCustomFields([...settings.customFields, { label: 'New field', type: 'Text', applies: 'Goal' }])}><Icon name="plus" cls="sm" /> Add field</button>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--n-500)', marginBottom: 12 }}>Declared-before-use and typed — every editor reads these, so a bad value can't reach a view.</div>
              {settings.customFields.map((a, i) => (
                <div key={i} className="attr-row">
                  <span className="attr-type">{a.type}</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{a.label}</div><div style={{ fontSize: 11.5, color: 'var(--n-500)' }}>on {a.applies}{a.options && a.options.length ? ' · ' + a.options.join(', ') : ''}</div></div>
                  <Icon name="x" cls="sm" style={{ color: 'var(--n-400)', cursor: 'pointer' }} />
                </div>
              ))}
            </Card>
          )}

          {sec === 'templates' && (
            <Card className="p5">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Templates</div>
              {([['Report · Board pack', 'builtin'], ['Report · Weekly digest', 'builtin'], ['Meeting · Weekly review', 'builtin'], ['Meeting · QBR', 'custom'], ['Role charter · Default', 'builtin']] as Array<[string, string]>).map(([t, kind], k) => (
                <div key={k} className="member-row">
                  <span className="mi" style={{ width: 32, height: 32, background: 'var(--forest-soft)', color: 'var(--forest)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="file" cls="sm" /></span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{t}</div></div>
                  <span className={'badge badge--' + (kind === 'custom' ? 'info' : 'neutral')}>{kind === 'custom' ? 'Custom' : 'Built-in'}</span>
                  <button className="btn sm" onClick={() => toast('Template editing arrives later')}>{kind === 'custom' ? 'Edit' : 'Duplicate'}</button>
                </div>
              ))}
            </Card>
          )}

          {sec === 'notify' && (
            <Card className="p5">
              <div className="eyebrow" style={{ marginBottom: 6 }}>Notification & nudge policy</div>
              <div style={{ fontSize: 12.5, color: 'var(--n-500)', marginBottom: 8 }}>One attention budget across every nudge type. Beyond the cap, only critical nudges send; the rest fold into the weekly digest.</div>
              <div className="setrow"><div><div className="sk">Quiet hours</div><div className="sd">No nudges {nudgePrefs.quietFrom}–{nudgePrefs.quietTo} · {nudgePrefs.timezone}</div></div><div className={'toggle' + (nudgePrefs.quietHours ? ' on' : '')} onClick={() => updateNudgePrefs({ quietHours: !nudgePrefs.quietHours })}><i /></div></div>
              <div className="setrow"><div><div className="sk">Weekly priority cap</div><div className="sd">Max real-time nudges per person per week</div></div>
                <div className="stepper"><button className="step-b" onClick={() => updateNudgePrefs({ capPerWeek: Math.max(1, nudgePrefs.capPerWeek - 1) })}>−</button><span className="step-v">{nudgePrefs.capPerWeek}</span><button className="step-b" onClick={() => updateNudgePrefs({ capPerWeek: Math.min(15, nudgePrefs.capPerWeek + 1) })}>+</button></div>
              </div>
              <div className="setrow"><div><div className="sk">Email reply-in-place</div><div className="sd">Update a goal by replying to the reminder — no login</div></div><div className={'toggle' + (nudgePrefs.channelsOn.includes('EMAIL') ? ' on' : '')} onClick={() => updateNudgePrefs({ channelsOn: toggleChannel(nudgePrefs, 'EMAIL') })}><i /></div></div>
              <div className="setrow"><div><div className="sk">Slack delivery</div><div className="sd">Deliver nudges to #strategy</div></div><div className={'toggle' + (nudgePrefs.channelsOn.includes('SLACK') ? ' on' : '')} onClick={() => updateNudgePrefs({ channelsOn: toggleChannel(nudgePrefs, 'SLACK') })}><i /></div></div>
              <div style={{ marginTop: 14 }}><button className="btn sm" onClick={() => toast('Nudge effectiveness arrives later')}><Icon name="target" cls="sm" /> Nudge effectiveness</button></div>
            </Card>
          )}

          {sec === 'integrations' && (
            <div>
              <HumanNote>Live feeds are what make a dashboard a single source of truth. Manage connectors here; a dead feed surfaces as a signal within one cycle, never a silently frozen value.</HumanNote>
              <div style={{ height: 14 }} />
              <div className="row ac" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="eyebrow">Connected sources</div>
                <button className="btn sm" onClick={() => toast('Data sources arrive later')}><Icon name="bolt" cls="sm" /> Open data sources</button>
              </div>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {sources.length === 0 ? (
                  <div className="member-row" style={{ padding: '20px 16px', color: 'var(--n-500)', fontSize: 13 }}>No connectors yet</div>
                ) : sources.map((s) => (
                  <div key={s.id} className="member-row" style={{ padding: '13px 16px', cursor: 'pointer' }} onClick={() => toast('Data sources arrive later')}>
                    <span className="mi" style={{ width: 34, height: 34, borderRadius: 8, background: s.status === 'error' ? '#f7e7e0' : 'var(--forest-soft)', color: s.status === 'error' ? '#a8553a' : 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bolt" cls="sm" /></span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)' }}>{s.name}</div><div style={{ fontSize: 12, color: 'var(--n-500)' }}>{s.kind}{s.feeds ? ` · feeds ${s.feeds} measures` : ''}</div></div>
                    <span className={'badge badge--' + (s.status === 'connected' ? 'success' : s.status === 'error' ? 'danger' : 'neutral')}>{s.status === 'connected' ? 'Live' : s.status === 'error' ? 'Error' : 'Available'}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {sec === 'portability' && (
            <Card className="p5">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Configuration portability</div>
              <div style={{ fontSize: 13, color: 'var(--n-600)', lineHeight: 1.6, marginBottom: 16 }}>Export this workspace's frameworks, templates and custom fields as a validated, versioned bundle — then import it into another workspace. Shared-config changes are role-gated and audited.</div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn--primary sm" onClick={() => toast('Config bundle exported')}><Icon name="download" cls="sm" /> Export config</button>
                <button className="btn sm" onClick={() => toast('Validating import…')}><Icon name="plus" cls="sm" /> Import config</button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/* Toggle a delivery channel on/off in the nudge prefs channel list. */
function toggleChannel(prefs: NudgePrefs, channel: string): string[] {
  return prefs.channelsOn.includes(channel)
    ? prefs.channelsOn.filter((c) => c !== channel)
    : [...prefs.channelsOn, channel]
}

export default SettingsView
