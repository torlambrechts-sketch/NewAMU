// DangerRedirectBanner — first visible element on the public intake page.
// Lists Norwegian emergency numbers + a brief explanation. The buttons are
// tel: links so a mobile user can dial directly. No tracking, no logging.

import { useState } from 'react'

type Props = {
  lang: 'nb' | 'en'
}

const COPY = {
  nb: {
    title: 'Er du eller noen i fare?',
    cta: 'Ring akutt-nummer først — varselet kan vente.',
    dismiss: 'Skjul (jeg er trygg)',
    show: 'Vis nødnumre',
    options: [
      { num: '110', label: 'Brann' },
      { num: '112', label: 'Politi' },
      { num: '113', label: 'Ambulanse' },
      { num: '116 123', label: 'Mentalhelse (Kirkens SOS)' },
    ],
  },
  en: {
    title: 'Are you or someone in danger?',
    cta: 'Call emergency services first — the report can wait.',
    dismiss: 'Dismiss (I am safe)',
    show: 'Show emergency numbers',
    options: [
      { num: '110', label: 'Fire' },
      { num: '112', label: 'Police' },
      { num: '113', label: 'Ambulance' },
      { num: '116 123', label: 'Mental-health (Kirkens SOS)' },
    ],
  },
}

export function DangerRedirectBanner({ lang }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const copy = COPY[lang]
  if (dismissed) {
    return (
      <div className="text-sm text-neutral-500 mb-4">
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="underline hover:text-neutral-800"
        >
          {copy.show}
        </button>
      </div>
    )
  }
  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border-2 border-red-700 bg-red-50 p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-red-900">{copy.title}</h2>
          <p className="mt-1 text-sm text-red-800">{copy.cta}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {copy.options.map((o) => (
              <a
                key={o.num}
                href={`tel:${o.num.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                <span className="font-mono">{o.num}</span>
                <span className="font-normal">— {o.label}</span>
              </a>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-red-800 underline hover:text-red-900"
          aria-label={copy.dismiss}
        >
          {copy.dismiss}
        </button>
      </div>
    </div>
  )
}
