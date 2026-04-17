import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ExternalLink, X } from 'lucide-react'
import { useComplianceDocs } from '../../hooks/useDocuments'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentsSearchBar } from '../../components/documents/DocumentsSearchBar'

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

export function ComplianceDashboard() {
  const docs = useComplianceDocs()
  const [panelRef, setPanelRef] = useState<string | null>(null)

  const coverage = docs.legalCoverage.map((item) => {
    const coveredBy = docs.pages.filter(
      (p) =>
        p.status === 'published' &&
        item.templateIds.some((tid) =>
          docs.pageTemplates.find((t) => t.id === tid)?.page.legalRefs.some((r) => p.legalRefs.includes(r)),
        ),
    )
    const stale = coveredBy.some((p) => {
      if (!p.nextRevisionDueAt) return false
      return new Date(p.nextRevisionDueAt).getTime() < Date.now()
    })
    return { ...item, coveredBy, covered: coveredBy.length > 0, stale }
  })

  const panelRow = useMemo(
    () => (panelRef ? coverage.find((c) => c.ref === panelRef) ?? null : null),
    [coverage, panelRef],
  )

  useBodyScrollLock(Boolean(panelRef))

  useEffect(() => {
    if (!panelRef) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelRef(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelRef])

  const total = coverage.length
  const covered = coverage.filter((c) => c.covered).length
  const pct = total ? Math.round((covered / total) * 100) : 0

  return (
    <DocumentsModuleLayout
      headerActions={<DocumentsSearchBar />}
      subHeader={
        <p className="mt-6 border-b border-neutral-200/80 pb-6 text-sm text-neutral-600">
          Oversikt over hvilke krav i Internkontrollforskriften og Arbeidsmiljøloven som er dekket av publiserte sider.
          Klikk en rad for detaljer og lenker.
        </p>
      }
    >
      <div className="mt-6 rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-4xl font-bold tabular-nums text-[#1a3d32]">{pct}%</div>
            <div className="text-sm text-neutral-600">av {total} lovkrav dekket av publiserte sider</div>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <div>
              <strong className="text-emerald-700">{covered}</strong> dekket
            </div>
            <div>
              <strong className="text-amber-600">{total - covered}</strong> mangler
            </div>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-none bg-neutral-200">
          <div className="h-full rounded-none bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mb-8 mt-8 overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Krav per lovhenvisning</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Hjemmel</th>
                <th className="px-4 py-3">Krav</th>
                <th className="px-4 py-3">Neste revideringsdato</th>
                <th className="px-4 py-3">Dekket av</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {coverage.map((c) => (
                <tr
                  key={c.ref}
                  className={`cursor-pointer transition-colors hover:bg-neutral-50 ${
                    c.covered && !c.stale ? '' : 'bg-amber-50/40'
                  }`}
                  onClick={() => setPanelRef(c.ref)}
                >
                  <td className="px-4 py-3">
                    {c.covered && !c.stale ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : c.covered && c.stale ? (
                      <span
                        className="text-xs font-medium text-amber-800"
                        title="Dokument funnet, men revisjonsfrist passert"
                      >
                        ⚠
                      </span>
                    ) : (
                      <Circle className="size-5 text-amber-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-none bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a3d32]">
                      {c.ref}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{c.label}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {c.coveredBy.length === 0 ? (
                      <span className="text-amber-700">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {c.coveredBy.map((p) => (
                          <li key={p.id}>
                            {p.nextRevisionDueAt ? (
                              new Date(p.nextRevisionDueAt).toLocaleDateString('no-NO')
                            ) : (
                              <span className="text-neutral-400">Ikke satt</span>
                            )}{' '}
                            <span className="text-neutral-400">({p.title})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.coveredBy.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.coveredBy.map((p) => (
                          <span
                            key={p.id}
                            className="rounded-none border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                          >
                            {p.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700">Ingen publisert side dekker dette kravet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Compliance-kvitteringer</h2>
          <p className="text-xs text-neutral-500">
            Sider som krever «Lest og forstått»-signatur, og antall registrerte kvitteringer.
          </p>
        </div>
        {docs.pages.filter((p) => p.requiresAcknowledgement && p.status === 'published').length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen publiserte sider krever signatur ennå.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Versjon</th>
                  <th className="px-4 py-3">Kvitteringer</th>
                  <th className="px-4 py-3">Siste signatur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {docs.pages
                  .filter((p) => p.requiresAcknowledgement && p.status === 'published')
                  .map((p) => {
                    const recs = docs.receipts.filter((r) => r.pageId === p.id)
                    const last = recs.sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt))[0]
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-3">
                          <Link to={`/documents/page/${p.id}`} className="font-medium text-[#1a3d32] hover:underline">
                            {p.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">v{p.version}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-none border px-2 py-0.5 text-xs font-medium ${
                              recs.length > 0
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }`}
                          >
                            {recs.length} signert
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">
                          {last
                            ? `${last.userName} · ${new Date(last.acknowledgedAt).toLocaleDateString('no-NO')}`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <a
          href="https://lovdata.no/forskrift/1996-12-06-1127"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#1a3d32] hover:underline"
        >
          <ExternalLink className="size-4" />
          Internkontrollforskriften på lovdata.no
        </a>
      </div>

      {panelRef && panelRow && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Lukk"
            className="absolute inset-0 bg-black/40"
            onClick={() => setPanelRef(null)}
          />
          <div
            className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Krav {panelRow.ref}</h2>
              <button
                type="button"
                onClick={() => setPanelRef(null)}
                className="rounded-none p-2 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <p className="text-neutral-700">{panelRow.label}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
                <p className="mt-1 text-neutral-800">
                  {panelRow.covered && !panelRow.stale
                    ? 'Dekket av publiserte sider'
                    : panelRow.covered && panelRow.stale
                      ? 'Dekket, men minst én side har passert revisjonsfrist'
                      : 'Ikke dekket'}
                </p>
              </div>
              {panelRow.coveredBy.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Publiserte sider</p>
                  <ul className="mt-2 space-y-2">
                    {panelRow.coveredBy.map((p) => (
                      <li key={p.id}>
                        <Link to={`/documents/page/${p.id}`} className="font-medium text-[#1a3d32] hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-xs text-neutral-500">
                          Revisjon:{' '}
                          {p.nextRevisionDueAt
                            ? new Date(p.nextRevisionDueAt).toLocaleDateString('no-NO')
                            : 'Ikke satt'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DocumentsModuleLayout>
  )
}
