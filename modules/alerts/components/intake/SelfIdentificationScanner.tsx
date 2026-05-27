// SelfIdentificationScanner — inline warning surface for self-identifying
// phrasing in the description field. All matching is client-side; nothing
// is sent anywhere. The warning is non-blocking.

import { useMemo } from 'react'
import { scanForSelfIdentification, type SelfIdMatch } from '../../lib/selfIdPatterns'

type Props = {
  text: string
  lang: 'nb' | 'en'
}

const SEVERITY_COLOURS: Record<'low' | 'medium' | 'high', string> = {
  high: 'border-red-700 bg-red-50 text-red-900',
  medium: 'border-amber-600 bg-amber-50 text-amber-900',
  low: 'border-neutral-400 bg-neutral-50 text-neutral-700',
}

export function SelfIdentificationScanner({ text, lang }: Props) {
  const matches = useMemo<SelfIdMatch[]>(() => scanForSelfIdentification(text, lang), [text, lang])
  if (matches.length === 0) return null

  return (
    <div className="mt-2 space-y-2" role="status" aria-live="polite">
      {matches.map((m) => (
        <div
          key={m.patternId + m.index}
          className={`rounded-md border-l-4 px-3 py-2 text-xs ${SEVERITY_COLOURS[m.severity]}`}
        >
          <div className="font-semibold capitalize">
            {lang === 'nb' ? `Tips (${labelSeverity(m.severity, 'nb')})` : `Hint (${labelSeverity(m.severity, 'en')})`}
          </div>
          <div className="mt-1">{m.warning}</div>
          <div className="mt-1 font-mono text-[10px] opacity-70">
            «{m.matchedText}»
          </div>
        </div>
      ))}
    </div>
  )
}

function labelSeverity(s: 'low' | 'medium' | 'high', lang: 'nb' | 'en') {
  if (lang === 'nb') return s === 'low' ? 'lav' : s === 'medium' ? 'middels' : 'høy'
  return s
}
