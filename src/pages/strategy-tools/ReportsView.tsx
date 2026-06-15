/* Strategy v2 — Reports view (board-ready report built from live strategy data).
   Faithful 1:1 UI port of the design package's views_report.jsx (ReportsView +
   RepSpark, RepGroupedBars, ExportMenu). The design's window.SD globals are
   replaced by DB-driven hooks (useStrategyInitiatives / useStrategyFoundation /
   useToolsData), and the export menu's PDF item prints while the other formats
   toast a "later" stub — no window.* / localStorage / new DB writes. */

import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Icon,
  PageHead,
  useToolsData,
} from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { MONTHS } from './strategyDerive'
import { useStrategyInitiatives } from '../../hooks/useStrategyInitiatives'
import { useStrategyFoundation } from '../../hooks/useStrategyFoundation'
import type { InitiativeHealth, StrategyPillar } from '../../types/strategyTools'

/* ───────────────────────── charts (verbatim SVG maths) ───────────────────────── */

function RepSpark({ data, color = '#5b46d6', w = 230, h = 60 }: {
  data: number[]
  color?: string
  w?: number
  h?: number
}) {
  const max = Math.max(...data), min = Math.min(...data), rng = (max - min) || 1
  const pts = data.map((d, i) => [i / (data.length - 1) * w, h - ((d - min) / rng) * (h - 10) - 5])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" y1={h * g} x2={w} y2={h * g} stroke="#ece9e0" strokeDasharray="2 3" />)}
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.4" fill={color} />
    </svg>
  )
}

function RepGroupedBars({ pillars }: { pillars: StrategyPillar[] }) {
  // budget utilised by pillar over Q1..Q4 (grouped)
  const months = ['Q1', 'Q2', 'Q3', 'Q4']
  const series = pillars.map((p) => ({ name: p.name.split(' ')[0], c: p.color, vals: months.map((_, qi) => 30 + ((p.id.charCodeAt(0) + qi * 7) % 60)) }))
  const H = 200, max = 100
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: H, padding: '0 4px', borderBottom: '1px solid var(--n-200)' }}>
        {months.map((m, qi) => (
          <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%' }}>
              {series.map((s) => <div key={s.name} style={{ width: 13, height: s.vals[qi] / max * (H - 24), background: s.c, borderRadius: '3px 3px 0 0' }} title={s.name + ' ' + s.vals[qi] + '%'} />)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--n-500)' }}>{m}</div>
          </div>
        ))}
      </div>
      <div className="lchips" style={{ justifyContent: 'center', marginTop: 14 }}>
        {series.map((s) => <span key={s.name} className="lchip"><span className="d" style={{ background: s.c }} />{s.name}</span>)}
      </div>
    </div>
  )
}

/* ───────────────────────── export menu ───────────────────────── */

type ExportItem = { id: string; label: string; sub: string; c: string; icon: string }

function ExportMenu({ onExport }: { onExport: (it: ExportItem) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const items: ExportItem[] = [
    { id: 'pdf', label: 'PDF document', sub: 'Print-ready · works now', c: '#b3382a', icon: 'file' },
    { id: 'pptx', label: 'PowerPoint', sub: 'Slide deck', c: '#c2410c', icon: 'bars' },
    { id: 'docx', label: 'Word', sub: 'Editable document', c: '#2f5d8a', icon: 'clip' },
    { id: 'xlsx', label: 'Excel', sub: 'Data tables', c: '#2f7757', icon: 'grid' },
    { id: 'png', label: 'PNG image', sub: 'Full-page snapshot', c: '#6b21a8', icon: 'image' },
  ]
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn--primary sm" onClick={() => setOpen((o) => !o)}><Icon name="download" cls="sm" /> Export <Icon name="cdown" cls="xs" /></button>
      {open && (
        <div className="export-pop">
          {items.map((it) => (
            <div key={it.id} className="export-item" onClick={() => { setOpen(false); onExport(it) }}>
              <span className="ico" style={{ background: it.c }}><Icon name={it.icon} cls="sm" /></span>
              <div><div>{it.label}</div><div className="sub">{it.sub}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── view ───────────────────────── */

const HEALTH_REPORT_META: Record<InitiativeHealth, [string, string]> = {
  on: ['On track', '#3f9d6c'],
  risk: ['At risk', '#d6a32a'],
  off: ['Behind', '#d24b3b'],
  done: ['Complete', '#7a8a82'],
}

export function ReportsView() {
  const toast = useToolsToast()
  const { P, orgName } = useToolsData()
  const { initiatives, risks } = useStrategyInitiatives()
  const { pillars } = useStrategyFoundation()

  const company = orgName || 'Organisasjonen'
  const inis = initiatives
  const avg = inis.length ? Math.round(inis.reduce((a, i) => a + i.progress, 0) / inis.length) : 0
  const onTrack = inis.filter((i) => i.health === 'on' || i.health === 'done').length
  const atRisk = inis.filter((i) => i.health === 'risk').length
  const budget = inis.reduce((a, i) => a + i.budget, 0), spent = inis.reduce((a, i) => a + i.spent, 0)
  const statusRows = inis.slice().sort((a, b) => b.progress - a.progress)

  function doExport(it: ExportItem) {
    if (it.id === 'pdf') { toast('Opening print dialog…'); setTimeout(() => window.print(), 250) }
    else { toast(`${it.label} export arrives later`) }
  }

  return (
    <div>
      <PageHead title="Reports" sub="Board-ready reports built from live strategy data. Edit the narrative, then export to PDF, PowerPoint and more."
        actions={<div style={{ display: 'contents' }}>
          <button className="btn sm"><Icon name="cal" cls="sm" /> Schedule</button>
          <button className="btn sm"><Icon name="share" cls="sm" /> Share</button>
          <ExportMenu onExport={doExport} />
        </div>} />

      {/* editor toolbar (decorative chrome, matching a report editor) */}
      <div className="rep-toolbar">
        <div className="rep-tgrp">
          <button className="rep-tb" title="Text"><Icon name="type" cls="sm" /></button>
          <button className="rep-tb" title="Align"><Icon name="align" cls="sm" /></button>
          <button className="rep-tb" title="Table"><Icon name="grid" cls="sm" /></button>
          <button className="rep-tb" title="Widget"><Icon name="addwidget" cls="sm" /></button>
          <button className="rep-tb" title="Image"><Icon name="image" cls="sm" /></button>
          <button className="rep-tb" title="Columns"><Icon name="cols" cls="sm" /></button>
        </div>
        <div className="rep-div" />
        <div className="rep-tgrp">
          <button className="rep-tb" title="Undo"><Icon name="undo" cls="sm" /></button>
          <button className="rep-tb" title="Redo"><Icon name="redo" cls="sm" /></button>
        </div>
        <div className="rep-div" />
        <span className="rep-saved"><Icon name="ok" cls="xs" style={{ verticalAlign: '-2px', marginRight: 4, color: 'var(--ok)' }} /> Saved just now</span>
        <div style={{ flex: 1 }} />
        <span className="rep-saved">Q2 2026 · Board pack</span>
      </div>

      <div className="rep-page" id="report-page">
        {/* COVER */}
        <div className="rep-cover">
          <div className="rep-kicker">Strategy performance report</div>
          <div className="rep-h1">2026 Strategy — Q2 review</div>
          <div className="rep-sub">
            <span><Icon name="building" cls="xs" style={{ verticalAlign: '-2px', marginRight: 5 }} />{company}</span>
            <span><Icon name="user" cls="xs" style={{ verticalAlign: '-2px', marginRight: 5 }} />Prepared by Tor Lambrechts</span>
            <span><Icon name="cal" cls="xs" style={{ verticalAlign: '-2px', marginRight: 5 }} />11.06.2026</span>
          </div>
        </div>

        {/* EXEC SUMMARY */}
        <div className="rep-sec">
          <div className="rep-h2">Executive summary</div>
          <p className="rep-lead">The 2026 plan is broadly on course at the half-year mark. {onTrack} of {inis.length} initiatives are on or ahead of plan, with average completion at {avg}%. Two initiatives carry real risk — Wealth platform 2.0 and the margin & cost program — and are covered in the outlook below. Assets under management have grown to 10.6 BNOK, and onboarding time is down from 11 to 7 days.</p>
          <div className="rep-cards">
            <div className="rep-stat"><div className="l">AUM</div><div className="v">10.6<span style={{ fontSize: 14, color: 'var(--n-400)' }}> BNOK</span></div><div className="d" style={{ color: '#1f7a4d' }}>▲ 12.8% YTD</div></div>
            <div className="rep-stat"><div className="l">On track</div><div className="v">{onTrack}/{inis.length}</div><div className="d" style={{ color: atRisk ? '#9a6c12' : '#1f7a4d' }}>{atRisk} at risk</div></div>
            <div className="rep-stat"><div className="l">Avg progress</div><div className="v">{avg}%</div><div className="d" style={{ color: '#1f7a4d' }}>▲ 6 pts vs Q1</div></div>
            <div className="rep-stat"><div className="l">Budget spent</div><div className="v">{budget ? Math.round(spent / budget * 100) : 0}%</div><div className="d" style={{ color: 'var(--n-500)' }}>{(spent / 1000).toFixed(1)} of {(budget / 1000).toFixed(1)} M</div></div>
          </div>
        </div>

        {/* PORTFOLIO STATUS */}
        <div className="rep-sec">
          <div className="rep-h2">Portfolio status</div>
          <p className="rep-lead">Delivery status across every initiative, ordered by completion.</p>
          <table className="tbl" style={{ marginTop: 16 }}>
            <thead><tr><th>Initiative</th><th>Owner</th><th>Due</th><th>Status</th><th style={{ width: 220 }}>Progress</th></tr></thead>
            <tbody>
              {statusRows.map((i) => {
                const [hl, hc] = HEALTH_REPORT_META[i.health]
                const ownerFirst = (P[i.owner]?.name ?? i.ownerName ?? '—').split(' ')[0]
                return (
                  <tr key={i.id} style={{ cursor: 'default' }}>
                    <td><span className="tt">{i.title}</span> <span style={{ color: 'var(--n-400)', fontSize: 12 }}>{i.key}</span></td>
                    <td><div className="cellrow"><Avatar id={i.owner} size="xs" /><span style={{ fontSize: 12.5 }}>{ownerFirst}</span></div></td>
                    <td style={{ color: 'var(--n-500)', fontSize: 12.5 }}>{MONTHS[i.e]} 2026</td>
                    <td><span className="rag"><span className="dot" style={{ background: hc }} />{hl}</span></td>
                    <td>
                      <div className="statline">
                        <span className="mini-bar" style={{ width: 150, height: 8 }}><i style={{ width: i.progress + '%', background: hc }} /></span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--n-600)' }} className="tnum">{i.progress}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* RESOURCE PERFORMANCE */}
        <div className="rep-sec">
          <div className="rep-h2">Budget &amp; resource performance</div>
          <p className="rep-lead">Spend is tracking the plan across all four pillars. Process automation and the data-warehouse migration drove the largest early commitments; people and customer investments ramp through the second half.</p>
          <div className="rep-2">
            <div className="rep-chartcard">
              <div className="ct">Budget utilised by pillar · by quarter</div>
              <RepGroupedBars pillars={pillars} />
            </div>
            <div className="rep-sidecards">
              <div className="rep-sidecard">
                <div className="l">Committed spend</div>
                <div className="v">{(spent / 1000).toFixed(1)}M</div>
                <div className="rep-trend" style={{ color: '#1f7a4d' }}>▲ on plan · Q1–Q2</div>
                <div style={{ marginTop: 10 }}><RepSpark data={[8, 14, 20, 27, 34, 41]} color="#3f7d5a" w={220} h={54} /></div>
              </div>
              <div className="rep-sidecard">
                <div className="l">Cost-to-income</div>
                <div className="v">63%</div>
                <div className="rep-trend" style={{ color: '#1f7a4d' }}>▼ 4 pts · toward 58%</div>
                <div style={{ marginTop: 10 }}><RepSpark data={[67, 66, 65, 65, 64, 63]} color="#5b46d6" w={220} h={54} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* OUTLOOK */}
        <div className="rep-sec">
          <div className="rep-h2">Risk &amp; outlook</div>
          <p className="rep-lead">The board's attention is most warranted on two fronts. <b style={{ color: 'var(--n-800)' }}>Wealth platform 2.0</b> faces a likely Q3 slip on legacy account migration — a dual-write plan is in place. <b style={{ color: 'var(--n-800)' }}>Fee restructuring</b> is paused pending the April board decision, which gates the margin program. Compliance sign-off on automated KYC remains a watch item. With those managed, the plan holds for full-year delivery against all four pillars.</p>
          <div className="rep-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {risks.filter((r) => r.status === 'open').slice(0, 3).map((r) => {
              const ini = initiatives.find((x) => x.id === r.initiativeId)
              return (
                <div key={r.id} className="rep-stat" style={{ background: '#fff' }}>
                  <div className="l" style={{ color: '#9a6c12' }}>Open risk · {ini?.key ?? '—'}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n-900)', marginTop: 7, lineHeight: 1.35 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--n-500)', marginTop: 6 }}>{r.mitigation}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: 40, paddingTop: 18, borderTop: '1px solid var(--n-200)', fontSize: 11.5, color: 'var(--n-400)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{company} · Confidential — board distribution only</span>
          <span>Generated 11.06.2026 · Klarert Strategy</span>
        </div>
      </div>
    </div>
  )
}
