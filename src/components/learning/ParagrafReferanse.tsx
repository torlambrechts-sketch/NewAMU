// ParagrafReferanse — shows the law paragraphs linked to the current module
// as a compact pill bar with an expandable drawer. The refLawIds on a module
// are joined against the locale-level lawRefs catalog so callers don't need
// to pass pre-resolved objects.

import { useState } from 'react'
import { Scale, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '../ui/Button'

export type LawRefEntry = {
  id: string
  lawName: string
  paragraph: string
  title: string
}

type Props = {
  refLawIds: string[]
  lawRefs: LawRefEntry[]
}

export function ParagrafReferanse({ refLawIds, lawRefs }: Props) {
  const [open, setOpen] = useState(false)

  const linked = refLawIds
    .map((id) => lawRefs.find((r) => r.id === id))
    .filter(Boolean) as LawRefEntry[]

  if (!linked.length) return null

  return (
    <div className="mt-4">
      {/* Pill bar */}
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="flex h-auto w-full flex-wrap items-center justify-start gap-1.5 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 py-2 text-left font-normal transition-colors hover:bg-neutral-100"
        aria-expanded={open}
        aria-label="Vis lovreferanser"
      >
        <Scale className="size-3.5 shrink-0 text-neutral-500" />
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Lovhjemmel
        </span>
        {linked.slice(0, 4).map((r) => (
          <span
            key={r.id}
            className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700"
          >
            {r.paragraph}
          </span>
        ))}
        {linked.length > 4 && (
          <span className="text-[11px] text-neutral-400">+{linked.length - 4} til</span>
        )}
        {open ? (
          <ChevronUp className="ml-auto size-3.5 shrink-0 text-neutral-400" />
        ) : (
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-neutral-400" />
        )}
      </Button>

      {/* Expanded drawer */}
      {open && (
        <div className="mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2">
            <span className="text-xs font-semibold text-neutral-700">Lovhenvisninger for dette modulet</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-auto w-auto rounded p-0.5 text-neutral-400 hover:text-neutral-700"
              aria-label="Lukk"
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <ul className="divide-y divide-neutral-100">
            {linked.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#1a3d32]">
                  {r.paragraph}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-neutral-800">{r.title}</div>
                  <div className="text-[11px] text-neutral-500">{r.lawName}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
