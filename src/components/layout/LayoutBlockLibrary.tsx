/**
 * LayoutBlockLibrary — renders all generic page-layout blocks.
 *
 * Each block is identified by a string `blockId` (matching BLOCK_DEFS below).
 * Data-driven blocks (scoreStatRow, kpiInfoBoxes, etc.) accept `textOverride`
 * and `blockProps` so admins can customise them from InPageLayoutEditor.
 *
 * Blocks that need live module data (table1, vernerunderScheduleCalendar, etc.)
 * are NOT rendered here — those are delegated to the owning page's `renderBlock`.
 *
 * Usage:
 *   const rendered = renderLibraryBlock({ blockId, textOverride, blockProps })
 *   if (rendered !== UNHANDLED) return rendered
 *   // fall through to page-specific block
 */

import { useState } from 'react'
import { AlertTriangle, Info, MoreHorizontal } from 'lucide-react'
import { WorkplaceNoticePanel } from './WorkplaceNoticePanel'
import { WorkplaceEditableNoticeList, type AgendaListItem } from './WorkplaceEditableNoticeList'
import { LayoutScoreStatRow } from './LayoutScoreStatRow'
import type { LayoutScoreStatItem } from './platformLayoutKit'
import type { RenderBlockProps } from './PageLayoutRenderer'
import type { PageLayoutBlockDef } from '../../types/pageLayout'

/* ── Constants ─────────────────────────────────────────────────────────────── */

const FOREST = '#1a3d32'
const CREAM_DEEP = '#EFE8DC'
const CARD = 'overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

/* ── Sentinel for "not handled by library" ─────────────────────────────────── */
export const UNHANDLED = Symbol('UNHANDLED')

/* ── Shared default text ───────────────────────────────────────────────────── */

function t(override: Record<string, string> | undefined, key: string, fallback: string): string {
  return override?.[key]?.trim() || fallback
}

/* ── Block: pageHeading1 ───────────────────────────────────────────────────── */

function PageHeading1Block({ textOverride }: RenderBlockProps) {
  const title = t(textOverride, 'title', 'Sidetittel')
  const description = t(textOverride, 'description', 'Ingresstekst for siden vises her.')
  const breadcrumb = t(textOverride, 'breadcrumb', 'Hjem › Side')

  return (
    <div className="space-y-1 pb-2">
      {breadcrumb && (
        <nav aria-label="Brødsmule" className="text-xs text-neutral-400">
          {breadcrumb}
        </nav>
      )}
      <h1
        className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
      >
        {title}
      </h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-neutral-600">{description}</p>}
    </div>
  )
}

/* ── Block: hubMenu1Bar ────────────────────────────────────────────────────── */

function HubMenu1BarBlock({ textOverride }: RenderBlockProps) {
  const raw = t(textOverride, 'tabs', 'Oversikt,Detaljer,Innstillinger')
  const tabs = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const [active, setActive] = useState(0)

  return (
    <nav
      aria-label="Sidenavigasjon"
      className="flex min-w-0 gap-1 overflow-x-auto border-b border-neutral-200 pb-0"
    >
      {tabs.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => setActive(i)}
          className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            active === i
              ? 'border-[#1a3d32] text-[#1a3d32]'
              : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

/* ── Block: kpiInfoBoxes (1–6 boxes) ──────────────────────────────────────── */

const DEFAULT_KPI_ITEMS: LayoutScoreStatItem[] = [
  { big: '12', title: 'Åpne', sub: 'Trenger handling' },
  { big: '48', title: 'Fullført', sub: 'Denne måneden' },
  { big: '3', title: 'Varsler', sub: 'Krever oppmerksomhet' },
  { big: '5', title: 'Frister', sub: 'Denne uken' },
  { big: '98', title: 'Oppfylt %', sub: 'Siste kvartal' },
  { big: '2', title: 'Avvik', sub: 'Under oppfølging' },
]

function KpiInfoBoxesBlock({ textOverride, blockProps }: RenderBlockProps) {
  const boxCount = Math.min(6, Math.max(1, Number(blockProps?.boxCount ?? 3)))
  const items: LayoutScoreStatItem[] = Array.from({ length: boxCount }, (_, i) => ({
    big: t(textOverride, `box${i + 1}_big`, DEFAULT_KPI_ITEMS[i]?.big ?? '-'),
    title: t(textOverride, `box${i + 1}_title`, DEFAULT_KPI_ITEMS[i]?.title ?? `Boks ${i + 1}`),
    sub: t(textOverride, `box${i + 1}_sub`, DEFAULT_KPI_ITEMS[i]?.sub ?? ''),
  }))
  return <LayoutScoreStatRow items={items} />
}

/* ── Block: noticeInfo ─────────────────────────────────────────────────────── */

function NoticeInfoBlock({ textOverride }: RenderBlockProps) {
  const title = t(textOverride, 'title', 'Informasjon')
  const body = t(textOverride, 'body', 'Skriv inn din informasjonstekst her. Synlig for alle brukere på siden.')
  return (
    <WorkplaceNoticePanel
      variant="info"
      title={title}
      bodySlot={<p className="text-sm leading-relaxed text-neutral-700">{body}</p>}
    />
  )
}

/* ── Block: noticeWarning ──────────────────────────────────────────────────── */

function NoticeWarningBlock({ textOverride }: RenderBlockProps) {
  const title = t(textOverride, 'title', 'Advarsel')
  const body = t(textOverride, 'body', 'Skriv inn din advarseltekst her. Brukes for viktige beskjeder som krever oppmerksomhet.')
  return (
    <WorkplaceNoticePanel
      variant="warning"
      title={title}
      bodySlot={<p className="text-sm leading-relaxed text-neutral-800">{body}</p>}
    />
  )
}

/* ── Block: agendaBuilderList ──────────────────────────────────────────────── */

const DEMO_AGENDA: AgendaListItem[] = [
  { id: 'a1', title: 'Åpning og godkjenning av innkalling', subtitle: '5 min' },
  { id: 'a2', title: 'Gjennomgang av siste møtereferat', subtitle: '10 min' },
  { id: 'a3', title: 'Orienteringssaker', subtitle: '15 min' },
  { id: 'a4', title: 'Beslutningssaker', subtitle: '20 min' },
  { id: 'a5', title: 'Eventuelt', subtitle: '5 min' },
]

function AgendaBuilderBlock({ textOverride }: RenderBlockProps) {
  const title = t(textOverride, 'title', 'Agenda')
  const [items, setItems] = useState<AgendaListItem[]>(DEMO_AGENDA)
  return (
    <WorkplaceEditableNoticeList
      title={title}
      badge={items.length}
      items={items}
      onChange={setItems}
    />
  )
}

/* ── Block: reportingDonutOneRow ───────────────────────────────────────────── */

type DonutRow = { label: string; count: number; color: string }

function DonutOneRowBlock({ textOverride, blockProps }: RenderBlockProps) {
  const title = t(textOverride, 'title', 'Fordeling')
  const subtitle = t(textOverride, 'subtitle', 'Siste periode')

  const rawRows = blockProps?.rows as DonutRow[] | undefined
  const rows: DonutRow[] = rawRows ?? [
    { label: 'Kategori A', count: 4, color: '#22c55e' },
    { label: 'Kategori B', count: 3, color: '#3b82f6' },
    { label: 'Kategori C', count: 6, color: '#f97316' },
    { label: 'Annet', count: 4, color: '#a855f7' },
  ]

  const total = rows.reduce((s, r) => s + r.count, 0)
  let acc = 0
  const cone = rows.map((r) => {
    const start = total > 0 ? (acc / total) * 360 : 0
    acc += r.count
    const end = total > 0 ? (acc / total) * 360 : 0
    return `${r.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`
  }).join(', ')

  return (
    <div className={CARD} style={CARD_SHADOW}>
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">{title}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
        </div>
        <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Valg">
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      <div className="grid gap-5 p-4 sm:grid-cols-2" style={{ backgroundColor: CREAM_DEEP }}>
        <ul className="min-w-0 divide-y divide-neutral-200/60">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="min-w-0 truncate text-sm text-neutral-800">{r.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 tabular-nums text-sm">
                <span className="font-semibold text-neutral-900">{r.count}</span>
                <span className="w-12 text-right text-xs text-neutral-500">
                  {total > 0 ? `${((r.count / total) * 100).toFixed(0)}%` : '–'}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-center py-2">
          <div className="relative flex size-40 shrink-0 items-center justify-center">
            {total > 0 ? (
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(${cone})` }}
              />
            ) : (
              <div className="absolute inset-0 rounded-full bg-neutral-200" />
            )}
            <div
              className="relative z-10 flex size-[58%] flex-col items-center justify-center rounded-full"
              style={{ backgroundColor: CREAM_DEEP, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Total</span>
              <span className="text-2xl font-bold tabular-nums text-neutral-900">{total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Block: reportingChartsTwoRow (bar + line) ─────────────────────────────── */

function BarLineChartBlock({ textOverride, blockProps }: RenderBlockProps) {
  const leftTitle = t(textOverride, 'leftTitle', 'Fordeling etter kategori')
  const rightTitle = t(textOverride, 'rightTitle', 'Utvikling over tid')

  type BarRow = { label: string; value: number; max: number; color: string }
  const rawBars = blockProps?.bars as BarRow[] | undefined
  const stages: BarRow[] = rawBars ?? [
    { label: 'Kritisk', value: 3, max: 20, color: '#ef4444' },
    { label: 'Høy', value: 8, max: 20, color: '#f97316' },
    { label: 'Middels', value: 12, max: 20, color: '#eab308' },
    { label: 'Lav', value: 5, max: 20, color: '#22c55e' },
  ]

  const rawLine = blockProps?.lineValues as number[] | undefined
  const lineVals: number[] = rawLine ?? [20, 35, 42, 58, 65, 78, 88]

  const w = 360; const h = 88; const pad = 4
  const innerH = h - pad * 2
  const step = w / Math.max(1, lineVals.length - 1)
  const pathD = lineVals.map((val, i) => {
    const x = i * step
    const y = pad + innerH - (val / 100) * innerH
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

  const areaD = lineVals.length > 0
    ? `${pathD} L ${((lineVals.length - 1) * step).toFixed(1)} ${(pad + innerH).toFixed(1)} L 0 ${(pad + innerH).toFixed(1)} Z`
    : ''

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Bar chart */}
      <div className={`${CARD} flex flex-col`} style={CARD_SHADOW}>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">{leftTitle}</p>
          <button type="button" className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100" aria-label="Valg">
            <MoreHorizontal className="size-4" />
          </button>
        </div>
        <ul className="flex-1 divide-y divide-neutral-100 p-4" style={{ backgroundColor: CREAM_DEEP }}>
          {stages.map((s) => (
            <li key={s.label} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
              <span className="w-24 shrink-0 text-sm text-neutral-700">{s.label}</span>
              <span className="w-7 shrink-0 text-sm font-bold tabular-nums text-neutral-900">{s.value}</span>
              <div className="min-h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.min(100, s.max > 0 ? (s.value / s.max) * 100 : 0)}%`, backgroundColor: s.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Line chart */}
      <div className={`${CARD} flex flex-col`} style={CARD_SHADOW}>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">{rightTitle}</p>
          <button type="button" className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100" aria-label="Valg">
            <MoreHorizontal className="size-4" />
          </button>
        </div>
        <div className="flex flex-1 flex-col p-4" style={{ backgroundColor: CREAM_DEEP }}>
          <div className="flex min-h-[120px] flex-1 flex-col justify-end">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full shrink-0" style={{ height: h }} preserveAspectRatio="xMidYMid meet" aria-hidden>
              {[0, 25, 50, 75, 100].map((pct) => {
                const gy = pad + innerH - (pct / 100) * innerH
                return <line key={pct} x1="0" y1={gy} x2={w} y2={gy} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
              })}
              {areaD && (
                <path d={areaD} fill={FOREST} fillOpacity="0.08" />
              )}
              {pathD && (
                <path d={pathD} fill="none" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {lineVals.map((val, i) => (
                <circle
                  key={i}
                  cx={(i * step).toFixed(1)}
                  cy={(pad + innerH - (val / 100) * innerH).toFixed(1)}
                  r="3.5"
                  fill={FOREST}
                />
              ))}
            </svg>
            <div className="mt-2 flex justify-between text-[10px] text-neutral-400">
              <span>Start</span>
              <span>Midt</span>
              <span>Slutt</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Block: richText ─────────────────────────────────────────────────────────── */

function RichTextBlock({ textOverride }: RenderBlockProps) {
  const heading = t(textOverride, 'heading', '')
  const body = t(textOverride, 'body', 'Skriv inn tekst her. Støtter enkel formatering med linjeskift.')
  return (
    <div className="space-y-2">
      {heading && (
        <h2 className="text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          {heading}
        </h2>
      )}
      <div className="text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">{body}</div>
    </div>
  )
}

/* ── Block: infoCard (simple white card with icon) ─────────────────────────── */

function InfoCardBlock({ textOverride, blockProps }: RenderBlockProps) {
  const title = t(textOverride, 'title', 'Informasjonskort')
  const body = t(textOverride, 'body', 'Innhold vises her.')
  const variant = (blockProps?.variant as string | undefined) ?? 'neutral'

  const variantStyle: Record<string, { bg: string; border: string; icon: typeof Info; iconCls: string }> = {
    neutral: { bg: 'bg-white', border: 'border-neutral-200', icon: Info, iconCls: 'text-neutral-400' },
    info: { bg: 'bg-sky-50', border: 'border-sky-200', icon: Info, iconCls: 'text-sky-600' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconCls: 'text-amber-600' },
    success: { bg: 'bg-green-50', border: 'border-green-200', icon: Info, iconCls: 'text-green-600' },
  }
  const v = variantStyle[variant] ?? variantStyle.neutral
  const VIcon = v.icon

  return (
    <div className={`rounded-xl border ${v.border} ${v.bg} p-4`}>
      <div className="flex gap-3">
        <VIcon className={`mt-0.5 size-5 shrink-0 ${v.iconCls}`} />
        <div className="min-w-0 space-y-1">
          {title && <p className="text-sm font-semibold text-neutral-900">{title}</p>}
          <p className="text-sm leading-relaxed text-neutral-700">{body}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

type BlockRenderer = (props: RenderBlockProps) => React.ReactNode

const BLOCK_RENDERERS: Record<string, BlockRenderer> = {
  pageHeading1: PageHeading1Block,
  hubMenu1Bar: HubMenu1BarBlock,
  kpiInfoBoxes: KpiInfoBoxesBlock,
  noticeInfo: NoticeInfoBlock,
  noticeWarning: NoticeWarningBlock,
  agendaBuilderList: AgendaBuilderBlock,
  reportingDonutOneRow: DonutOneRowBlock,
  reportingChartsTwoRow: BarLineChartBlock,
  richText: RichTextBlock,
  infoCard: InfoCardBlock,
}

/**
 * Render a block from the library. Returns `UNHANDLED` if the blockId
 * is not registered here — caller should handle it themselves.
 */
export function renderLibraryBlock(props: RenderBlockProps): React.ReactNode | typeof UNHANDLED {
  const renderer = BLOCK_RENDERERS[props.blockId]
  if (!renderer) return UNHANDLED
  return renderer(props)
}

/* ── Block Definitions (for the editor's block picker) ──────────────────── */

export const LIBRARY_BLOCK_DEFS: PageLayoutBlockDef[] = [
  // Navigation
  {
    id: 'pageHeading1',
    label: 'Overskrift 1 — tittel + beskrivelse',
    description: 'Brødsmule, serif H1 og ingresstekst.',
    editableTextKeys: ['breadcrumb', 'title', 'description'],
    defaultColSpan: 12,
  },
  {
    id: 'hubMenu1Bar',
    label: 'Overskrift 1 — hub / faner',
    description: 'Fanelinje. Skriv inn fane-navn adskilt med komma.',
    editableTextKeys: ['tabs'],
    defaultColSpan: 12,
  },
  // KPI / Statistics
  {
    id: 'scoreStatRow',
    label: 'Stat-rad — KPI-bokser (fra moduldata)',
    description: 'KPI-bokser fylt med live moduldata (antall avhenger av fanen).',
    defaultColSpan: 12,
  },
  {
    id: 'kpiInfoBoxes',
    label: 'Boks — informasjon (KPI-rad, velg antall)',
    description: '1–6 KPI-bokser med egendefinert tekst. Sett antall i «Bokser»-feltet.',
    editableTextKeys: [
      'box1_big', 'box1_title', 'box1_sub',
      'box2_big', 'box2_title', 'box2_sub',
      'box3_big', 'box3_title', 'box3_sub',
      'box4_big', 'box4_title', 'box4_sub',
      'box5_big', 'box5_title', 'box5_sub',
      'box6_big', 'box6_title', 'box6_sub',
    ],
    defaultColSpan: 12,
  },
  // Notices
  {
    id: 'noticeInfo',
    label: 'Boks — informasjon',
    description: 'Blå info-boks med tittel og brødtekst.',
    editableTextKeys: ['title', 'body'],
    defaultColSpan: 12,
  },
  {
    id: 'noticeWarning',
    label: 'Boks — advarsel',
    description: 'Amber varsel-boks med tittel og brødtekst.',
    editableTextKeys: ['title', 'body'],
    defaultColSpan: 12,
  },
  {
    id: 'infoCard',
    label: 'Boks — informasjonskort (enkel)',
    description: 'Hvitt kort med ikon. Variant: neutral, info, warning, success.',
    editableTextKeys: ['title', 'body'],
    defaultColSpan: 6,
  },
  // Agenda
  {
    id: 'agendaBuilderList',
    label: 'Liste — agenda (redigerbar)',
    description: 'Dra-og-slipp agenda med tittel og tid per punkt.',
    editableTextKeys: ['title'],
    defaultColSpan: 8,
  },
  // Text
  {
    id: 'richText',
    label: 'Tekst — fritekst',
    description: 'Overskrift + brødtekst med linjeskift.',
    editableTextKeys: ['heading', 'body'],
    defaultColSpan: 8,
  },
  // Charts
  {
    id: 'reportingDonutOneRow',
    label: 'Graf — donut (fordeling)',
    description: 'Liste med prikker + donut med total i midten.',
    editableTextKeys: ['title', 'subtitle'],
    defaultColSpan: 6,
  },
  {
    id: 'reportingChartsTwoRow',
    label: 'Graf — søyler + linje',
    description: 'To paneler: horisontale søyler (venstre) og linjegraf (høyre).',
    editableTextKeys: ['leftTitle', 'rightTitle'],
    defaultColSpan: 12,
  },
]

export { type RenderBlockProps }
