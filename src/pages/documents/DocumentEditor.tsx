import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'
import { RichTextEditor } from '../../components/learning/RichTextEditor'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'

export function DocumentEditor() {
  const { documentId } = useParams<{ documentId: string }>()
  const {
    documents,
    updateDocument,
    saveVersion,
    submitForReview,
    publish,
    startRevision,
    archive,
    rejectReview,
  } = useDocumentCenter()

  const doc = documents.find((d) => d.id === documentId)
  const [compareV1, setCompareV1] = useState<string | null>(null)

  const sortedVersions = useMemo(() => {
    if (!doc) return []
    return [...doc.versions].sort((a, b) => b.versionNumber - a.versionNumber)
  }, [doc])

  if (!doc) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm">
        Dokument ikke funnet.{' '}
        <Link to="/documents" className="underline">
          Tilbake
        </Link>
      </div>
    )
  }

  const readOnly = doc.workflowStatus === 'published' && compareV1 === null

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        <Link to="/documents" className="inline-flex items-center gap-1 text-emerald-800 hover:underline">
          <ArrowLeft className="size-4" /> Bibliotek
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-medium text-neutral-500">Tittel</label>
          <input
            value={doc.title}
            disabled={readOnly}
            onChange={(e) => updateDocument(doc.id, { title: e.target.value })}
            className="mt-1 w-full max-w-2xl rounded-lg border border-neutral-200 px-3 py-2 text-lg font-semibold text-[#2D403A] disabled:bg-neutral-50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.workflowStatus === 'draft' ? (
            <>
              <button
                type="button"
                onClick={() => saveVersion(doc.id, 'Manuell lagring')}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                Lagre versjon
              </button>
              <button
                type="button"
                onClick={() => submitForReview(doc.id)}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              >
                Send til godkjenning
              </button>
              <button
                type="button"
                onClick={() => publish(doc.id)}
                className="rounded-lg bg-[#2D403A] px-3 py-2 text-sm font-medium text-white"
              >
                Publiser
              </button>
            </>
          ) : null}
          {doc.workflowStatus === 'in_review' ? (
            <>
              <button
                type="button"
                onClick={() => publish(doc.id)}
                className="rounded-lg bg-[#2D403A] px-3 py-2 text-sm font-medium text-white"
              >
                Godkjenn og publiser
              </button>
              <button
                type="button"
                onClick={() => rejectReview(doc.id)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                Avvis (tilbake til utkast)
              </button>
            </>
          ) : null}
          {doc.workflowStatus === 'published' ? (
            <>
              <button type="button" onClick={() => startRevision(doc.id)} className="rounded-lg bg-[#2D403A] px-3 py-2 text-sm text-white">
                Start revisjon
              </button>
              <button
                type="button"
                onClick={() => archive(doc.id)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                Arkiver
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Kategori</span>
          <input
            value={doc.category}
            disabled={readOnly}
            onChange={(e) => updateDocument(doc.id, { category: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm disabled:bg-neutral-50"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Eier</span>
          <input
            value={doc.owner}
            disabled={readOnly}
            onChange={(e) => updateDocument(doc.id, { owner: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm disabled:bg-neutral-50"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="text-xs font-medium text-neutral-500">Lov-/forskriftshenvisning (valgfritt)</span>
          <input
            value={doc.lawRef ?? ''}
            disabled={readOnly}
            onChange={(e) => updateDocument(doc.id, { lawRef: e.target.value || undefined })}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm disabled:bg-neutral-50"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="text-xs font-medium text-neutral-500">Tagger (kommaseparert)</span>
          <input
            value={doc.tags.join(', ')}
            disabled={readOnly}
            onChange={(e) =>
              updateDocument(doc.id, {
                tags: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm disabled:bg-neutral-50"
          />
        </label>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Innhold</h2>
        {readOnly ? (
          <div
            className="prose prose-sm mt-4 max-w-none text-neutral-800 [&_a]:text-emerald-800"
            dangerouslySetInnerHTML={{ __html: sanitizeLearningHtml(doc.publishedHtml ?? doc.currentHtml) }}
          />
        ) : (
          <div className="mt-4">
            <RichTextEditor value={doc.currentHtml} onChange={(html) => updateDocument(doc.id, { currentHtml: html })} />
          </div>
        )}
      </div>

      {doc.workflowStatus === 'published' && doc.publishedAt ? (
        <p className="text-xs text-neutral-500">
          Sist publisert: {new Date(doc.publishedAt).toLocaleString('nb-NO')} · Versjon {doc.publishedVersionNumber}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-[#2D403A]">Versjonshistorikk</h3>
          {sortedVersions.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Ingen lagrede versjoner ennå.</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
              {sortedVersions.map((v) => (
                <li key={v.id} className="rounded border border-neutral-100 bg-neutral-50/80 px-3 py-2">
                  <div className="font-medium">v{v.versionNumber}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(v.savedAt).toLocaleString('nb-NO')} · {v.savedBy}
                    {v.note ? ` · ${v.note}` : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-emerald-800 underline"
                      onClick={() => {
                        setCompareV1(v.id)
                      }}
                    >
                      Forhåndsvis
                    </button>
                    {doc.workflowStatus !== 'published' || compareV1 !== null ? (
                      <button
                        type="button"
                        className="text-xs text-emerald-800 underline"
                        onClick={() => {
                          if (
                            window.confirm('Gjenopprett dette innholdet som utkast? (overskriver nåværende utkast)')
                          ) {
                            updateDocument(doc.id, { currentHtml: v.html })
                          }
                        }}
                      >
                        Gjenopprett som utkast
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {compareV1 && (
            <div className="mt-4 rounded border border-neutral-200 p-3">
              <p className="text-xs font-medium text-neutral-500">Forhåndsvisning</p>
              <div
                className="prose prose-sm mt-2 max-h-48 max-w-none overflow-auto text-neutral-800"
                dangerouslySetInnerHTML={{
                  __html: sanitizeLearningHtml(sortedVersions.find((x) => x.id === compareV1)?.html ?? ''),
                }}
              />
              <button type="button" className="mt-2 text-xs underline" onClick={() => setCompareV1(null)}>
                Lukk
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-[#2D403A]">Revisjonslogg</h3>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
            {doc.audit.map((a) => (
              <li key={a.id} className="border-b border-neutral-100 pb-2 text-neutral-700">
                <span className="text-xs text-neutral-500">{new Date(a.at).toLocaleString('nb-NO')}</span>
                <div>
                  <strong>{a.action}</strong>
                  {a.detail ? ` — ${a.detail}` : ''}
                </div>
                <div className="text-xs text-neutral-500">{a.actor}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
