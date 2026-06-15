/* Strategy Tools — shared UI kit (scoped primitives + icon sprite + data context).

   The Frameworks / Whiteboard / Assessments views are a faithful port of the
   "Strategy v2" design package, which ships its own primitives (Icon, Avatar,
   SideWindow, Field, Seg, Bar, PageHead, HumanNote, Card, KPI) styled by
   strategyTools.css. We reproduce those primitives here rather than retrofit
   the app's components, so the UI is pixel-exact. People + date helpers (the
   design's window.SD.{people,P,fmtDate,months}) are supplied via context, built
   from the org's real members in the page wrapper. Overlays portal to a
   body-level `.stratools` node so position:fixed survives the app shell. */

import {
  createContext,
  useContext,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import './strategyTools.css'
import type { InitiativeHealth, InitiativeStage, ToolPerson } from '../../types/strategyTools'
import { HEALTH_DOT, HEALTH_META, STAGE_META } from './strategyDerive'

/* ───────────────────────── data context (mirrors window.SD) ───────────────────────── */

export type ToolsData = {
  people: ToolPerson[]
  P: Record<string, ToolPerson>
  fmtDate: (iso: string) => string
  months: string[]
  currentUserId: string
  currentUserName: string
  orgName: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function defaultFmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ToolsDataContext = createContext<ToolsData>({
  people: [], P: {}, fmtDate: defaultFmtDate, months: MONTHS, currentUserId: '', currentUserName: '', orgName: '',
})
export const ToolsDataProvider = ToolsDataContext.Provider
export function useToolsData(): ToolsData {
  return useContext(ToolsDataContext)
}
/** Build a ToolsData value from org members. Falls back to a placeholder person. */
export function buildToolsData(
  members: ToolPerson[],
  currentUserId: string,
  currentUserName: string,
  orgName = '',
): ToolsData {
  const people = members.length
    ? members
    : [{ id: currentUserId || 'me', name: currentUserName || 'You', initials: initialsOf(currentUserName || 'You') }]
  const P: Record<string, ToolPerson> = {}
  people.forEach((p) => { P[p.id] = p })
  // Ensure the current user always resolves, even if not in the member list yet.
  if (currentUserId && !P[currentUserId]) {
    const me = { id: currentUserId, name: currentUserName || 'You', initials: initialsOf(currentUserName || 'You') }
    people.push(me); P[currentUserId] = me
  }
  return { people, P, fmtDate: defaultFmtDate, months: MONTHS, currentUserId, currentUserName, orgName }
}
/** Fresh, locally-unique id for whiteboard elements (which live inside a
 *  content JSONB blob, not as DB rows). Module scope keeps the impure
 *  Date.now() out of React render. */
let __elSeq = 0
export function freshElId(): string {
  __elSeq += 1
  return 'el' + Date.now().toString(36) + __elSeq.toString(36)
}
export function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ───────────────────────── icon sprite + Icon ───────────────────────── */

/** The inline SVG sprite from the design's Strategy v2.html. Rendered once. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></symbol>
      <symbol id="i-ok" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></symbol>
      <symbol id="i-msg" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0Z" /></symbol>
      <symbol id="i-msgsq" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></symbol>
      <symbol id="i-branch" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></symbol>
      <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></symbol>
      <symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><polygon points="16.2 7.8 13.4 13.4 7.8 16.2 10.6 10.6" /></symbol>
      <symbol id="i-bars" viewBox="0 0 24 24"><line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="18" y1="20" x2="18" y2="10" /></symbol>
      <symbol id="i-gantt" viewBox="0 0 24 24"><line x1="4" y1="6" x2="14" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="6" y1="18" x2="13" y2="18" /></symbol>
      <symbol id="i-kanban" viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1.2" /><rect x="10" y="4" width="5" height="11" rx="1.2" /><rect x="17" y="4" width="4" height="14" rx="1.2" /></symbol>
      <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12" y2="17" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z" /></symbol>
      <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></symbol>
      <symbol id="i-building" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></symbol>
      <symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></symbol>
      <symbol id="i-cdown" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></symbol>
      <symbol id="i-cright" viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18" /></symbol>
      <symbol id="i-cleft" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18" /></symbol>
      <symbol id="i-ccleft" viewBox="0 0 24 24"><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></symbol>
      <symbol id="i-pencil" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></symbol>
      <symbol id="i-flag" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></symbol>
      <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></symbol>
      <symbol id="i-award" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6" /><path d="M8.2 13.5 7 22l5-3 5 3-1.2-8.5" /></symbol>
      <symbol id="i-activity" viewBox="0 0 24 24"><polyline points="3 12 7 12 10 5 14 19 17 12 21 12" /></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></symbol>
      <symbol id="i-trend" viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></symbol>
      <symbol id="i-brief" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></symbol>
      <symbol id="i-clip" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9zM9 11h6M9 15h4" /></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></symbol>
      <symbol id="i-layers" viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5z" /><path d="M3 12l9 5 9-5" /><path d="M3 16l9 5 9-5" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></symbol>
      <symbol id="i-repeat" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></symbol>
      <symbol id="i-minus" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /></symbol>
      <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></symbol>
      <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></symbol>
      <symbol id="i-bolt" viewBox="0 0 24 24"><polygon points="13 2 4 14 11 14 10 22 20 9 13 9" /></symbol>
      <symbol id="i-cloud" viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5-1.5A4 4 0 0 0 6.5 19z" /></symbol>
      <symbol id="i-stack" viewBox="0 0 24 24"><polygon points="12 2 22 7 12 12 2 7" /><polyline points="2 12 12 17 22 12" /><polyline points="2 17 12 22 22 17" /></symbol>
      <symbol id="i-maximize" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></symbol>
      <symbol id="i-dash" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="10" rx="1.2" /><rect x="13" y="3" width="8" height="6" rx="1.2" /><rect x="13" y="11" width="8" height="10" rx="1.2" /><rect x="3" y="15" width="8" height="6" rx="1.2" /></symbol>
      <symbol id="i-sitemap" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v5M5 17v-2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" /></symbol>
      <symbol id="i-trenddown" viewBox="0 0 24 24"><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></symbol>
      <symbol id="i-drag" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></symbol>
      <symbol id="i-cols" viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="16" rx="1.2" /><rect x="14" y="4" width="7" height="16" rx="1.2" /></symbol>
      <symbol id="i-rows" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="7" rx="1.2" /><rect x="4" y="14" width="16" height="7" rx="1.2" /></symbol>
      <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></symbol>
      <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 19 8" /></symbol>
      <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></symbol>
      <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 20h14" /></symbol>
      <symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></symbol>
      <symbol id="i-type" viewBox="0 0 24 24"><polyline points="4 7 4 4 20 4 20 7" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="9" y1="20" x2="15" y2="20" /></symbol>
      <symbol id="i-align" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></symbol>
      <symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 7 4 12l5 5" /><path d="M4 12h11a5 5 0 0 1 0 10h-1" /></symbol>
      <symbol id="i-redo" viewBox="0 0 24 24"><path d="m15 7 5 5-5 5" /><path d="M20 12H9a5 5 0 0 0 0 10h1" /></symbol>
      <symbol id="i-sparkles" viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 14l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" /></symbol>
      <symbol id="i-sticky" viewBox="0 0 24 24"><path d="M4 4h16v11l-5 5H4z" /><path d="M20 15h-5v5" /></symbol>
      <symbol id="i-square" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></symbol>
      <symbol id="i-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></symbol>
      <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></symbol>
      <symbol id="i-gauge" viewBox="0 0 24 24"><path d="M12 14l4-4" /><path d="M5 19a9 9 0 1 1 14 0" /><circle cx="12" cy="14" r="1.4" /></symbol>
      <symbol id="i-rowsview" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></symbol>
    </svg>
  )
}

export function Icon({ name, cls = '', style }: { name: string; cls?: string; style?: CSSProperties }) {
  return <svg className={'ic ' + cls} style={style} aria-hidden="true"><use href={'#i-' + name} /></svg>
}

/* ───────────────────────── Avatar ───────────────────────── */

export function Avatar({ id, size = 'sm', title }: { id?: string; size?: string; title?: string }) {
  const { P } = useToolsData()
  const p = id ? P[id] : undefined
  const init = p ? p.initials : id ? initialsOf(id) : '?'
  return <div className={'avatar ' + size} title={title || (p ? p.name : '')}>{init}</div>
}

/* ───────────────────────── Progress bar ───────────────────────── */

export function Bar({ pct, color = 'var(--forest)', thin }: { pct: number; color?: string; thin?: boolean }) {
  return (
    <div className={'bar' + (thin ? ' thin' : '')}>
      <i style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: color }} />
    </div>
  )
}

/* ───────────────────────── KPI tile ───────────────────────── */

export function KPI({ icon, label, value, sub, tone }: { icon?: string; label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="kpi">
      <div className="kpi__lbl">{icon && <Icon name={icon} cls="xs" />}{label}</div>
      <div className={'kpi__big tnum' + (tone === 'crit' ? ' crit' : '') + (tone === 'serif' ? ' serif' : '')}>{value}</div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  )
}

/* ───────────────────────── Card / SectionTitle ───────────────────────── */

export function Card({ children, className = '', style, ...rest }: { children: ReactNode; className?: string; style?: CSSProperties } & Record<string, unknown>) {
  return <div className={'card ' + className} style={style} {...rest}>{children}</div>
}

/* ───────────────────────── Side window (right slide-over) ───────────────────────── */

function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(<div className="stratools" style={{ display: 'contents' }}>{children}</div>, document.body)
}

export function SideWindow({
  open, onClose, eyebrow, title, headRight, children, footer, wide,
}: {
  open: boolean
  onClose: () => void
  eyebrow?: ReactNode
  title?: ReactNode
  headRight?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <Portal>
      <div className={'scrim' + (open ? ' show' : '')} onClick={onClose} />
      <aside className={'sw' + (wide ? ' wide' : '') + (open ? ' show' : '')} role="dialog" aria-modal="true">
        {open && (
          <div style={{ display: 'contents' }}>
            <div className="sw__head">
              <div>
                {eyebrow && <div className="sw__ey">{eyebrow}</div>}
                <div className="sw__t">{title}</div>
              </div>
              {headRight}
              <button className="x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
            </div>
            <div className="sw__body">{children}</div>
            {footer && <div className="sw__foot">{footer}</div>}
          </div>
        )}
      </aside>
    </Portal>
  )
}

/* ───────────────────────── Human-in-the-loop note ───────────────────────── */

export function HumanNote({ children }: { children: ReactNode }) {
  return <div className="humannote"><Icon name="shield" /><p>{children}</p></div>
}

/* ───────────────────────── Field / Seg ───────────────────────── */

export function Field({ label, opt, children }: { label: ReactNode; opt?: boolean; children: ReactNode }) {
  return (
    <div className="field">
      <div className="flabel">{label}{opt && <span className="opt"> (optional)</span>}</div>
      {children}
    </div>
  )
}

export function Seg<T extends string>({ options, value, onChange }: {
  options: Array<{ v: T; label: ReactNode }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <div key={o.v} className={'segopt' + (value === o.v ? ' on' : '')} onClick={() => onChange(o.v)}>{o.label}</div>
      ))}
    </div>
  )
}

/* ───────────────────────── PageHead ───────────────────────── */

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="phead">
      <div className="phead__t">
        <div className="h1">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

/* ───────────────────────── Toast ───────────────────────── */

export function Toast({ message }: { message: string | null }) {
  return (
    <Portal>
      <div className={'toast' + (message ? ' show' : '')}><Icon name="ok" cls="sm" />{message}</div>
    </Portal>
  )
}

/* ───────────────────────── Status chips + pillar bits + avatar stack ─────────────────────────
   Used across the Execution / Insight views (ported from the design's
   HealthBadge / StageBadge / PillarChip / AvatarStack). */

export function HealthBadge({ h }: { h: InitiativeHealth }) {
  const m = HEALTH_META[h]
  return (
    <span className={'badge badge--' + m.cls}>
      <span className="hdot" style={{ background: HEALTH_DOT[h] }} />
      {m.label}
    </span>
  )
}

export function HealthDot({ h }: { h: InitiativeHealth }) {
  return <span className={'sdot ' + h} />
}

export function StageBadge({ stage }: { stage: InitiativeStage }) {
  const m = STAGE_META[stage]
  return (
    <span className="badge badge--neutral" style={{ color: m.fg }}>
      <span className="hdot" style={{ background: m.fg }} />
      {m.label}
    </span>
  )
}

export function PillarDot({ color }: { color: string }) {
  return <span className="pdot" style={{ background: color }} />
}

export function PillarChip({ pillar }: { pillar: { name: string; color: string; softColor?: string } }) {
  return (
    <span className="pchip" style={{ background: pillar.softColor || 'var(--n-100)', color: pillar.color }}>
      <span className="pdot" style={{ background: pillar.color }} />
      {pillar.name}
    </span>
  )
}

export function AvatarStack({ ids = [], size = 'xs', max = 4 }: { ids?: string[]; size?: string; max?: number }) {
  const show = ids.slice(0, max)
  const extra = ids.length - show.length
  return (
    <div className="astack">
      {show.map((id) => <Avatar key={id} id={id} size={size} />)}
      {extra > 0 && <div className={'avatar ' + size} style={{ background: 'var(--n-200)', color: 'var(--n-600)' }}>+{extra}</div>}
    </div>
  )
}
