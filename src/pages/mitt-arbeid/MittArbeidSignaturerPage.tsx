// "Mitt arbeid · Signaturer" — focused queue for documents awaiting the
// user's signature. Forsinket signatur er den vanligste årsaken til at
// IK § 5 nr. 8 (årsrevisjon) lukker for sent; en dedikert flate
// reduserer "hvem har glemt å skrive under"-friksjon.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Inbox,
  PenLine,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

const CREAM_DEEP = '#EFE8DC'
const FOREST = '#1a3d32'

type SignaturePendingRow = {
  id: string
  title: string
  source: 'compliance' | 'meeting' | 'document'
  dueAt: string | null
  href: string
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function MittArbeidSignaturerPage() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const userId = user?.id ?? null
  const [rows, setRows] = useState<SignaturePendingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !orgId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        // 1) Compliance checklists awaiting signature — executions in
        //    status 'draft' or 'active' that aren't yet signed. The
        //    schema uses public.inspection_round_status enum (values
        //    draft/active/signed) and `scheduled_for` for the planned
        //    execution date (see archive/20260615120000). We surface
        //    org-wide; the detail page enforces signer membership.
        const compRes = await supabase
          .from('compliance_checklist_executions')
          .select('id, title, status, scheduled_for, signed_at')
          .eq('organization_id', orgId)
          .is('signed_at', null)
          .in('status', ['draft', 'active'])
          .order('scheduled_for', { ascending: true, nullsFirst: false })
          .limit(50)

        // 2) Document review requests where the current user is the
        //    reviewer (wiki_review_requests is RLS-scoped to reviewer_id
        //    or document.manage admins).
        const docRes = userId
          ? await supabase
              .from('wiki_review_requests')
              .select('id, page_id, page_version, created_at, status')
              .eq('organization_id', orgId)
              .eq('reviewer_id', userId)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(50)
          : { data: [], error: null }

        // 3) Meeting protocol pending signature — meetings where the
        //    meeting is closed but the protocol is not yet signed.
        //    Today this is held in meetings.protocol_signed_at; we
        //    surface drafts ready for chair signature.
        const meetRes = await supabase
          .from('meetings')
          .select('id, title, scheduled_at, status, protocol_signed_at')
          .eq('organization_id', orgId)
          .is('protocol_signed_at', null)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
          .limit(50)

        if (cancelled) return

        const next: SignaturePendingRow[] = []

        if (compRes.data && !compRes.error) {
          for (const r of compRes.data as { id: string; title: string | null; scheduled_for: string | null }[]) {
            next.push({
              id: `comp:${r.id}`,
              title: r.title ?? 'Sjekkliste-utførelse',
              source: 'compliance',
              dueAt: r.scheduled_for,
              href: `/compliance/checklists/${r.id}`,
            })
          }
        }
        if (docRes.data && !docRes.error) {
          for (const r of docRes.data as { id: string; page_id: string; page_version: number; created_at: string }[]) {
            next.push({
              id: `doc:${r.id}`,
              title: `Dokumentversjon v${r.page_version}`,
              source: 'document',
              dueAt: r.created_at,
              href: `/documents/wiki/${r.page_id}`,
            })
          }
        }
        if (meetRes.data && !meetRes.error) {
          for (const r of meetRes.data as { id: string; title: string | null; scheduled_at: string | null }[]) {
            next.push({
              id: `meet:${r.id}`,
              title: r.title ?? 'Møteprotokoll',
              source: 'meeting',
              dueAt: r.scheduled_at,
              href: `/meetings/${r.id}`,
            })
          }
        }

        setRows(next)
        setError(null)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Kunne ikke laste signatur-kø.'
        setError(msg)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, orgId, userId])

  const grouped = useMemo(() => {
    return {
      compliance: rows.filter((r) => r.source === 'compliance'),
      meeting: rows.filter((r) => r.source === 'meeting'),
      document: rows.filter((r) => r.source === 'document'),
    }
  }, [rows])

  const total = rows.length

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          <PenLine className="size-3.5" aria-hidden />
          Mitt arbeid · Mine signaturer
        </div>
        <h1
          className="mt-2 font-serif text-3xl font-medium tracking-tight text-neutral-900 md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Dokumenter som venter på din underskrift
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Sjekklister, møteprotokoller og dokumenter på tvers av modulene som krever
          en signatur for å lukke saken. Forsinket signatur er den vanligste årsaken
          til at saker stopper opp.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Laster signatur-kø…
        </div>
      ) : total === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
          <div>
            <p className="font-medium text-emerald-900">Ingen ventende signaturer.</p>
            <p className="text-sm text-emerald-700">Du er ajour.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <SignatureGroup
            title="Sjekklister"
            icon={ClipboardList}
            accent={FOREST}
            rows={grouped.compliance}
          />
          <SignatureGroup
            title="Møteprotokoller"
            icon={FileSignature}
            accent="#0891b2"
            rows={grouped.meeting}
          />
          <SignatureGroup
            title="Dokumenter"
            icon={Inbox}
            accent="#0f766e"
            rows={grouped.document}
          />
        </div>
      )}

      <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        Mitt arbeid · Mine signaturer · Kilde: compliance_checklist_executions ·
        meetings.protocol · wiki_review_requests
      </p>
    </div>
  )
}

function SignatureGroup({
  title,
  icon: Icon,
  accent,
  rows,
}: {
  title: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true'; style?: React.CSSProperties }>
  accent: string
  rows: SignaturePendingRow[]
}) {
  if (rows.length === 0) return null
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5"
      style={{ background: CREAM_DEEP }}
    >
      <header className="flex items-center gap-2">
        <Icon className="size-4" aria-hidden="true" style={{ color: accent }} />
        <h2
          className="font-serif text-lg font-medium text-neutral-900"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {title}
        </h2>
        <span className="ml-auto text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {rows.length} venter
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            to={r.href}
            className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-neutral-400"
          >
            <PenLine className="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800">{r.title}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">{fmtDate(r.dueAt)}</p>
            </div>
            <ArrowUpRight className="size-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-600" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  )
}
