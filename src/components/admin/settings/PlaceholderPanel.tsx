// Stub panel used by scope sections that don't yet have a real
// implementation. Keeps the registry shape honest while phase 2/3
// extracts or builds the actual panels.

import { Construction } from 'lucide-react'

type Props = {
  title: string
  description?: string
  hint?: string
}

export function PlaceholderPanel({ title, description, hint }: Props) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-neutral-700">
      <div className="flex items-center gap-2 text-neutral-900">
        <Construction className="size-5" aria-hidden />
        <h2 className="text-base font-medium">{title}</h2>
      </div>
      {description ? <p className="text-sm">{description}</p> : null}
      {hint ? <p className="text-xs italic text-neutral-500">{hint}</p> : null}
    </div>
  )
}
