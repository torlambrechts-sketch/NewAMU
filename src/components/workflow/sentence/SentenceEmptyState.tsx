// Empty-state for SentenceBuilder when the rule has no flow yet.
//
// Three tiles per Run 1's empty-state design: start from template, start
// from last event (dry-run), or start blank. Today the first two are
// wired as "navigate the user to the right tab" — they don't try to
// jump in-context, which keeps the MVP shippable.

import { BookOpen, FilePlus, Sparkles } from 'lucide-react'

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
        <button
          type="button"
          onClick={onOpenLibrary}
          className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-[#1a3d32] hover:shadow-sm"
        >
          <BookOpen className="size-5 text-[#1a3d32]" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-neutral-900">Start fra mal (anbefalt)</p>
          <p className="mt-1 text-xs text-neutral-600">
            Velg en revidert AML/IK-f/GDPR-mal fra biblioteket.
          </p>
        </button>
        <button
          type="button"
          onClick={onOpenDryRun}
          className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-[#1a3d32] hover:shadow-sm"
        >
          <Sparkles className="size-5 text-[#1a3d32]" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-neutral-900">Start fra siste hendelse</p>
          <p className="mt-1 text-xs text-neutral-600">
            Velg en faktisk hendelse fra historikken og bygg regelen rundt den.
          </p>
        </button>
        <button
          type="button"
          onClick={onStartBlank}
          className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-[#1a3d32] hover:shadow-sm"
        >
          <FilePlus className="size-5 text-[#1a3d32]" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-neutral-900">Start blankt</p>
          <p className="mt-1 text-xs text-neutral-600">
            Tomt skjelett — sett inn hendelse, betingelse og handlinger selv.
          </p>
        </button>
      </div>
    </div>
  )
}
