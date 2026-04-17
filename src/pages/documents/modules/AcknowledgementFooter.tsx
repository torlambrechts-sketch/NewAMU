import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { DEMO_USER_NAME, useWikiPage } from '../../../hooks/useDocuments'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { maxReceiptVersionForUser } from '../../../lib/wikiCompliance'

type Props = {
  pageId: string
  pageVersion: number
}

export function AcknowledgementFooter({ pageId, pageVersion }: Props) {
  const { acknowledge, hasAcknowledged, receipts, page } = useWikiPage(pageId)
  const { profile, user } = useOrgSetupContext()

  const displayName = profile?.display_name?.trim() || DEMO_USER_NAME
  const userId = user?.id
  const myPrevReceiptV = userId ? maxReceiptVersionForUser(pageId, userId, receipts) : null
  const staleUnsigned =
    page &&
    page.requiresAcknowledgement &&
    page.status === 'published' &&
    myPrevReceiptV != null &&
    myPrevReceiptV < pageVersion &&
    !hasAcknowledged(pageId, pageVersion)

  const alreadySigned = hasAcknowledged(pageId, pageVersion)
  const myReceipts = receipts.filter((r) => r.pageId === pageId && r.userId === userId)
  const receipt =
    myReceipts.find((r) => r.pageVersion === pageVersion) ??
    [...myReceipts].sort((a, b) => b.pageVersion - a.pageVersion)[0]

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
                Signert av {receipt?.userName ?? displayName} ·{' '}
                {receipt ? new Date(receipt.acknowledgedAt).toLocaleString('no-NO') : ''}
                {' '}· Versjon {pageVersion}
              </span>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {staleUnsigned ? (
                <p className="rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Du bekreftet versjon {myPrevReceiptV} — det finnes en nyere versjon (v{pageVersion}).
                </p>
              ) : null}
              <p className="text-sm text-neutral-700">
                <span className="font-medium text-neutral-900">Signeres som:</span> {displayName}
              </p>
              <button
                type="button"
                onClick={() => void acknowledge(pageId)}
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-5 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
              >
                <ShieldCheck className="size-4" />
                Jeg har lest og forstått dette dokumentet
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-400">
            Versjon {pageVersion}
            {' · Registrert i organisasjonens database.'}
          </p>
        </div>
      </div>
    </div>
  )
}
