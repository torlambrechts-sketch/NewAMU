// SaveAndResumeBar — top-of-form bar with "Save draft" / "Download access
// key" actions. Generates a fresh access_key on first save; subsequent
// saves re-use it.

import { useState } from 'react'

type Props = {
  accessKey: string | null
  expiresAt: string | null
  isSaving: boolean
  onSave: () => void
  lang: 'nb' | 'en'
}

const COPY = {
  nb: {
    save: 'Lagre kladd',
    saving: 'Lagrer…',
    keyLabel: 'Tilgangsnøkkel',
    copy: 'Kopier nøkkel',
    download: 'Last ned som tekstfil',
    expires: 'Utløper',
    help:
      'Bruk denne nøkkelen til å fortsette på et annet tidspunkt eller en annen enhet. Vi har ingen annen måte å gjenfinne kladden din på.',
  },
  en: {
    save: 'Save draft',
    saving: 'Saving…',
    keyLabel: 'Access key',
    copy: 'Copy key',
    download: 'Download as text file',
    expires: 'Expires',
    help:
      'Use this key to resume on another device or at another time. We have no other way to recover your draft.',
  },
}

export function SaveAndResumeBar({ accessKey, expiresAt, isSaving, onSave, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const copy = COPY[lang]

  function handleCopy() {
    if (!accessKey) return
    navigator.clipboard.writeText(accessKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    if (!accessKey) return
    const blob = new Blob(
      [
        `${copy.keyLabel}: ${accessKey}\n` +
          `${copy.expires}: ${expiresAt ?? 'unknown'}\n` +
          `\n${copy.help}\n`,
      ],
      { type: 'text/plain;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `varslings-tilgangsnokkel-${accessKey.slice(0, 8)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          {accessKey ? (
            <>
              <div className="text-xs font-semibold text-neutral-700">{copy.keyLabel}</div>
              <code className="block mt-0.5 text-xs font-mono text-neutral-900 break-all">{accessKey}</code>
            </>
          ) : (
            <div className="text-xs text-neutral-600">{copy.help}</div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            {isSaving ? copy.saving : copy.save}
          </button>
          {accessKey && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:bg-white"
              >
                {copied ? '✓' : copy.copy}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:bg-white"
              >
                {copy.download}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
