/**
 * Layout-reference Scorecard (Pinpoint) — cream surface, serif titles, filter strip, candidate-style cards.
 * Used by Action Board without the mock HubMenu1Bar / top utility bar.
 */
import { type DragEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, GripVertical } from 'lucide-react'
import { MODULE_LABELS } from '../../lib/taskNavigation'
import type { TaskModule, TaskStatus } from '../../types/task'

export const AB_SCORECARD_CREAM = '#F9F7F2'
export const AB_SCORECARD_CREAM_DEEP = '#EFE8DC'
export const AB_SCORECARD_FOREST = '#1a3d32'
export const AB_SCORECARD_SERIF = "'Libre Baskerville', Georgia, serif"

export type ActionBoardSource =
  | 'task'
  | 'sick_leave_milestone'
  | 'training_expiry'
  | 'incident'
  | 'ros_risk'
  | 'inspection'
  | 'sja'
  | 'amu_compliance'

export type ActionBoardScorecardItem = {
  id: string
  source: ActionBoardSource
  title: string
  detail?: string
  status: TaskStatus
  module: string
  link: string
  dueDate?: string
  overdue?: boolean
  isDraggable: boolean
  taskId?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

const SOURCE_LABELS: Record<ActionBoardSource, string> = {
  task: 'Oppgave',
  sick_leave_milestone: 'Sykefravær',
  training_expiry: 'Opplæring',
  incident: 'Hendelse',
  ros_risk: 'ROS-risiko',
  inspection: 'Inspeksjon',
  sja: 'SJA',
  amu_compliance: 'AMU-sjekkliste',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Å gjøre',
  in_progress: 'Pågår',
  done: 'Fullført',
}

function moduleLabel(m: string) {
  return MODULE_LABELS[m as TaskModule] ?? m
}

/** Map status to a 0–5 bar like layout-reference score rows */
function statusBarValue(status: TaskStatus, overdue?: boolean): number {
  if (overdue && status !== 'done') return 1.2
  if (status === 'done') return 5
  if (status === 'in_progress') return 3.25
  return 1.75
}

function completionPercent(status: TaskStatus, overdue?: boolean): number {
  if (overdue && status !== 'done') return 12
  if (status === 'done') return 100
  if (status === 'in_progress') return 58
  return 28
}

function DemoScoreBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full bg-neutral-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm tabular-nums text-neutral-800">{value.toFixed(2)}</span>
    </div>
  )
}

function WhiteCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-neutral-200/80 bg-white shadow-sm ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

export function ActionBoardBreadcrumb({
  items,
}: {
  items: ({ label: string; to?: string } | string)[]
}) {
  return (
    <p className="text-xs text-neutral-500">
      {items.map((raw, i) => {
        const seg = typeof raw === 'string' ? { label: raw } : raw
        const inner =
          seg.to != null ? (
            <Link to={seg.to} className="hover:text-neutral-700">
              {seg.label}
            </Link>
          ) : (
            seg.label
          )
        return (
          <span key={`${i}-${seg.label}`}>
            {i > 0 ? <span className="mx-1.5 text-neutral-300">›</span> : null}
            {inner}
          </span>
        )
      })}
    </p>
  )
}

export function ActionBoardSerifTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`font-semibold tracking-tight text-neutral-900 ${className}`}
      style={{ fontFamily: AB_SCORECARD_SERIF }}
    >
      {children}
    </h1>
  )
}

export function ActionBoardSerifHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-semibold text-neutral-900 ${className}`} style={{ fontFamily: AB_SCORECARD_SERIF }}>
      {children}
    </h2>
  )
}

export function ActionBoardPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'orange' | 'blue' | 'tan' | 'red'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-800',
    green: 'bg-emerald-100 text-emerald-900',
    orange: 'bg-orange-100 text-orange-900',
    blue: 'bg-sky-100 text-sky-900',
    tan: 'bg-amber-100/90 text-amber-950',
    red: 'bg-red-100 text-red-900',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function moduleBarSeed(moduleKey: string): number {
  let h = 0
  for (let i = 0; i < moduleKey.length; i++) h = (h + moduleKey.charCodeAt(i) * (i + 1)) % 17
  return 2.5 + (h % 13) / 10
}

export function ActionBoardTaskScorecardCard({
  item,
  sourceLabel,
  sourceColourClass,
  dragTaskId,
  onDragStart,
  onDragEnd,
  showDetail = true,
}: {
  item: ActionBoardScorecardItem
  sourceLabel: string
  sourceColourClass: string
  dragTaskId: string | null
  onDragStart: (e: DragEvent, taskId: string) => void
  onDragEnd: () => void
  /** When false, hides Modulkobling / Statusfremdrift / Hastegrad (Tiltak block). */
  showDetail?: boolean
}) {
  const pct = completionPercent(item.status, item.overdue)
  const barVal = statusBarValue(item.status, item.overdue)
  const urgencyBar = item.overdue ? 1.25 : item.severity === 'critical' ? 1.5 : 3.75
  const skills: [string, ReactNode][] = [
    ['Modulkobling', <DemoScoreBar key="m" value={moduleBarSeed(item.module)} />],
    ['Statusfremdrift', <DemoScoreBar key="k" value={barVal} />],
    ['Hastegrad (visuell)', <DemoScoreBar key="s" value={urgencyBar} />],
  ]

  const card = (
    <WhiteCard
      className={`overflow-hidden p-0 ${item.isDraggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        dragTaskId === item.taskId ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3">
        <input type="checkbox" className="mt-1 rounded border-neutral-300" aria-label={`Velg ${item.title}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.isDraggable ? <GripVertical className="size-3.5 shrink-0 text-neutral-400" aria-hidden /> : null}
            <p className="font-semibold text-neutral-900">{item.title}</p>
          </div>
          {item.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{item.detail}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Oppfølging</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: AB_SCORECARD_FOREST }}>
            {pct}%
          </p>
        </div>
      </div>
      <div className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${sourceColourClass}`}>{sourceLabel}</span>
          <span className="inline-flex rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900">
            {STATUS_LABELS[item.status]}
          </span>
          {item.overdue ? <ActionBoardPill tone="red">Forfalt</ActionBoardPill> : null}
          {item.severity === 'critical' ? <ActionBoardPill tone="red">Kritisk</ActionBoardPill> : null}
        </div>
      </div>
      {showDetail ? (
        <div className="border-t border-neutral-100" style={{ backgroundColor: 'rgba(245, 230, 211, 0.45)' }}>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-700">Tiltak</span>
            <span className="flex items-center gap-2 text-xs text-neutral-600">
              {moduleLabel(item.module)}
              <span className="flex size-6 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                {barVal.toFixed(1)}
              </span>
            </span>
          </div>
          <div className="space-y-2.5 px-4 pb-4 pt-1">
            {skills.map(([label, node]) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className="w-36 shrink-0 text-xs text-neutral-600 sm:w-44">{label}</span>
                {node}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3">
        {item.dueDate ? (
          <span
            className={`flex items-center gap-1 text-xs ${item.overdue ? 'font-medium text-red-600' : 'text-neutral-500'}`}
          >
            <Calendar className="size-3.5 shrink-0" />
            {new Date(item.dueDate).toLocaleDateString('no-NO', { dateStyle: 'short' })}
          </span>
        ) : (
          <span className="text-xs text-neutral-400">Ingen frist</span>
        )}
        <Link to={item.link} className="text-xs font-semibold uppercase tracking-wide text-[#1a3d32] hover:underline">
          Åpne kilde →
        </Link>
      </div>
    </WhiteCard>
  )

  if (item.isDraggable && item.taskId) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, item.taskId!)}
        onDragEnd={onDragEnd}
        className="touch-none"
      >
        {card}
      </div>
    )
  }

  return card
}

export { SOURCE_LABELS as ACTION_BOARD_SOURCE_LABELS }
