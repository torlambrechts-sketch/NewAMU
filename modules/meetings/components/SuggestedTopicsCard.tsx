// SuggestedTopicsCard — auto-detected agenda topics from framework signals.
//
// When the resolver finds signals NOT covered by the agenda (e.g. 5
// critical incidents but no `incidents` agenda item), this card lists
// them and lets the chair add each as a manual agenda item with one
// click. The new item carries the binding so its data flows the moment
// it's created.
//
// Rendered at the top of the Agenda tab so it surfaces BEFORE the
// existing items — the chair sees "you might want to add X" first.

import { useState } from 'react'
import { Lightbulb, Plus } from 'lucide-react'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import {
  SIGNAL_LABEL,
  severityFor,
  type SignalSeverity,
} from '../lib/frameworkSignals'
import type {
  MeetingDataBinding,
  RenderedBindingResult,
} from '../types'

export type SuggestedTopic = {
  source: MeetingDataBinding['source']
  snapshot: RenderedBindingResult
  severity: SignalSeverity
}

export type SuggestedTopicsCardProps = {
  signals: Map<MeetingDataBinding['source'], RenderedBindingResult>
  locked: boolean
  onAddTopic: (topic: SuggestedTopic) => Promise<void>
}

const SEVERITY_BADGE: Record<SignalSeverity, 'info' | 'warning' | 'critical'> = {
  info: 'info',
  warn: 'warning',
  critical: 'critical',
}

const SEVERITY_HINT: Record<SignalSeverity, string> = {
  info: 'Vurder å ta med saken',
  warn: 'Sak bør tas opp',
  critical: 'Krever oppfølging',
}

export function SuggestedTopicsCard({
  signals,
  locked,
  onAddTopic,
}: SuggestedTopicsCardProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  if (locked) return null

  // Only suggest signals with non-trivial severity (warn/critical) and
  // skip ones the user has dismissed in this session.
  const topics: SuggestedTopic[] = []
  for (const [source, snapshot] of signals) {
    if (dismissed.has(source)) continue
    const severity = severityFor(snapshot)
    if (severity === 'info') continue
    topics.push({ source, snapshot, severity })
  }
  if (topics.length === 0) return null

  // Sort critical first, then warn.
  topics.sort((a, b) => {
    const order: Record<SignalSeverity, number> = { critical: 0, warn: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <ModuleSectionCard className="border-amber-200 bg-amber-50/40 p-5">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">
            Foreslåtte saker fra systemet
          </h3>
          <p className="mt-1 text-xs text-neutral-700">
            Disse signalene har data i perioden, men er ikke på agendaen ennå.
            Trykk «Legg til» for å materialisere som ny sak med ferdig sammendrag.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {topics.map((topic) => {
          const label = SIGNAL_LABEL[topic.source]
          const title = label?.topic ?? topic.source
          const summaryFirstLine = topic.snapshot.summaryMarkdown.split('\n')[0]
          return (
            <li
              key={topic.source}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200/70 bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{title}</p>
                  <Badge variant={SEVERITY_BADGE[topic.severity]}>
                    {SEVERITY_HINT[topic.severity]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-neutral-700">{summaryFirstLine}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  disabled={busyKey === topic.source}
                  onClick={async () => {
                    setBusyKey(topic.source)
                    try {
                      await onAddTopic(topic)
                    } finally {
                      setBusyKey(null)
                    }
                  }}
                >
                  Legg til
                </Button>
                <button
                  type="button"
                  onClick={() =>
                    setDismissed((prev) => {
                      const next = new Set(prev)
                      next.add(topic.source)
                      return next
                    })
                  }
                  className="rounded px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  title="Avvis forslaget for denne økten"
                >
                  Avvis
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </ModuleSectionCard>
  )
}
