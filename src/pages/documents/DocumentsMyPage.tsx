import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FileText } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentsSearchBar } from '../../components/documents/DocumentsSearchBar'
import { maxReceiptVersionForUser } from '../../lib/wikiCompliance'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { WikiPage } from '../../types/documents'

const CARD = 'rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm'

function PageRow({ page, sub }: { page: WikiPage; sub?: string }) {
  return (
    <li className={`${CARD}`}>
      <Link to={`/documents/page/${page.id}`} className="font-medium text-[#1a3d32] hover:underline">
        {page.title}
      </Link>
      {sub ? <p className="mt-1 text-xs text-neutral-500">{sub}</p> : null}
      <p className="mt-2 text-xs text-neutral-400">Versjon {page.version}</p>
    </li>
  )
}

export function DocumentsMyPage() {
  const docs = useDocuments()
  const { user } = useOrgSetupContext()
  const userId = user?.id

  const spaceTitle = useMemo(() => {
    const m = new Map(docs.spaces.map((s) => [s.id, s.title]))
    return (id: string) => m.get(id) ?? 'Mappe'
  }, [docs.spaces])

  const { needsSignature, outdated } = docs.myAcknowledgementBuckets

  const outdatedWithLabel = useMemo(() => {
    if (!userId) return [] as { page: WikiPage; receiptV: number }[]
    return outdated.map((page) => ({
      page,
      receiptV: maxReceiptVersionForUser(page.id, userId, docs.receipts) ?? 0,
    }))
  }, [outdated, userId, docs.receipts])

  return (
    <DocumentsModuleLayout
      headerActions={<DocumentsSearchBar />}
      subHeader={
        <div className="mt-6 border-b border-neutral-200/80 pb-6">
          <nav className="text-sm text-neutral-600">
            <Link to="/documents" className="text-[#1a3d32] underline">
              Bibliotek
            </Link>
            <span className="mx-2 text-neutral-400">→</span>
            <span className="font-medium text-neutral-900">Mine dokumenter</span>
          </nav>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Oversikt over dokumenter som trenger signaturen din, eller der du har signert en eldre versjon.
          </p>
        </div>
      }
    >
      {docs.error && (
        <div className="mt-4 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{docs.error}</div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" aria-hidden />
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700">Krever din bekreftelse</h2>
        </div>
        {needsSignature.length === 0 ? (
          <p className={`${CARD} text-sm text-neutral-500`}>Ingen dokumenter venter på signatur fra deg.</p>
        ) : (
          <ul className="space-y-2">
            {needsSignature.map((page) => (
              <PageRow key={page.id} page={page} sub={spaceTitle(page.spaceId)} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="size-4 text-[#1a3d32]" aria-hidden />
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700">Nylig oppdatert</h2>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          Sider du tidligere har bekreftet, men der det finnes en nyere publisert versjon som krever ny signatur.
        </p>
        {outdatedWithLabel.length === 0 ? (
          <p className={`${CARD} text-sm text-neutral-500`}>Ingen slike dokumenter akkurat nå.</p>
        ) : (
          <ul className="space-y-2">
            {outdatedWithLabel.map(({ page, receiptV }) => (
              <PageRow
                key={page.id}
                page={page}
                sub={`Du bekreftet versjon ${receiptV} — gjeldende er v${page.version}. · ${spaceTitle(page.spaceId)}`}
              />
            ))}
          </ul>
        )}
      </section>
    </DocumentsModuleLayout>
  )
}
