// Empty-state for SentenceBuilder when the rule has no flow yet.
//
// Three tiles per Run 1's empty-state design: start from template, start
// from last event (dry-run), or start blank. Today the first two are
// wired as "navigate the user to the right tab" — they don't try to
// jump in-context, which keeps the MVP shippable.

import type { ReactNode } from 'react'
import { BookOpen, FilePlus, Sparkles } from 'lucide-react'
import { Button } from '../../ui/Button'

function StartTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="default"
      onClick={onClick}
      className="flex h-full w-full flex-col items-start gap-1 rounded-xl border-neutral-200 bg-white p-4 text-left font-normal hover:border-[#1a3d32] hover:bg-white hover:shadow-sm"
    >
      {icon}
      <p className="mt-2 text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-xs text-neutral-600">{description}</p>
    </Button>
  )
}

export function SentenceEmptyState({
  onStartBlank,
  onOpenLibrary,
  onOpenDryRun,
}: {
  onStartBlank: () => void
  onOpenLibrary: () => void
  onOpenDryRun: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6">
      <h3 className="text-base font-semibold text-neutral-900">Hvordan vil du starte?</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Velg en mal, en faktisk hendelse fra historikken, eller bygg fra bunnen.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StartTile
          icon={<BookOpen className="size-5 text-[#1a3d32]" aria-hidden />}
          title="Start fra mal (anbefalt)"
          description="Velg en revidert AML/IK-f/GDPR-mal fra biblioteket."
          onClick={onOpenLibrary}
        />
        <StartTile
          icon={<Sparkles className="size-5 text-[#1a3d32]" aria-hidden />}
          title="Start fra siste hendelse"
          description="Velg en faktisk hendelse fra historikken og bygg regelen rundt den."
          onClick={onOpenDryRun}
        />
        <StartTile
          icon={<FilePlus className="size-5 text-[#1a3d32]" aria-hidden />}
          title="Start blankt"
          description="Tomt skjelett — sett inn hendelse, betingelse og handlinger selv."
          onClick={onStartBlank}
        />
      </div>
    </div>
  )
}
