/* Strategy v2 — Data sources read-view (live feeds → single source of truth).
   Faithful 1:1 UI port of the design package's views_sources.jsx DataSourcesView.
   Connectors with sync status, freshness and failure signals, plus which measures
   each feeds. The design's window.SD globals are replaced by useStrategyMeasures()
   (real strategy_data_sources + strategy_measures) and the shared toast channel
   (useToolsToast); the per-source logo maps collapse onto the canonical sourceMeta
   keyed by source_code. Pure read-view — reconnect/connect route through the hook. */

import { Icon, PageHead, HumanNote } from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import { ageLabel } from './strategyDerive'
import { useStrategyMeasures } from '../../hooks/useStrategyMeasures'
import type { DataSource, StrategyMeasure } from '../../hooks/useStrategyMeasures'

/* Canonical connector metadata (ported from the design's SD.sourceMeta in
   data2.js) — icon + colour per source_code. Replaces the view's inline
   logoColor/logoIcon maps, which were keyed by kind. */
const sourceMeta: Record<string, { label: string; icon: string; color: string }> = {
  MANUAL: { label: 'Manual', icon: 'pencil', color: '#737373' },
  SHEETS: { label: 'Sheets', icon: 'grid', color: '#2f7757' },
  WEBHOOK: { label: 'Webhook', icon: 'bolt', color: '#b8862f' },
  JIRA: { label: 'Jira', icon: 'branch', color: '#2f5d8a' },
  SALESFORCE: { label: 'Salesforce', icon: 'cloud', color: '#2f5d8a' },
  HUBSPOT: { label: 'HubSpot', icon: 'bolt', color: '#a8553a' },
  BIGQUERY: { label: 'BigQuery', icon: 'stack', color: '#b8862f' },
}
const fallbackMeta = sourceMeta.MANUAL

/** Minutes since an ISO timestamp (null when missing/invalid). */
function minutesSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 60000))
}

/** Days since an ISO date (very large when missing, so it reads as most stale). */
function daysSince(iso: string | null): number {
  if (!iso) return 9999
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 9999
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

/** Freshness label for a measure from its latest reading date. */
function measureAge(m: StrategyMeasure): string {
  if (m.readings.length === 0) return 'never'
  const latest = m.readings[m.readings.length - 1].date
  return ageLabel(daysSince(latest))
}

export function DataSourcesView() {
  const toast = useToolsToast()
  const { sources, measures, reconnectSource } = useStrategyMeasures()

  const errored = sources.filter((s) => s.status === 'error' || s.missedRuns > 0)
  const connected = sources.filter((s) => s.status === 'connected')
  const available = sources.filter((s) => s.status === 'available')

  const metaFor = (s: DataSource) => sourceMeta[s.sourceCode] || fallbackMeta
  const measuresFor = (srcId: string) => measures.filter((m) => m.sourceId === srcId)
  const feedsFor = (srcId: string) => measuresFor(srcId).length

  function reconnect(id: string) {
    void reconnectSource(id)
    toast('Source reconnected · re-syncing')
  }
  function connect(id: string) {
    void reconnectSource(id)
    toast('Source connected')
  }

  return (
    <div>
      <PageHead
        title="Data sources"
        sub="Live feeds keep every metric current without manual typing. Same number everywhere — strategy views, the dashboard and reports read one source."
      />

      <HumanNote>A number is never shown without its age and origin. When a feed dies, it surfaces as a signal within one cycle — never a silently frozen value.</HumanNote>

      {errored.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--critical)' }}>Needs attention</div>
          <div className="conn-grid">
            {errored.map((s) => {
              const meta = metaFor(s)
              const feeds = feedsFor(s.id)
              return (
                <div key={s.id} className="conn-card" style={{ borderColor: '#eecabb' }}>
                  <div className="conn-top">
                    <div className="conn-logo" style={{ background: meta.color }}><Icon name={meta.icon} /></div>
                    <div style={{ flex: 1 }}><div className="conn-name">{s.name}</div><div className="conn-kind">{s.kind} · feeds {feeds}</div></div>
                    <span className="conn-status error"><span className="fresh-dot error" /> Error</span>
                  </div>
                  <div className="conn-err"><Icon name="alert" cls="sm" /><div>{s.error}<div style={{ marginTop: 3, fontWeight: 600 }}>{s.missedRuns} missed runs → risk signal raised</div></div></div>
                  <div className="row ac" style={{ gap: 8 }}>
                    <button className="btn btn--primary sm" onClick={() => reconnect(s.id)}><Icon name="repeat" cls="sm" /> Reconnect</button>
                    <button className="btn sm" onClick={() => toast('Check-in nudge raised')}><Icon name="bell" cls="sm" /> View nudge</button>
                  </div>
                  {measuresFor(s.id).length > 0 && (
                    <div className="conn-meta">
                      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--n-400)' }}>Frozen measures</div>
                      {measuresFor(s.id).map((m) => <div key={m.id} className="conn-metarow"><span>{m.name}</span><span className="stale-badge"><Icon name="clock" cls="xs" /> {measureAge(m)}</span></div>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Connected · {connected.length}</div>
        <div className="conn-grid">
          {connected.map((s) => {
            const meta = metaFor(s)
            const feeds = feedsFor(s.id)
            return (
              <div key={s.id} className="conn-card">
                <div className="conn-top">
                  <div className="conn-logo" style={{ background: meta.color }}><Icon name={meta.icon} /></div>
                  <div style={{ flex: 1 }}><div className="conn-name">{s.name}</div><div className="conn-kind">{s.kind}{feeds ? ` · feeds ${feeds}` : ''}</div></div>
                  <span className="conn-status connected"><span className="fresh-dot fresh" /> Live</span>
                </div>
                <div className="conn-meta">
                  <div className="conn-metarow"><span>Last sync</span><span style={{ fontWeight: 600, color: 'var(--n-800)' }}>{(() => { const mins = minutesSince(s.lastSyncAt); return mins == null ? '—' : ageLabel(mins) })()}</span></div>
                  <div className="conn-metarow"><span>{s.detail}</span></div>
                  {measuresFor(s.id).map((m) => <div key={m.id} className="conn-metarow"><span style={{ color: 'var(--n-500)' }}>↳ {m.name}</span><span className="prov"><span className="fresh-dot fresh" /> {measureAge(m)}</span></div>)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Available</div>
        <div className="conn-grid">
          {available.map((s) => {
            const meta = metaFor(s)
            return (
              <div key={s.id} className="conn-card" style={{ background: 'var(--paper)' }}>
                <div className="conn-top">
                  <div className="conn-logo" style={{ background: 'var(--n-300)' }}><Icon name={meta.icon} /></div>
                  <div style={{ flex: 1 }}><div className="conn-name">{s.name}</div><div className="conn-kind">{s.detail}</div></div>
                </div>
                <button className="btn sm block" onClick={() => connect(s.id)}><Icon name="plus" cls="sm" /> Connect</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default DataSourcesView
