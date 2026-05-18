// Surfaces meeting types whose cadence (per template definition) is
// at risk based on the last completed_at + cadence_hint mapping.
// Derives from rows already loaded into useMeetings — no new queries.

import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Button } from '../../../src/components/ui/Button'
import type { MeetingRow, ResolvedMeetingTemplate } from '../types'

type CadenceHintDays = Record<string, number>

const CADENCE_DAYS: CadenceHintDays = {
  monthly: 31,
  kvartalsvis: 92,
  quarterly: 92,
  halvarlig: 183,
  semiannual: 183,
  arlig: 366,
  annual: 366,
  biennial: 366 * 2,
  ad_hoc: 0,
}

type Warning = {
  templateId: string
  templateLabel: string
  lawRefs: string[]
  cadenceHint: string
  lastCompletedAt: string | null
  daysSince: number
  cadenceWindowDays: number
  overdueDays: number
}

export function CadenceWarningCard({
  meetings,
  templates,
}: {
  meetings: MeetingRow[]
  templates: ResolvedMeetingTemplate[]
}) {
  // Capture "now" once per mount via lazy useState initialiser (the
  // "impure-call-during-render" lint rule rejects Date.now() in useRef
  // and inside useMemo; a lazy initialiser runs once during mount and is
  // the canonical workaround).
  const [now] = useState<number>(() => Date.now())
  const warnings = useMemo<Warning[]>(() => {
    const out: Warning[] = []
    for (const tpl of templates) {
      const cad = tpl.cadenceHint ?? null
      if (!cad || cad === 'ad_hoc') continue
      const windowDays = CADENCE_DAYS[cad] ?? 0
      if (windowDays === 0) continue
      const ofType = meetings.filter(
        (m) =>
          (tpl.systemTemplateId && m.system_template_id === tpl.systemTemplateId) ||
          (tpl.orgTemplateId && m.org_template_id === tpl.orgTemplateId),
      )
      const lastCompleted = ofType
        .filter((m) => m.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0]
      const lastCompletedAt = lastCompleted?.completed_at ?? null
      const daysSince = lastCompletedAt
        ? Math.floor((now - new Date(lastCompletedAt).getTime()) / 86400000)
        : Number.POSITIVE_INFINITY
      const hasPlannedFuture = ofType.some(
        (m) => m.status === 'planned' && m.scheduled_at && new Date(m.scheduled_at).getTime() > now,
      )
      if (hasPlannedFuture) continue
      if (daysSince <= windowDays) continue
      out.push({
        templateId: tpl.key,
        templateLabel: tpl.name,
        lawRefs: tpl.lawRefs ?? [],
        cadenceHint: cad,
        lastCompletedAt,
        daysSince: Number.isFinite(daysSince) ? daysSince : 0,
        cadenceWindowDays: windowDays,
        overdueDays: Number.isFinite(daysSince) ? Math.max(0, daysSince - windowDays) : 0,
      })
    }
    return out.sort((a, b) => b.overdueDays - a.overdueDays).slice(0, 6)
  }, [meetings, templates, now])

  if (warnings.length === 0) return null

  return (
    <ModuleSectionCard className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Kadens-varsler — {warnings.length} møtetyper mangler planlegging
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600">
            Disse møtetypene har overskredet anbefalt kadens og har ingen planlagte møter framover.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {warnings.map((w) => (
          <li
            key={w.templateId}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">{w.templateLabel}</p>
              <p className="mt-0.5 text-[11px] text-neutral-600">
                {w.lawRefs.length > 0 ? (
                  <span className="font-mono">{w.lawRefs.join(' · ')}</span>
                ) : null}
                {w.lawRefs.length > 0 ? ' · ' : ''}
                {w.lastCompletedAt
                  ? `Sist gjennomført for ${w.daysSince} dager siden`
                  : 'Ingen tidligere møter funnet'}
                {w.overdueDays > 0 ? ` · ${w.overdueDays} dager over kadens` : ''}
              </p>
            </div>
            <Link to={`/meetings?template=${encodeURIComponent(w.templateId)}`}>
              <Button variant="secondary" size="sm">
                Planlegg →
              </Button>
            </Link>
          </li>
        ))}
      </ul>
    </ModuleSectionCard>
  )
}
