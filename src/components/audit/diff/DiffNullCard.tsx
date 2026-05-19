// Null-diff card — spec §4.5. Single context card for actions without
// a value change: kommentert, lastet_opp_vedlegg, signert, eksportert.

import { MessageSquare, Paperclip, ShieldCheck, Download, Share2, Archive, AlertTriangle, FileCheck2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AuditAction } from '../../../lib/audit/diffShape'

const ICON: Record<AuditAction, ReactNode> = {
  opprettet: <FileCheck2 className="h-4 w-4" aria-hidden />,
  endret: <FileCheck2 className="h-4 w-4" aria-hidden />,
  lukket: <FileCheck2 className="h-4 w-4" aria-hidden />,
  gjenapnet: <AlertTriangle className="h-4 w-4" aria-hidden />,
  tildelt: <FileCheck2 className="h-4 w-4" aria-hidden />,
  omfordelt: <FileCheck2 className="h-4 w-4" aria-hidden />,
  kommentert: <MessageSquare className="h-4 w-4" aria-hidden />,
  signert: <ShieldCheck className="h-4 w-4" aria-hidden />,
  attestert: <ShieldCheck className="h-4 w-4" aria-hidden />,
  godkjent: <ShieldCheck className="h-4 w-4" aria-hidden />,
  avvist: <AlertTriangle className="h-4 w-4" aria-hidden />,
  lastet_opp_vedlegg: <Paperclip className="h-4 w-4" aria-hidden />,
  slettet_vedlegg: <Paperclip className="h-4 w-4" aria-hidden />,
  versjon_bumpet: <FileCheck2 className="h-4 w-4" aria-hidden />,
  eskalert: <AlertTriangle className="h-4 w-4" aria-hidden />,
  eksportert: <Download className="h-4 w-4" aria-hidden />,
  delt: <Share2 className="h-4 w-4" aria-hidden />,
  arkivert: <Archive className="h-4 w-4" aria-hidden />,
  // W0
  besvart: <FileCheck2 className="h-4 w-4" aria-hidden />,
  publisert: <Share2 className="h-4 w-4" aria-hidden />,
  protokollert: <ShieldCheck className="h-4 w-4" aria-hidden />,
  votert: <FileCheck2 className="h-4 w-4" aria-hidden />,
  innkalt: <MessageSquare className="h-4 w-4" aria-hidden />,
  mottatt: <FileCheck2 className="h-4 w-4" aria-hidden />,
  fullfort: <ShieldCheck className="h-4 w-4" aria-hidden />,
  slettet_kommentar: <MessageSquare className="h-4 w-4" aria-hidden />,
}

export type DiffNullCardProps = {
  action: AuditAction
  /** Pre-rendered Norwegian sentence. Caller typically passes event.summary_nb. */
  summary: string
  /** Optional secondary note (filename, size, certificate id, ...). */
  detail?: string
}

export function DiffNullCard({ action, summary, detail }: DiffNullCardProps) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-neutral-600 ring-1 ring-neutral-200">
          {ICON[action]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-800">{summary}</p>
          {detail ? <p className="mt-1 text-xs text-neutral-500">{detail}</p> : null}
        </div>
      </div>
    </div>
  )
}
