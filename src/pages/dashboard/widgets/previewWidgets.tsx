// Preview-widget: kalender + kommende oppgaver.

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useDashboardData } from '../useDashboardData'
import { Chip, EmptyState, KpiStrip, WidgetCard } from './widgetShared'

const DOW_NB = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS_NB_FULL = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']

function dotColourFor(t: { source_category: string; status: string; law_refs: string[] }): string {
  if (t.status === 'cancelled') return 'bg-neutral-300'
  if (t.law_refs.some((l) => l.startsWith('AML § 4-6'))) return 'bg-[#B8761F]' // sykefravær amber
  if (t.law_refs.some((l) => l.startsWith('AML § 4-3'))) return 'bg-[#5A2F6F]' // psykososial plum
  if (t.law_refs.some((l) => l.startsWith('AML § 3'))) return 'bg-[#3F6B4F]' // systematisk moss
  if (t.law_refs.some((l) => l.startsWith('AML § 7') || l.startsWith('AML § 8'))) return 'bg-[#BA0C2F]' // AMU norge
  if (t.source_category === 'avvik') return 'bg-[#A03826]'
  return 'bg-[#3B5BDB]'
}

function buildCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  // Convert: 0 (Sun) → 6 (Sun last in DOW_NB array), 1 (Mon) → 0
  const offset = (first.getDay() + 6) % 7
  const days: { date: number; weekend: boolean; today: boolean; month: 'cur' | 'prev' | 'next' }[] = []
  const today = new Date()
  // leading from prev month
  for (let i = 0; i < offset; i++) {
    const d = new Date(year, month, -offset + i + 1)
    days.push({ date: d.getDate(), weekend: d.getDay() === 0 || d.getDay() === 6, today: false, month: 'prev' })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d)
    const isToday = date.toDateString() === today.toDateString()
    days.push({ date: d, weekend: date.getDay() === 0 || date.getDay() === 6, today: isToday, month: 'cur' })
  }
  // trailing
  while (days.length % 7 !== 0) {
    const next = new Date(year, month + 1, days.length - last.getDate() - offset + 1)
    days.push({ date: next.getDate(), weekend: next.getDay() === 0 || next.getDay() === 6, today: false, month: 'next' })
  }
  return days
}

export function PreviewCalendarWidget() {
  const data = useDashboardData()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const monthTasks = useMemo(() => {
    return data.tasks.filter((t) => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [data.tasks, year, month])

  const days = useMemo(() => buildCalendarDays(year, month), [year, month])

  const tasksByDay = useMemo(() => {
    const m = new Map<number, typeof monthTasks>()
    for (const t of monthTasks) {
      const d = new Date(t.due_date!).getDate()
      const arr = m.get(d) ?? []
      arr.push(t)
      m.set(d, arr)
    }
    return m
  }, [monthTasks])

  // Upcoming list — task_items with due_date >= today, capped at 14
  const upcoming = useMemo(() => {
    return data.tasks
      .filter((t) => t.due_date && new Date(t.due_date) >= new Date())
      .slice(0, 14)
  }, [data.tasks])

  const overdueAll = data.tasks.filter((t) => t.due_date && new Date(t.due_date) < today && t.status !== 'closed').length
  const upcomingAll = data.tasks.filter((t) => t.due_date && new Date(t.due_date) >= today).length

  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: 'Frister kommende', value: upcomingAll, sub: 'fra i dag', tone: 'default' },
          { label: 'Forsinket', value: overdueAll, sub: 'over frist', tone: overdueAll > 0 ? 'warn' : 'success' },
          { label: 'Denne måneden', value: monthTasks.length, sub: MONTHS_NB_FULL[month] },
          { label: 'Total i kø', value: data.tasks.filter((t) => t.status !== 'closed').length, sub: 'aktive task_items', tone: 'dark' },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
        <WidgetCard
          title={`${MONTHS_NB_FULL[month]} ${year}`}
          subtitle={`${monthTasks.length} oppgaver med frist denne måneden`}
          rightSlot={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  if (month === 0) { setYear(year - 1); setMonth(11) }
                  else setMonth(month - 1)
                }}
                className="h-auto rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50"
                aria-label="Forrige måned"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  if (month === 11) { setYear(year + 1); setMonth(0) }
                  else setMonth(month + 1)
                }}
                className="h-auto rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50"
                aria-label="Neste måned"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1">
            {DOW_NB.map((d) => (
              <div key={d} className="py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                {d}
              </div>
            ))}
            {days.map((d, i) => {
              const tasks = d.month === 'cur' ? (tasksByDay.get(d.date) ?? []) : []
              const dim = d.month !== 'cur'
              return (
                <div
                  key={i}
                  className={`flex aspect-square flex-col items-start rounded border p-1.5 text-[11px] ${
                    d.today ? 'bg-[#0A1628] text-white border-transparent'
                    : dim ? 'bg-neutral-50/50 text-neutral-300 border-transparent'
                    : d.weekend ? 'bg-white text-neutral-300 border-transparent'
                    : 'bg-neutral-50 border-transparent text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <span>{d.date}</span>
                  {tasks.length > 0 && (
                    <span className="mt-auto flex flex-wrap gap-1">
                      {tasks.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className={`h-1.5 w-1.5 rounded-full ${dotColourFor(t)}`}
                          title={t.title}
                        />
                      ))}
                      {tasks.length > 3 ? <span className="text-[8px] text-neutral-400">+{tasks.length - 3}</span> : null}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-[10.5px] text-neutral-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#BA0C2F]" />AMU / lovkrav</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#3F6B4F]" />Rutine</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#B8761F]" />Sykefravær</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#5A2F6F]" />Psykososial</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#3B5BDB]" />Annet</span>
          </div>
        </WidgetCard>

        <WidgetCard title="Kommende oppgaver" subtitle={`${upcoming.length} av ${upcomingAll}`}>
          {upcoming.length === 0 ? (
            <EmptyState Icon={CalendarDays} title="Tomt" body="Ingen oppgaver med fremtidige frister." />
          ) : (
            <div className="divide-y divide-neutral-100">
              {upcoming.slice(0, 10).map((t) => {
                const due = new Date(t.due_date!)
                return (
                  <div key={t.id} className="flex items-start gap-3 py-2.5">
                    <div className="w-12 shrink-0 text-center">
                      <div className="font-serif text-[20px] font-medium leading-none">{due.getDate().toString().padStart(2, '0')}</div>
                      <div className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-neutral-500">
                        {due.toLocaleDateString('nb-NO', { month: 'short' })}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-[12.5px] font-medium text-neutral-900">{t.title}</div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">
                        → {t.assignee_name ?? '—'} · {t.source_category}
                      </div>
                    </div>
                    {t.priority === 'high' || t.priority === 'critical' ? <Chip tone="danger">Høy</Chip> : null}
                  </div>
                )
              })}
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  )
}
