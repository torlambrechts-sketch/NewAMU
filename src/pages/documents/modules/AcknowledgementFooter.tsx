import { useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useDocuments, DEMO_USER_NAME } from '../../../hooks/useDocuments'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type Props = {
  pageId: string
  pageVersion: number
}

export function AcknowledgementFooter({ pageId, pageVersion }: Props) {
  const { acknowledge, hasAcknowledged, receipts, backend } = useDocuments()
  const { profile } = useOrgSetupContext()
  const [name, setName] = useState('')

  const alreadySigned = hasAcknowledged(pageId, pageVersion)
  const receipt = receipts.find(
    (r) => r.pageId === pageId && r.pageVersion === pageVersion,
  )

  return (
    <div className="not-prose mt-8 rounded-xl border-2 border-[#1a3d32]/20 bg-[#1a3d32]/5 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#1a3d32]" />
        <div className="flex-1">
          <p className="font-semibold text-[#1a3d32]">Lest og forstått</p>
          <p className="mt-1 text-sm text-neutral-600">
            Dette dokumentet krever bekreftelse på at du har lest og forstått innholdet. Din signatur registreres med
            tidsstempel og dokumentversjon.
          </p>

          {alreadySigned ? (
            <div className="mt-4 flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-medium">
                Signert av {receipt?.userName ?? profile?.display_name ?? DEMO_USER_NAME} ·{' '}
                {receipt ? new Date(receipt.acknowledgedAt).toLocaleString('no-NO') : ''}
                {' '}· Versjon {pageVersion}
              </span>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ditt fulle navn"
                className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
              />
              <button
                type="button"
                disabled={!name.trim() && !profile?.display_name?.trim()}
                onClick={() => void acknowledge(pageId, name || (profile?.display_name ?? ''))}
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-5 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#142e26]"
              >
                <ShieldCheck className="size-4" />
                Jeg har lest og forstått dette dokumentet
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-400">
            Versjon {pageVersion}
            {backend === 'local' ? ' · Lagret lokalt (demo uten organisasjon).' : ' · Registrert i organisasjonens database.'}
          </p>
        </div>
      </div>
    </div>
  )
}
