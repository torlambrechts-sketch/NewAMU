import { useState } from 'react'

const R = 'rounded-none'

type Props = {
  open: boolean
  title: string
  actionLabel: string
  onCancel: () => void
  onConfirm: () => void
}

export function ShareSensitiveDataModal({ open, title, actionLabel, onCancel, onConfirm }: Props) {
  const [ack, setAck] = useState(false)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className={`${R} max-w-md border border-neutral-200 bg-white p-6 shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sensitive-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="share-sensitive-title" className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Rapporten kan inneholde <strong>sensitive personopplysninger</strong>, <strong>helseopplysninger</strong> og{' '}
          <strong>intern virksomhetsinformasjon</strong>. Sørg for at mottaker har tjenstlig behov og at deling er i
          samsvar med interne retningslinjer og personvernreglene (GDPR).
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Ved e-post: ingen kryptering er garantert. Vurder sikre kanaler for konfidensielt innhold.
        </p>
        <label className={`${R} mt-4 flex cursor-pointer items-start gap-3 border border-neutral-200 bg-neutral-50 p-3 text-sm`}>
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 size-4 rounded-none border-neutral-400"
          />
          <span className="text-neutral-800">
            Jeg bekrefter at jeg er klar over risikoen og at deling er forsvarlig i denne sammenhengen.
          </span>
        </label>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className={`${R} border border-neutral-300 px-4 py-2 text-sm font-medium`}>
            Avbryt
          </button>
          <button
            type="button"
            disabled={!ack}
            onClick={() => {
              onConfirm()
              setAck(false)
            }}
            className={`${R} bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-40`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
