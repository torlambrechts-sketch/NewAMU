// Kort som representerer én wizard i Compliance Studio.
// Viser status, lawRefs, estimat og åpne-CTA.

import { ArrowRight, CheckCircle2, Clock, PlayCircle, RotateCcw } from 'lucide-react'
import type { StudioWizardEntry } from './studioWizardCatalog'
import type { WizardRunRow } from '../../../hooks/useWizardRun'
import { Button } from '../../../components/ui/Button'

const FOREST = '#1a3d32'
const SERIF = "'Libre Baskerville', Georgia, serif"

function statusForRun(run: WizardRunRow | null, totalSteps: number) {
  if (!run) return { kind: 'not_started' as const, label: 'Ikke startet', icon: PlayCircle }
  if (run.completed_at) return { kind: 'completed' as const, label: 'Fullført', icon: CheckCircle2 }
  return {
    kind: 'in_progress' as const,
    label: `Trinn ${Math.min(run.current_step + 1, totalSteps)} av ${totalSteps}`,
    icon: Clock,
  }
}

export function StudioWizardCard({
  entry,
  run,
  totalSteps,
  onOpen,
  onReset,
}: {
  entry: StudioWizardEntry
  run: WizardRunRow | null
  /** Antall trinn i wizardens definisjon — for «X av Y». */
  totalSteps: number
  onOpen: () => void
  onReset: () => void
}) {
  const status = statusForRun(run, totalSteps)
  const StatusIcon = status.icon

  const ctaLabel =
    status.kind === 'not_started'
      ? 'Start'
      : status.kind === 'in_progress'
        ? 'Fortsett'
        : 'Åpne på nytt'

  const statusClass =
    status.kind === 'completed'
      ? 'bg-emerald-100 text-emerald-900'
      : status.kind === 'in_progress'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-neutral-100 text-neutral-700'

  return (
    <article className="flex flex-col rounded-lg border border-neutral-200/80 bg-white p-5 shadow-sm">
      <header className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {entry.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="text-lg font-semibold text-neutral-900"
            style={{ fontFamily: SERIF }}
          >
            {entry.title}
          </h3>
          <p className="mt-0.5 text-sm text-neutral-600">{entry.description}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}
        >
          <StatusIcon className="size-3.5" aria-hidden />
          {status.label}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap gap-1">
        {entry.lawRefs.slice(0, 6).map((ref) => (
          <span
            key={ref}
            className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-neutral-700"
          >
            {ref}
          </span>
        ))}
        {entry.lawRefs.length > 6 ? (
          <span className="text-[10px] text-neutral-500">
            +{entry.lawRefs.length - 6} til
          </span>
        ) : null}
      </div>

      {entry.prerequisites && entry.prerequisites.length > 0 ? (
        <p className="mt-3 text-[11px] text-neutral-500">
          Forutsetning: {entry.prerequisites.join(' · ')}
        </p>
      ) : null}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-4">
        <p className="text-[11px] text-neutral-500">~ {entry.estimateMinutes} min</p>
        <div className="flex items-center gap-2">
          {status.kind !== 'not_started' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              aria-label="Start på nytt"
            >
              <RotateCcw className="size-3.5" />
              Nullstill
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: FOREST }}
          >
            {ctaLabel}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </footer>
    </article>
  )
}
