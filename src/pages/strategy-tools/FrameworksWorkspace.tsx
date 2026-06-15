/* Strategy frameworks + whiteboard — the usable analysis workspace.
   Faithful 1:1 UI port of the design package's views_frameworks.jsx: create a
   tool, walk through it section by section, edit cells inline, version it. The
   same component renders the Frameworks surface and the freeform Whiteboard,
   switched by the `mode` prop. Schemas/templates/helpers come from
   frameworkSchemas; persistence is DB-driven via useStrategyToolAnalyses
   (no localStorage, no window globals). */

import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Field,
  freshElId,
  HumanNote,
  Icon,
  PageHead,
  SideWindow,
  useToolsData,
} from './StrategyToolsKit'
import { useToolsToast } from './StrategyToolsShell'
import {
  contentFromTemplate,
  countPoints,
  deepClone,
  fwMonthYear,
  FW_SCHEMA,
  relTime,
  riskCls,
  TOOL_GROUPS,
  templatesFor,
  toolContent,
  toolMeta,
  type FwSchema,
  type FwSection,
  type ToolTemplate,
} from './frameworkSchemas'
import { useStrategyToolAnalyses } from '../../hooks/useStrategyToolAnalyses'
import type {
  FwKind,
  Rating,
  SectionData,
  ToolAnalysis,
  ToolVersion,
  WbElement,
  WbElementType,
} from '../../types/strategyTools'

/* CSS custom properties (`--ac`, `--bd`) are set via inline style throughout the
   design's markup; React.CSSProperties doesn't model them, so allow them here. */
type CSSVars = React.CSSProperties & Record<string, string | number>

/* ---------------- rating segmented ---------------- */
function RatingSeg({ value, onChange }: { value?: Rating; onChange: (v: Rating) => void }) {
  const opts: Array<[Rating, string]> = [['Low', 'on-lo'], ['Medium', 'on-md'], ['High', 'on-hi']]
  return (
    <div className="minseg">
      {opts.map(([v, c]) => (
        <button key={v} className={value === v ? c : ''} onClick={(e) => { e.stopPropagation(); onChange(v) }}>{v}</button>
      ))}
    </div>
  )
}

/* ---------------- list field (view + edit) ---------------- */
function ListField({ items, editable, onChange, listKind, placeholder }: {
  items: string[]
  editable?: boolean
  onChange: (items: string[]) => void
  listKind?: string
  placeholder?: string
}) {
  if (!editable) {
    if (!items || items.length === 0) return <div className="ed-empty">No points yet.</div>
    if (listKind === 'porter') return <ul className="pf-list">{items.map((t, i) => <li key={i} className="pf-li">{t}</li>)}</ul>
    return <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
  }
  const set = (i: number, v: string) => { const n = items.slice(); n[i] = v; onChange(n) }
  const del = (i: number) => onChange(items.filter((_, k) => k !== i))
  return (
    <div className="ed-list">
      {items.map((t, i) => (
        <div className="ed-item" key={i}>
          <input value={t} placeholder={placeholder || 'Add a point…'} onChange={(e) => set(i, e.target.value)} />
          <button className="ed-del" onClick={() => del(i)} aria-label="Remove"><Icon name="x" cls="xs" /></button>
        </div>
      ))}
      <button className="ed-add" onClick={() => onChange([...items, ''])}><Icon name="plus" cls="xs" /> Add point</button>
    </div>
  )
}

function SectionBody({ section, sdata, editable, onChange, listKind }: {
  section: FwSection
  sdata: SectionData
  editable?: boolean
  onChange: (d: SectionData) => void
  listKind?: string
}) {
  if (section.field === 'text') {
    return editable
      ? <textarea className="ed-text" style={{ marginTop: 10 }} value={sdata.text || ''} placeholder={section.prompt} onChange={(e) => onChange({ ...sdata, text: e.target.value })} />
      : (sdata.text ? <div className="s7-d" style={{ fontSize: 13, marginTop: 8 }}>{sdata.text}</div> : <div className="ed-empty">Not filled in yet.</div>)
  }
  return <ListField items={sdata.items || []} editable={editable} listKind={listKind} onChange={(items) => onChange({ ...sdata, items })} />
}

/* ---------------- layout renderers ---------------- */
type LayoutProps = {
  schema: FwSchema
  get: (id: string) => SectionData
  editable?: boolean
  onChange: (id: string, d: SectionData) => void
  highlight?: string | null
}

function QuadBox({ section, sdata, editable, onChange, highlight }: {
  section: FwSection
  sdata: SectionData
  editable?: boolean
  onChange: (d: SectionData) => void
  highlight?: string | null
}) {
  return (
    <div className={'qbox ' + section.cls + (highlight === section.id ? ' wt-hl' : '')}>
      {section.icon ? (
        <div className="row ac" style={{ gap: 11 }}>
          <span className="qicon"><Icon name={section.icon} cls="sm" /></span>
          <div><div className="qcap">{section.cap}</div><h4 style={{ marginTop: 0 }}>{section.title}</h4></div>
        </div>
      ) : (
        <div className="row ac" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {section.cap && <div className="qcap">{section.cap}</div>}
            <h4 style={{ marginTop: 0 }}>{section.title}</h4>
            {section.sub && <div style={{ fontSize: 11.5, color: 'var(--n-500)', marginTop: 3 }}>{section.sub}</div>}
          </div>
          {section.hasRisk && (editable
            ? <RatingSeg value={sdata.risk} onChange={(v) => onChange({ ...sdata, risk: v })} />
            : <span className={'badge badge--' + riskCls(sdata.risk)}>{sdata.risk} risk</span>)}
        </div>
      )}
      <SectionBody section={section} sdata={sdata} editable={editable} onChange={onChange} listKind="quad" />
    </div>
  )
}

function QuadLayout({ schema, get, editable, onChange, highlight }: LayoutProps) {
  const ax = schema.axes || {}
  return (
    <div className="quad-axes">
      <div className="axis-y">{ax.y}</div>
      <div>
        {ax.topL && <div className="axis-x" style={{ padding: '0 0 10px 0' }}><span style={{ color: '#2f7757' }}>{ax.topL}</span><span style={{ color: '#a8553a' }}>{ax.topR}</span></div>}
        <div className="quad">
          {schema.sections.map((sec) => (
            <QuadBox key={sec.id} section={sec} sdata={get(sec.id)} editable={editable} onChange={(d) => onChange(sec.id, d)} highlight={highlight} />
          ))}
        </div>
        {ax.bottom && <div className="axis-x">{ax.bottom}</div>}
      </div>
    </div>
  )
}

function PorterLayout({ schema, get, editable, onChange, highlight }: LayoutProps) {
  return (
    <div className="porter">
      {schema.sections.map((sec) => {
        const sdata = get(sec.id)
        return (
          <div key={sec.id} className={'pforce ' + sec.pos + (sec.center ? ' center' : '') + (highlight === sec.id ? ' wt-hl' : '')}>
            <div className="pf-h"><span className="pf-ico"><Icon name={sec.icon ?? ''} cls="sm" /></span>{sec.title}</div>
            <div className="pf-rate">
              {editable
                ? <RatingSeg value={sdata.rating} onChange={(v) => onChange(sec.id, { ...sdata, rating: v })} />
                : (sec.center
                    ? <span className="badge" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}>{sdata.rating} intensity</span>
                    : <span className={'badge badge--' + riskCls(sdata.rating)}>{sdata.rating} intensity</span>)}
            </div>
            <SectionBody section={sec} sdata={sdata} editable={editable} onChange={(d) => onChange(sec.id, d)} listKind="porter" />
          </div>
        )
      })}
    </div>
  )
}

function PestelLayout({ schema, get, editable, onChange, highlight }: LayoutProps) {
  return (
    <div className="pestel">
      {schema.sections.map((sec) => (
        <div key={sec.id} className={'pest' + (highlight === sec.id ? ' wt-hl' : '')} style={{ '--ac': sec.color } as CSSVars}>
          <div className="pest-h"><span className="pest-ico"><Icon name={sec.icon ?? ''} cls="sm" /></span>
            <div><div className="pest-t">{sec.title}</div><div className="pest-s">{sec.sub}</div></div></div>
          <SectionBody section={sec} sdata={get(sec.id)} editable={editable} onChange={(d) => onChange(sec.id, d)} listKind="pest" />
        </div>
      ))}
    </div>
  )
}

function S7Layout({ schema, get, editable, onChange, highlight }: LayoutProps) {
  const [localSel, setLocalSel] = useState('values')
  const sel = highlight || localSel
  const secs = schema.sections
  const idxById = (id: string) => secs.findIndex((s) => s.id === id)
  const cx = 150, cy = 150, R = 108
  const ringIds = ['strategy', 'structure', 'systems', 'skills', 'style', 'staff']
  const colorOf = (k?: string) => k === 'hard' ? '#1a3d32' : k === 'core' ? '#b8862f' : '#a8553a'
  const nodePos = (id: string) => { const i = ringIds.indexOf(id); const ang = -Math.PI / 2 + (i * Math.PI) / 3; return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) } }
  return (
    <div className="s7-wrap">
      <div className="s7-diagram">
        <svg viewBox="0 0 300 300" style={{ width: '100%', height: 'auto' }}>
          {ringIds.map((id) => { const p = nodePos(id); return <line key={'c' + id} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#d8d2c0" strokeWidth="1.4" /> })}
          {ringIds.map((id, k) => { const a = nodePos(id); const b = nodePos(ringIds[(k + 1) % ringIds.length]); return <line key={'r' + id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e3ddcc" strokeWidth="1.4" /> })}
          {ringIds.map((id) => {
            const p = nodePos(id); const sec = secs[idxById(id)]; const on = sel === id; const c = colorOf(sec.kind7)
            return (
              <g key={id} className="s7-node" onClick={() => setLocalSel(id)}>
                <circle cx={p.x} cy={p.y} r="32" fill={on ? c : '#fff'} stroke={c} strokeWidth="1.8" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill={on ? '#fff' : '#262626'}>{sec.title.split(' ')[0]}</text>
              </g>
            )
          })}
          <g className="s7-node" onClick={() => setLocalSel('values')}>
            <circle cx={cx} cy={cy} r="40" fill={sel === 'values' ? '#b8862f' : '#fbf2da'} stroke="#b8862f" strokeWidth="2" />
            <text x={cx} y={cy - 3} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={sel === 'values' ? '#fff' : '#9a6c12'}>Shared</text>
            <text x={cx} y={cy + 11} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={sel === 'values' ? '#fff' : '#9a6c12'}>values</text>
          </g>
        </svg>
        <div className="row ac" style={{ gap: 16, justifyContent: 'center', paddingBottom: 6, fontSize: 11.5, color: 'var(--n-600)' }}>
          <span className="row ac" style={{ gap: 6 }}><span className="pdot" style={{ background: '#1a3d32' }} />Hard</span>
          <span className="row ac" style={{ gap: 6 }}><span className="pdot" style={{ background: '#a8553a' }} />Soft</span>
          <span className="row ac" style={{ gap: 6 }}><span className="pdot" style={{ background: '#b8862f' }} />Core</span>
        </div>
      </div>
      <div className="s7-cards">
        {secs.map((sec) => {
          const c = colorOf(sec.kind7); const sdata = get(sec.id)
          return (
            <div key={sec.id} className={'s7-card' + (sel === sec.id ? ' on wt-hl' : '')} style={{ '--ac': c } as CSSVars} onClick={() => setLocalSel(sec.id)}>
              <span className="s7-badge" style={{ background: c }}>{sec.title[0]}</span>
              <div style={{ flex: 1 }}>
                <div className="s7-t">{sec.title}<span className={'s7-kind ' + (sec.kind7 === 'soft' ? 'soft' : 'hard')}>{sec.kind7 === 'core' ? 'Core' : sec.kind7 === 'hard' ? 'Hard' : 'Soft'}</span></div>
                {editable
                  ? <textarea className="ed-text" style={{ marginTop: 6, minHeight: 54 }} value={sdata.text || ''} placeholder={sec.prompt} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(sec.id, { ...sdata, text: e.target.value })} />
                  : (sdata.text ? <div className="s7-d">{sdata.text}</div> : <div className="ed-empty">Not filled in yet.</div>)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FrameworkDiagram({ analysis, editable, onChange, highlight }: {
  analysis: ToolAnalysis
  editable?: boolean
  onChange: (id: string, d: SectionData) => void
  highlight?: string | null
}) {
  const schema = FW_SCHEMA[analysis.fw]
  const get = (id: string) => analysis.sections[id] || {}
  const props: LayoutProps = { schema, get, editable, onChange, highlight }
  if (schema.kind === 'quad') return <QuadLayout {...props} />
  if (schema.kind === 'porter') return <PorterLayout {...props} />
  if (schema.kind === 'pestel') return <PestelLayout {...props} />
  if (schema.kind === 's7') return <S7Layout {...props} />
  if (schema.kind === 'canvas') return schema.canvasKind === 'bmc' ? <BMCLayout {...props} /> : <VPCLayout {...props} />
  return null
}

/* ---------------- BUSINESS MODEL CANVAS ---------------- */
function BmcCell({ sec, sdata, editable, onChange, highlight }: {
  sec: FwSection
  sdata: SectionData
  editable?: boolean
  onChange: (d: SectionData) => void
  highlight?: string | null
}) {
  return (
    <div className={'bmc-cell ' + sec.pos + (sec.center ? ' value-cell' : '') + (highlight === sec.id ? ' wt-hl' : '')} style={{ '--ac': sec.ac } as CSSVars}>
      <div className="bmc-h"><span className="bmc-ico"><Icon name={sec.icon ?? ''} cls="xs" /></span><span className="bmc-t">{sec.title}</span></div>
      <SectionBody section={sec} sdata={sdata} editable={editable} onChange={onChange} listKind="bmc" />
    </div>
  )
}
function BMCLayout({ schema, get, editable, onChange, highlight }: LayoutProps) {
  const byId = Object.fromEntries(schema.sections.map((s) => [s.id, s])) as Record<string, FwSection>
  const cell = (id: string) => <BmcCell key={id} sec={byId[id]} sdata={get(id)} editable={editable} onChange={(d) => onChange(id, d)} highlight={highlight} />
  return (
    <div className="bmc">
      <div className="bmc-top">
        {['partners', 'activities', 'resources', 'value', 'relations', 'channels', 'segments'].map(cell)}
      </div>
      <div className="bmc-bottom">{['costs', 'revenue'].map(cell)}</div>
    </div>
  )
}

/* ---------------- VALUE PROPOSITION CANVAS ---------------- */
function VpcBlock({ sec, sdata, editable, onChange, highlight }: {
  sec: FwSection
  sdata: SectionData
  editable?: boolean
  onChange: (d: SectionData) => void
  highlight?: string | null
}) {
  return (
    <div className={'vpc-block' + (highlight === sec.id ? ' wt-hl' : '')} style={{ '--bd': sec.color } as CSSVars}>
      <div className="vpc-bh"><span className="vpc-bdot" style={{ background: sec.color }} /><span className="vpc-bt">{sec.title}</span></div>
      <SectionBody section={sec} sdata={sdata} editable={editable} onChange={onChange} listKind="vpc" />
    </div>
  )
}
function VPCLayout({ schema, get, editable, onChange, highlight }: LayoutProps) {
  const map = schema.sections.filter((s) => s.side === 'map')
  const profile = schema.sections.filter((s) => s.side === 'profile')
  const block = (sec: FwSection) => <VpcBlock key={sec.id} sec={sec} sdata={get(sec.id)} editable={editable} onChange={(d) => onChange(sec.id, d)} highlight={highlight} />
  return (
    <div>
      <div className="vpc">
        <div className="vpc-side">
          <div className="vpc-side-h"><span className="ico" style={{ background: '#1a3d32' }}><Icon name="award" cls="sm" /></span>
            <div><div className="t">Value map</div><div className="s">What you offer</div></div>
            <svg className="vpc-shape" viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="3" fill="none" stroke="#1a3d32" strokeWidth="2" /></svg>
          </div>
          {map.map(block)}
        </div>
        <div className="vpc-side">
          <div className="vpc-side-h"><span className="ico" style={{ background: '#b8862f' }}><Icon name="user" cls="sm" /></span>
            <div><div className="t">Customer profile</div><div className="s">What they want</div></div>
            <svg className="vpc-shape" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="none" stroke="#b8862f" strokeWidth="2" /></svg>
          </div>
          {profile.map(block)}
        </div>
      </div>
      <div className="vpc-fit"><Icon name="ok" cls="sm" style={{ color: 'var(--forest)' }} /> Aim for <b style={{ margin: '0 4px' }}>fit</b> — your pain relievers and gain creators should match the customer's most important pains and gains.</div>
    </div>
  )
}

/* ---------------- WHITEBOARD (Boardmix-style canvas) ---------------- */
const WB_PALETTE = ['#f6e7b8', '#cfe6d2', '#cfe0f0', '#f0d8cd', '#e6d6f0', '#ffffff']

function TemplateMenu({ label, icon, btnClass, onPick }: {
  label: string
  icon?: string
  btnClass?: string
  onPick: (t: ToolTemplate) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) } document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const tpls = templatesFor('whiteboard').filter((t) => t.elements)
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={btnClass || 'btn sm'} onClick={() => setOpen((o) => !o)}><Icon name={icon || 'grid'} cls="sm" /> {label} <Icon name="cdown" cls="xs" /></button>
      {open && (
        <div className="tpl-menu">
          <div className="tpl-menu-sec">Strategic templates</div>
          {tpls.map((t) => (
            <div key={t.id} className="tpl-menu-item" onClick={() => { setOpen(false); onPick(t) }}>
              <span className="tpl-menu-ic"><Icon name="grid" cls="sm" /></span>
              <div><div className="nm">{t.name}</div><div className="ds">{t.desc}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WhiteboardCanvas({ elements, onChange, editable }: {
  elements: WbElement[]
  onChange: (els: WbElement[]) => void
  editable?: boolean
}) {
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const els = elements || []

  const update = (id: string, patch: Partial<WbElement>) => onChange(els.map((e) => e.id === id ? { ...e, ...patch } : e))
  const add = (type: WbElementType) => {
    const i = els.length
    const id = freshElId()
    const base = { id, x: 80 + (i % 6) * 24, y: 88 + (i % 6) * 20, text: '' }
    const el: WbElement = type === 'text' ? { ...base, type: 'text', w: 230, h: 42, color: null }
      : type === 'sticky' ? { ...base, type: 'sticky', w: 150, h: 120, color: '#f6e7b8' }
      : { ...base, type, w: 168, h: 118, color: null }
    onChange([...els, el]); setSel(id)
    if (type === 'text' || type === 'sticky') setEditing(id)
  }
  const del = (id: string) => { onChange(els.filter((e) => e.id !== id)); setSel(null); setEditing(null) }

  function startDrag(e: React.MouseEvent, el: WbElement) {
    if (!editable || editing === el.id) return
    e.stopPropagation(); setSel(el.id)
    const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y
    function move(ev: MouseEvent) { update(el.id, { x: Math.max(0, ox + (ev.clientX - sx)), y: Math.max(0, oy + (ev.clientY - sy)) }) }
    function up() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const selEl = els.find((e) => e.id === sel)
  return (
    <div>
      <div className="wb-toolbar">
        <span className="wb-tg">
          <button className="wb-tool" onClick={() => add('sticky')}><Icon name="sticky" cls="sm" /> Sticky</button>
          <button className="wb-tool" onClick={() => add('text')}><Icon name="type" cls="sm" /> Text</button>
          <button className="wb-tool" onClick={() => add('rect')}><Icon name="square" cls="sm" /> Box</button>
          <button className="wb-tool" onClick={() => add('ellipse')}><Icon name="circle" cls="sm" /> Ellipse</button>
          <TemplateMenu label="Templates" icon="grid" btnClass="wb-tool"
            onPick={(t) => { if (els.length === 0 || window.confirm('Replace the current board with the “' + t.name + '” template?')) onChange(deepClone(t.elements || [])) }} />
        </span>
        {selEl && (
          <span className="wb-tg" style={{ marginLeft: 'auto' }}>
            {(selEl.type === 'sticky' || selEl.type === 'rect' || selEl.type === 'ellipse') && WB_PALETTE.map((c) => (
              <button key={c} className={'wb-swatch' + (selEl.color === c ? ' on' : '')} style={{ background: c }} onClick={() => update(selEl.id, { color: c })} />
            ))}
            <button className="wb-tool danger" onClick={() => del(selEl.id)}><Icon name="x" cls="sm" /> Delete</button>
          </span>
        )}
      </div>
      <div className="wb-canvas" onMouseDown={() => { setSel(null); setEditing(null) }}>
        {els.map((el) => {
          const isSel = sel === el.id, isEd = editing === el.id
          const cls = 'wb-el wb-' + el.type + (isSel ? ' sel' : '')
          const style: React.CSSProperties = { left: el.x, top: el.y, width: el.w, height: el.h }
          if (el.type === 'sticky') style.background = el.color || '#f6e7b8'
          if ((el.type === 'rect' || el.type === 'ellipse') && el.color) { style.borderColor = el.color; style.background = el.color + '1f' }
          return (
            <div key={el.id} className={cls} style={style}
              onMouseDown={(e) => startDrag(e, el)}
              onClick={(e) => { e.stopPropagation(); setSel(el.id) }}
              onDoubleClick={(e) => { e.stopPropagation(); if (editable) setEditing(el.id) }}>
              {isEd
                ? <textarea className="wb-ta" autoFocus defaultValue={el.text}
                    onBlur={(e) => { update(el.id, { text: e.target.value }); setEditing(null) }}
                    onMouseDown={(e) => e.stopPropagation()} />
                : <div className="wb-txt">{el.text || (editable ? <span className="wb-ph">{el.type === 'text' ? 'Text…' : 'Double-click to edit'}</span> : '')}</div>}
            </div>
          )
        })}
        {els.length === 0 && <div className="wb-empty"><Icon name="grid" cls="lg" /><div>Add a sticky, text or shape from the toolbar to start.</div></div>}
      </div>
    </div>
  )
}

/* ---------------- VERSIONS PANEL ---------------- */
function VersionsPanel({ analysis, onClose, onSave, onRestore, onRename, onDelete }: {
  analysis: ToolAnalysis
  onClose: () => void
  onSave: (label: string, note: string) => void
  onRestore: (v: ToolVersion) => void
  onRename: (vid: string, label: string) => void
  onDelete: (vid: string) => void
}) {
  const { P } = useToolsData()
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const versions = (analysis.versions || []).slice().reverse()
  function save() {
    const l = label.trim() || ('Version ' + ((analysis.versions || []).length + 1))
    onSave(l, note.trim()); setLabel(''); setNote('')
  }
  return (
    <SideWindow open onClose={onClose} eyebrow={toolMeta(analysis.fw).name} title="Version history"
      footer={<div style={{ display: 'contents' }}><button className="btn btn--ghost" onClick={onClose}>Close</button></div>}>
      <div className="ver-save">
        <div className="flabel" style={{ marginBottom: 7 }}>Save current state as a version</div>
        <input value={label} placeholder={'Version ' + ((analysis.versions || []).length + 1)} onChange={(e) => setLabel(e.target.value)} />
        <textarea className="ed-text" style={{ marginTop: 8, minHeight: 54 }} value={note} placeholder="What changed? (optional)" onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn--primary sm" style={{ marginTop: 10 }} onClick={save}><Icon name="clock" cls="sm" /> Save version</button>
      </div>
      <div className="flabel" style={{ marginBottom: 10 }}>Saved versions · {versions.length}</div>
      {versions.length === 0 && <div className="ver-empty"><Icon name="clock" cls="lg" /><div style={{ marginTop: 8 }}>No saved versions yet.<br />Save one above to capture this state.</div></div>}
      {versions.map((v, idx) => {
        const num = (analysis.versions || []).length - idx
        return (
          <div key={v.id} className="ver-item">
            <div className="ver-top">
              <span className="ver-badge">v{num}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input className="ver-label" value={v.label} onChange={(e) => onRename(v.id, e.target.value)} />
                <div className="ver-meta"><Avatar id={v.by} size="xs" /> {(P[v.by]?.name ?? v.byName ?? '—').split(' ')[0]} <span style={{ color: 'var(--n-300)' }}>·</span> {relTime(v.ts)} <span style={{ color: 'var(--n-300)' }}>·</span> {v.count}</div>
              </div>
            </div>
            {v.note && <div className="ver-note">{v.note}</div>}
            <div className="ver-actions">
              <button className="btn sm" onClick={() => onRestore(v)}><Icon name="repeat" cls="sm" /> Restore</button>
              <button className="btn btn--ghost sm" onClick={() => onDelete(v.id)}><Icon name="x" cls="sm" /> Delete</button>
            </div>
          </div>
        )
      })}
    </SideWindow>
  )
}

/* ---------------- walkthrough side window ---------------- */
function WalkThrough({ analysis, onChange, onClose, onStep }: {
  analysis: ToolAnalysis
  onChange: (sid: string, d: SectionData) => void
  onClose: () => void
  onStep: (sid: string) => void
}) {
  const schema = FW_SCHEMA[analysis.fw]
  const steps = schema.sections
  const [i, setI] = useState(0)
  const inpRef = useRef<HTMLInputElement>(null)
  const sec = steps[i]
  const sdata = analysis.sections[sec.id] || {}
  useEffect(() => { onStep(sec.id); if (inpRef.current) inpRef.current.value = '' }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (d: SectionData) => onChange(sec.id, d)
  const addItem = () => { const v = inpRef.current ? inpRef.current.value.trim() : ''; if (!v) return; set({ ...sdata, items: [...(sdata.items || []), v] }); if (inpRef.current) { inpRef.current.value = ''; inpRef.current.focus() } }
  const last = i === steps.length - 1

  return (
    <SideWindow open onClose={onClose} eyebrow={`Guided · ${schema.name}`} title={sec.title}
      footer={<div style={{ display: 'contents' }}>
        <button className="btn" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}><Icon name="cleft" cls="sm" /> Back</button>
        <div style={{ flex: 1 }} />
        {last
          ? <button className="btn btn--primary" onClick={onClose}><Icon name="ok" cls="sm" /> Finish</button>
          : <button className="btn btn--primary" onClick={() => setI((x) => x + 1)}>Next <Icon name="cright" cls="sm" /></button>}
      </div>}>
      <div>
        <div className="wt-prog">{steps.map((s, k) => <div key={s.id} className={'wt-seg' + (k < i ? ' done' : k === i ? ' cur' : '')} />)}</div>
        <div className="wt-step" style={{ marginTop: 8 }}>Step {i + 1} of {steps.length}</div>
      </div>
      <div className="wt-prompt">{sec.prompt}</div>
      <div className="wt-hint"><Icon name="help" cls="sm" style={{ marginRight: 6, verticalAlign: '-3px', color: 'var(--forest)' }} /> {sec.hint}</div>

      {sec.field === 'text' ? (
        <Field label={sec.title}>
          <textarea className="ed-text" value={sdata.text || ''} placeholder="Write a sentence or two…" onChange={(e) => set({ ...sdata, text: e.target.value })} />
        </Field>
      ) : (
        <div className="field">
          {(sec.hasRating || sec.hasRisk) && (
            <div className="row ac" style={{ gap: 12, marginBottom: 4 }}>
              <span className="flabel" style={{ margin: 0 }}>{sec.hasRating ? 'Intensity' : 'Risk level'}</span>
              <RatingSeg value={sec.hasRating ? sdata.rating : sdata.risk} onChange={(v) => set(sec.hasRating ? { ...sdata, rating: v } : { ...sdata, risk: v })} />
            </div>
          )}
          <div className="wt-add-row">
            <input ref={inpRef} placeholder="Type a point and press Enter" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }} />
            <button className="btn btn--primary sm" onClick={addItem}><Icon name="plus" cls="sm" /> Add</button>
          </div>
          <div className="wt-chips">
            {(sdata.items || []).map((t, k) => (
              <div key={k} className="wt-chip"><span>{t}</span>
                <button onClick={() => set({ ...sdata, items: (sdata.items || []).filter((_, j) => j !== k) })}><Icon name="x" cls="xs" /></button></div>
            ))}
            {(sdata.items || []).length === 0 && <div className="ed-empty">Nothing added yet — type above to add your first point.</div>}
          </div>
        </div>
      )}
    </SideWindow>
  )
}

/* ---------------- new analysis side window ---------------- */
function NewAnalysisPanel({ presetFw, onCreate, onClose }: {
  presetFw?: FwKind
  onCreate: (fw: FwKind, title: string, owner: string, template?: ToolTemplate) => void
  onClose: () => void
}) {
  const { people, currentUserId } = useToolsData()
  const [fw, setFw] = useState<FwKind>(presetFw || 'swot')
  const [tpl, setTpl] = useState(templatesFor(presetFw || 'swot')[0].id)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState(currentUserId || people[0]?.id || '')
  const [touched, setTouched] = useState(false)
  const meta = toolMeta(fw)
  const placeholder = meta.name + ' — ' + fwMonthYear()
  const tpls = templatesFor(fw)
  function pickTool(id: FwKind) { setFw(id); setTpl(templatesFor(id)[0].id); if (!touched) setTitle('') }
  function create() { onCreate(fw, title.trim() || placeholder, owner, tpls.find((t) => t.id === tpl)) }
  return (
    <SideWindow open onClose={onClose} eyebrow="New" title="Create a strategy tool" wide
      footer={<div style={{ display: 'contents' }}>
        <button className="btn btn--primary" onClick={create}><Icon name="compass" cls="sm" /> Create{fw !== 'whiteboard' ? ' & plan' : ''}</button>
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
      </div>}>
      <Field label="Choose a tool">
        <div style={{ display: 'contents' }}>
          {TOOL_GROUPS.map((g) => (
            <div key={g.label} className="tool-grp">
              <div className="gl">{g.label}</div>
              <div className="tool-pick">
                {g.ids.map((id) => { const m = toolMeta(id); return (
                  <div key={id} className={'tool-opt' + (fw === id ? ' on' : '')} style={{ '--ac': m.ac } as CSSVars} onClick={() => pickTool(id as FwKind)}>
                    <div className="tn">{m.name}</div><div className="tdsc">{m.intro}</div>
                  </div>
                ) })}
              </div>
            </div>
          ))}
        </div>
      </Field>
      <Field label="Start from a template">
        <div style={{ display: 'contents' }}>
          {tpls.map((t) => (
            <div key={t.id} className={'tpl-card' + (tpl === t.id ? ' on' : '')} onClick={() => setTpl(t.id)}>
              <span className="tpl-ic"><Icon name={t.sections || t.elements ? 'clip' : 'plus'} cls="sm" /></span>
              <div><div className="tnm">{t.name}</div><div className="tds">{t.desc}</div></div>
            </div>
          ))}
        </div>
      </Field>
      <Field label="Title"><input className="input" value={title} placeholder={placeholder} onChange={(e) => { setTitle(e.target.value); setTouched(true) }} /></Field>
      <Field label="Owner">
        <div style={{ position: 'relative' }}>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: 34, cursor: 'pointer' }}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--n-400)' }}><Icon name="cdown" cls="xs" /></span>
        </div>
      </Field>
      <div className="wt-hint"><Icon name="compass" cls="sm" style={{ marginRight: 6, verticalAlign: '-3px', color: 'var(--forest)' }} /> {fw === 'whiteboard' ? "You'll get a freeform canvas — add notes, text and shapes and drag to arrange." : "You'll be guided through each section with a prompt — or skip and edit directly."}</div>
    </SideWindow>
  )
}

/* ---------------- editor ---------------- */
function AnalysisEditor({ analysis, onChange, onBack, onWalk, onDelete, onDuplicate, onVersions, highlight }: {
  analysis: ToolAnalysis
  onChange: (a: ToolAnalysis) => void
  onBack: () => void
  onWalk: () => void
  onDelete: () => void
  onDuplicate: () => void
  onVersions: () => void
  highlight?: string | null
}) {
  const { P, fmtDate } = useToolsData()
  const meta = toolMeta(analysis.fw)
  const isWb = analysis.fw === 'whiteboard'
  const setSection = (sectionId: string, sdata: SectionData) => onChange({ ...analysis, sections: { ...analysis.sections, [sectionId]: sdata } })
  const setElements = (els: WbElement[]) => onChange({ ...analysis, elements: els })
  const vCount = (analysis.versions || []).length
  return (
    <div>
      <div className="crumb" onClick={onBack}><Icon name="cleft" cls="sm" /> Strategy tools · {meta.name}</div>
      <div className="phead" style={{ marginBottom: 18 }}>
        <div className="phead__t">
          <div className="row ac" style={{ gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: meta.ac }}>{meta.name}</span>
            <span className={'badge badge--' + (analysis.status === 'example' ? 'neutral' : 'info')}>{analysis.status === 'example' ? 'Example' : 'Draft'}</span>
          </div>
          <input className="title-edit" style={{ marginTop: 8 }} value={analysis.title} onChange={(e) => onChange({ ...analysis, title: e.target.value })} />
          <div className="row ac" style={{ gap: 9, marginTop: 8, color: 'var(--n-500)', fontSize: 13 }}>
            <Avatar id={analysis.owner} size="xs" /> {P[analysis.owner]?.name ?? analysis.ownerName ?? '—'}
            <span style={{ color: 'var(--n-300)' }}>·</span> {fmtDate(analysis.created)}
            <span style={{ color: 'var(--n-300)' }}>·</span> {countPoints(analysis)}
          </div>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={onDuplicate}><Icon name="copy" cls="sm" /> Duplicate</button>
          <button className="btn sm" onClick={onVersions}><Icon name="clock" cls="sm" /> Versions{vCount > 0 ? ` · ${vCount}` : ''}</button>
          <button className="btn sm" onClick={onDelete}><Icon name="x" cls="sm" /> Delete</button>
          {!isWb && <button className="btn btn--primary sm" onClick={onWalk}><Icon name="compass" cls="sm" /> Guided planner</button>}
        </div>
      </div>
      <div className="humannote" style={{ marginBottom: 16 }}>
        <Icon name="shield" /><p>{isWb ? 'Add sticky notes, text and shapes, then drag to arrange. Save a version anytime to keep a snapshot you can restore.' : 'Click any field to edit. Changes save automatically — use Versions to store, restore or delete named snapshots.'}</p>
      </div>
      <div className="fw-frame">
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--n-900)', marginBottom: 4 }}>{meta.name}</div>
        <div className="fw-meta" style={{ marginBottom: 18 }}>{meta.intro}</div>
        {isWb
          ? <WhiteboardCanvas elements={analysis.elements || []} editable onChange={setElements} />
          : <FrameworkDiagram analysis={analysis} editable onChange={setSection} highlight={highlight} />}
      </div>
    </div>
  )
}

/* ---------------- analysis card ---------------- */
function AnalysisCard({ a, onOpen, onDuplicate }: {
  a: ToolAnalysis
  onOpen: () => void
  onDuplicate?: (() => void) | null
}) {
  const { P } = useToolsData()
  const meta = toolMeta(a.fw)
  const vCount = (a.versions || []).length
  return (
    <div className="an-card" style={{ '--ac': meta.ac } as CSSVars} onClick={onOpen}>
      <div className="row ac" style={{ justifyContent: 'space-between' }}>
        <span className="an-card__fw">{meta.name}</span>
        <span className={'badge badge--' + (a.status === 'example' ? 'neutral' : 'info')}>{a.status === 'example' ? 'Example' : 'Draft'}</span>
      </div>
      <div className="an-card__t">{a.title}</div>
      <div className="an-card__foot">
        <span style={{ fontSize: 12, color: 'var(--n-500)' }} className="row ac"><Avatar id={a.owner} size="xs" />&nbsp;{(P[a.owner]?.name ?? a.ownerName ?? '—').split(' ')[0]}</span>
        <span className="row ac" style={{ gap: 8 }}>
          {vCount > 0 && <span className="an-versions"><Icon name="clock" cls="xs" /> {vCount}</span>}
          <span style={{ fontSize: 12, color: 'var(--n-500)' }}>{countPoints(a)}</span>
        </span>
      </div>
      {onDuplicate && (
        <div className="insp-actions">
          <button className="btn sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onOpen() }}><Icon name="search" cls="sm" /> View</button>
          <button className="btn btn--primary sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onDuplicate() }}><Icon name="copy" cls="sm" /> Use as template</button>
        </div>
      )}
    </div>
  )
}

/* ---------------- list + board rows ---------------- */
function ToolListRow({ a, onOpen }: { a: ToolAnalysis; onOpen: () => void }) {
  const { P } = useToolsData()
  const meta = toolMeta(a.fw); const vCount = (a.versions || []).length
  return (
    <div className="fw-lrow" onClick={onOpen}>
      <span className="fw-lic" style={{ background: meta.ac }}><Icon name={meta.kind === 'whiteboard' ? 'grid' : 'clip'} cls="sm" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fw-lt">{a.title}</div>
        <div className="fw-lm">{meta.name} · {(P[a.owner]?.name ?? a.ownerName ?? '—').split(' ')[0]} · {countPoints(a)}{vCount ? ` · ${vCount} version${vCount > 1 ? 's' : ''}` : ''}</div>
      </div>
      <span className={'badge badge--' + (a.status === 'example' ? 'neutral' : 'info')}>{a.status === 'example' ? 'Example' : 'Draft'}</span>
      <Icon name="cright" cls="sm" style={{ color: 'var(--n-300)' }} />
    </div>
  )
}

/* ---------------- main view ---------------- */
type ViewMode = 'gallery' | 'list' | 'board'

export function FrameworksWorkspace({ mode }: { mode: 'frameworks' | 'whiteboard' }) {
  const toast = useToolsToast()
  const { P, currentUserId, currentUserName } = useToolsData()
  const { analyses, create, update, remove, duplicate, saveVersion, restoreVersion, renameVersion, deleteVersion } = useStrategyToolAnalyses()
  const [openId, setOpenId] = useState<string | null>(null)
  const [walk, setWalk] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [newPanel, setNewPanel] = useState<{ presetFw?: FwKind } | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('gallery') // gallery | list | board

  const open = analyses.find((a) => a.id === openId)
  const updateA = (a: ToolAnalysis) => update(a)
  const createTool = async (fw: FwKind, title: string, owner: string, template?: ToolTemplate) => {
    const a = await create(fw, title, owner, P[owner]?.name ?? '', contentFromTemplate(fw, template))
    if (a) { setNewPanel(null); setOpenId(a.id); setWalk(fw !== 'whiteboard'); toast('Created · ' + toolMeta(fw).name) }
  }
  const duplicateTool = async (src: ToolAnalysis) => {
    const a = await duplicate(src, currentUserId, currentUserName)
    if (a) { setOpenId(a.id); setWalk(false); toast('Duplicated to a new draft') }
  }
  const del = async () => {
    if (open && window.confirm('Delete this tool and all its versions? This cannot be undone.')) {
      await remove(open.id); setOpenId(null); setWalk(false); toast('Deleted')
    }
  }

  // version handlers
  const onSaveVersion = async (label: string, note: string) => {
    if (!open) return
    const by = open.owner || currentUserId
    await saveVersion(open.id, label, note, by, P[by]?.name ?? currentUserName, countPoints(open), toolContent(open))
    toast('Version saved')
  }
  const onRestoreVersion = async (v: ToolVersion) => { if (!open) return; await restoreVersion(open.id, deepClone(v.content)); toast('Restored · ' + v.label) }
  const onRenameVersion = (vid: string, label: string) => { if (!open) return; renameVersion(open.id, vid, label) }
  const onDeleteVersion = async (vid: string) => { if (!open) return; await deleteVersion(open.id, vid); toast('Version removed') }

  if (open) {
    return (
      <div>
        <AnalysisEditor analysis={open} onChange={updateA}
          onBack={() => { setOpenId(null); setWalk(false); setHighlight(null); setShowVersions(false) }}
          onWalk={() => setWalk(true)} onDelete={del} onDuplicate={() => duplicateTool(open)} onVersions={() => setShowVersions(true)}
          highlight={walk ? highlight : null} />
        {walk && open.fw !== 'whiteboard' && <WalkThrough analysis={open}
          onChange={(sid, d) => updateA({ ...open, sections: { ...open.sections, [sid]: d } })}
          onClose={() => { setWalk(false); setHighlight(null) }} onStep={setHighlight} />}
        {showVersions && <VersionsPanel analysis={open} onClose={() => setShowVersions(false)}
          onSave={onSaveVersion} onRestore={onRestoreVersion} onRename={onRenameVersion} onDelete={onDeleteVersion} />}
      </div>
    )
  }

  const isWb = mode === 'whiteboard'
  const modeGroups = isWb ? TOOL_GROUPS.filter((g) => g.ids.includes('whiteboard')) : TOOL_GROUPS.filter((g) => !g.ids.includes('whiteboard'))
  const inMode = (a: ToolAnalysis) => isWb ? a.fw === 'whiteboard' : a.fw !== 'whiteboard'
  const drafts = analyses.filter((a) => a.status !== 'example' && inMode(a))
  const examples = analyses.filter((a) => a.status === 'example' && inMode(a))
  const viewModes: Array<[ViewMode, string]> = [['gallery', 'grid'], ['list', 'align'], ['board', 'kanban']]

  function renderCollection(items: ToolAnalysis[], opts?: { showNew?: boolean; dup?: boolean }) {
    opts = opts || {}
    if (items.length === 0) return <div className="ver-empty" style={{ border: '1px dashed var(--n-300)', borderRadius: 'var(--radius-lg)' }}>Nothing here yet.</div>
    if (viewMode === 'list') return <div className="fw-list">{items.map((a) => <ToolListRow key={a.id} a={a} onOpen={() => setOpenId(a.id)} />)}</div>
    if (viewMode === 'board') return (
      <div className="fw-board">
        {modeGroups.map((g) => {
          const its = items.filter((a) => g.ids.includes(a.fw))
          return (
            <div key={g.label} className="fw-bcol">
              <div className="fw-bch"><span className="t">{g.label}</span><span className="kcol__count">{its.length}</span></div>
              <div className="fw-bbody">
                {its.length === 0 ? <div style={{ fontSize: 12, color: 'var(--n-400)', textAlign: 'center', padding: '8px 0' }}>None</div>
                  : its.map((a) => { const m = toolMeta(a.fw); return (
                    <div key={a.id} className="fw-bcard" style={{ '--ac': m.ac } as CSSVars} onClick={() => setOpenId(a.id)}>
                      <div className="fw-bct">{a.title}</div>
                      <div className="fw-bcm"><Avatar id={a.owner} size="xs" /> {m.name} · {countPoints(a)}</div>
                    </div>
                  ) })}
              </div>
            </div>
          )
        })}
      </div>
    )
    return (
      <div className="an-grid">
        {opts.showNew && <div className="an-new" onClick={() => setNewPanel({ presetFw: isWb ? 'whiteboard' : undefined })}><Icon name="plus" cls="lg" /><div style={{ fontSize: 13, fontWeight: 600 }}>New {isWb ? 'board' : 'tool'}</div></div>}
        {items.map((a) => <AnalysisCard key={a.id} a={a} onOpen={() => setOpenId(a.id)} onDuplicate={opts.dup ? () => duplicateTool(a) : null} />)}
      </div>
    )
  }

  const newFromTemplate = (t: ToolTemplate) => createTool('whiteboard', t.name + ' — ' + fwMonthYear(), currentUserId, t)

  return (
    <div>
      <PageHead
        title={isWb ? 'Whiteboard' : 'Frameworks'}
        sub={isWb
          ? 'A freeform canvas for strategic thinking — start from a ready-made strategic template or a blank board, then store and version it.'
          : 'Analysis frameworks and business canvases. Start from a template, plan it with a guided walkthrough, and store versions as you go.'}
        actions={<div style={{ display: 'contents' }}>
          <div className="fw-viewbar">
            {viewModes.map(([m, ic]) => <button key={m} className={'fw-vbtn' + (viewMode === m ? ' on' : '')} title={m} onClick={() => setViewMode(m)}><Icon name={ic} cls="sm" /></button>)}
          </div>
          {isWb && <TemplateMenu label="New from template" icon="grid" btnClass="btn sm" onPick={newFromTemplate} />}
          <button className="btn btn--primary sm" onClick={() => setNewPanel({ presetFw: isWb ? 'whiteboard' : undefined })}><Icon name="plus" cls="sm" /> {isWb ? 'New board' : 'New tool'}</button>
        </div>} />
      <HumanNote>A {isWb ? 'board' : 'framework'} structures the conversation; it doesn't make the decision. Use it to surface assumptions, then let the leadership team judge.</HumanNote>

      <div style={{ height: 22 }} />
      {isWb ? (
        <div style={{ display: 'contents' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Start from a strategic template</div>
          <div className="fw-pick" style={{ marginBottom: 8 }}>
            {templatesFor('whiteboard').map((t) => (
              <div key={t.id} className="fw-tile" style={{ '--ac': '#2f5d8a' } as CSSVars} onClick={() => t.elements ? newFromTemplate(t) : createTool('whiteboard', 'Whiteboard — ' + fwMonthYear(), currentUserId, t)}>
                <div className="fw-name">{t.name}</div>
                <div className="fw-d">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'contents' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Start a new tool</div>
          {modeGroups.map((g) => (
            <div key={g.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n-500)', marginBottom: 8 }}>{g.label}</div>
              <div className="fw-pick">
                {g.ids.map((id) => { const m = toolMeta(id); return (
                  <div key={id} className="fw-tile" style={{ '--ac': m.ac } as CSSVars} onClick={() => setNewPanel({ presetFw: id as FwKind })}>
                    <div className="fw-name">{m.name}</div>
                    <div className="fw-d">{m.intro}</div>
                  </div>
                ) })}
              </div>
            </div>
          ))}
        </div>
      )}

      {drafts.length > 0 && <div style={{ display: 'contents' }}>
        <div style={{ height: 20 }} />
        <div className="eyebrow" style={{ marginBottom: 12 }}>Your {isWb ? 'boards' : 'tools'} · {drafts.length}</div>
        {renderCollection(drafts, { showNew: true })}
      </div>}

      <div style={{ height: 26 }} />
      <div className="eyebrow" style={{ marginBottom: 4 }}>Inspiration · worked examples</div>
      <div style={{ fontSize: 12.5, color: 'var(--n-500)', marginBottom: 14 }}>Real Pundit Invest {isWb ? 'boards' : 'analyses'} — open to explore, or use one as a template for your own.</div>
      {renderCollection(examples, { dup: true })}

      {newPanel && <NewAnalysisPanel presetFw={newPanel.presetFw} onCreate={createTool} onClose={() => setNewPanel(null)} />}
    </div>
  )
}
