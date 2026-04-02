import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'
import { DOCUMENT_CATEGORIES } from '../../data/documentCategories'
import { INTERNAL_SOURCE_PRESETS } from '../../data/internalSourceLinks'
import { RichTextEditor } from '../../components/learning/RichTextEditor'
import { WikiHtml } from '../../components/documents/WikiHtml'
import { slugifyTitle } from '../../lib/wikiSlug'

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
    approveStep,
    addComment,
    resolveComment,
    confirmReading,
    addAttachment,
    removeAttachment,
  } = useDocumentCenter()

  const doc = documents.find((d) => d.id === documentId)
  const [compareV1, setCompareV1] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const wikiRefs = useMemo(
    () =>
      documents.map((d) => ({
        id: d.id,
        title: d.title,
        wikiSlug: d.wikiSlug ?? slugifyTitle(d.title),
      })),
    [documents],
  )

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
  const checklist = doc.prePublishChecklist ?? []
  const checksDone = doc.prePublishChecksDone ?? checklist.map(() => false)
  const canPublishChecklist =
    checklist.length === 0 || checklist.every((_, i) => checksDone[i] === true)
  const pendingApprovals = doc.approvalSteps.filter((s) => s.status === 'pending')
  const allApproved = doc.approvalSteps.length === 0 || doc.approvalSteps.every((s) => s.status === 'approved')

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
          <p className="mt-1 text-xs text-neutral-500">
            Wiki-slug: <code className="rounded bg-neutral-100 px-1">{doc.wikiSlug ?? slugifyTitle(doc.title)}</code> — bruk{' '}
            <code className="rounded bg-neutral-100 px-1">[[{doc.title}]]</code> i andre dokumenter
          </p>
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
                disabled={!canPublishChecklist}
                title={!canPublishChecklist ? 'Fullfør sjekkliste før publisering' : undefined}
                onClick={() => publish(doc.id)}
                className="rounded-lg bg-[#2D403A] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Publiser direkte
              </button>
            </>
          ) : null}
          {doc.workflowStatus === 'in_review' ? (
            <>
              {pendingApprovals.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => approveStep(doc.id, s.id)}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
                >
                  Godkjenn som {s.roleName}
                </button>
              ))}
              <button
                type="button"
                disabled={!allApproved || !canPublishChecklist}
                onClick={() => publish(doc.id)}
                className="rounded-lg bg-[#2D403A] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Publiser etter godkjenning
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
              <button
                type="button"
                onClick={() => startRevision(doc.id)}
                className="rounded-lg bg-[#2D403A] px-3 py-2 text-sm text-white"
              >
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

      {doc.lastSignature && doc.workflowStatus === 'published' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          <strong>Attestert publisering (demo):</strong> {doc.lastSignature.signedBy} —{' '}
          {new Date(doc.lastSignature.signedAt).toLocaleString('nb-NO')}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Kategori</span>
          <select
            value={doc.category}
            disabled={readOnly}
            onChange={(e) => updateDocument(doc.id, { category: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm disabled:bg-neutral-50"
          >
            {!DOCUMENT_CATEGORIES.includes(doc.category as (typeof DOCUMENT_CATEGORIES)[number]) ? (
              <option value={doc.category}>{doc.category}</option>
            ) : null}
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
        <label className="text-sm md:col-span-2">
          <span className="text-xs font-medium text-neutral-500">Neste revisjon (dato)</span>
          <input
            type="date"
            value={doc.nextReviewDueAt?.slice(0, 10) ?? ''}
            disabled={readOnly}
            onChange={(e) =>
              updateDocument(doc.id, {
                nextReviewDueAt: e.target.value ? `${e.target.value}T12:00:00.000Z` : undefined,
              })
            }
            className="mt-1 rounded border border-neutral-200 px-2 py-1 text-sm disabled:bg-neutral-50"
          />
        </label>
      </div>

      {doc.templateVariables && Object.keys(doc.templateVariables).length > 0 && !readOnly ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Malvariabler</h2>
          <p className="mt-1 text-xs text-neutral-500">Erstatter {'{{navn}}'} i innholdet.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.keys(doc.templateVariables).map((key) => (
              <label key={key} className="text-sm">
                <span className="text-xs text-neutral-500">{`{{${key}}}`}</span>
                <input
                  value={doc.templateVariables?.[key] ?? ''}
                  onChange={(e) =>
                    updateDocument(doc.id, {
                      templateVariables: { ...doc.templateVariables, [key]: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {checklist.length > 0 && !readOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="font-semibold text-amber-950">Sjekk før publisering</h2>
          <ul className="mt-2 space-y-2">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checksDone[i] ?? false}
                  onChange={(e) => {
                    const next = [...checksDone]
                    next[i] = e.target.checked
                    updateDocument(doc.id, { prePublishChecksDone: next })
                  }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {doc.workflowStatus === 'in_review' && doc.approvalSteps.length > 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Godkjenningsflyt</h2>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
            {doc.approvalSteps.map((s) => (
              <li key={s.id}>
                {s.roleName}: {s.status === 'approved' ? `✓ ${s.approvedBy ?? ''}` : 'Venter'}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Innhold</h2>
        {readOnly ? (
          <div className="mt-4">
            <WikiHtml
              html={doc.publishedHtml ?? doc.currentHtml}
              templateVariables={doc.templateVariables}
              allDocs={wikiRefs}
            />
          </div>
        ) : (
          <div className="mt-4">
            <RichTextEditor value={doc.currentHtml} onChange={(html) => updateDocument(doc.id, { currentHtml: html })} />
            <p className="mt-2 text-xs text-neutral-500">
              Wiki: skriv <code className="rounded bg-neutral-100 px-1">[[Annen dok.tittel]]</code> for intern lenke.
            </p>
            <div className="mt-4 rounded border border-dashed border-neutral-200 p-3">
              <p className="text-xs font-medium text-neutral-500">Forhåndsvisning (variabler + wiki)</p>
              <div className="mt-2">
                <WikiHtml html={doc.currentHtml} templateVariables={doc.templateVariables} allDocs={wikiRefs} />
              </div>
            </div>
          </div>
        )}
      </div>

      {doc.workflowStatus === 'published' && doc.readingReceipts.length > 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Lesebekreftelse</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {doc.readingReceipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span>{r.roleLabel}</span>
                {r.required ? <span className="text-xs text-amber-800">(påkrevd)</span> : null}
                {r.acknowledgedAt ? (
                  <span className="text-emerald-800">
                    ✓ {r.acknowledgedBy} — {new Date(r.acknowledgedAt).toLocaleString('nb-NO')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirmReading(doc.id, r.id)}
                    className="rounded border border-neutral-300 px-2 py-0.5 text-xs"
                  >
                    Bekreft lest (demo)
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Vedlegg</h2>
        <p className="text-xs text-neutral-500">
          PDF, bilder eller tekst (maks ca. 4 MB per fil i demo). Lagres i nettleseren.
        </p>
        {!readOnly ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*,.txt,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                setUploadErr(null)
                if (!f) return
                const r = await addAttachment(doc.id, f)
                if (!r.ok) setUploadErr(r.error)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              Last opp fil
            </button>
            {uploadErr ? <p className="mt-2 text-sm text-red-700">{uploadErr}</p> : null}
          </>
        ) : null}
        <ul className="mt-3 space-y-2">
          {(doc.attachments ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm">
              <span>
                {a.fileName}{' '}
                <span className="text-xs text-neutral-500">
                  ({Math.round(a.sizeBytes / 1024)} KB)
                </span>
              </span>
              <span className="flex gap-2">
                <a
                  href={a.dataUrl}
                  download={a.fileName}
                  className="text-emerald-800 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Åpne / last ned
                </a>
                {!readOnly ? (
                  <button type="button" className="text-red-600" onClick={() => removeAttachment(doc.id, a.id)}>
                    Slett
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {(doc.attachments ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-neutral-500">Ingen vedlegg.</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Interne kilder (atics)</h2>
        <p className="text-xs text-neutral-500">
          Kategoriserte snarveier til moduler. Velg forhåndsdefinert eller legg til egen sti.
        </p>
        {!readOnly ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              className="max-w-full rounded border border-neutral-200 px-2 py-1 text-sm"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                const preset = INTERNAL_SOURCE_PRESETS.find((p) => `${p.path}::${p.label}` === v)
                e.target.value = ''
                if (!preset) return
                updateDocument(doc.id, {
                  externalLinks: [
                    ...(doc.externalLinks ?? []),
                    {
                      id: crypto.randomUUID(),
                      label: preset.label,
                      path: preset.path,
                      category: preset.category,
                    },
                  ],
                })
              }}
            >
              <option value="">+ Legg til intern kilde…</option>
              {[...new Set(INTERNAL_SOURCE_PRESETS.map((p) => p.category))].map((cat) => (
                <optgroup key={cat} label={cat}>
                  {INTERNAL_SOURCE_PRESETS.filter((p) => p.category === cat).map((p) => (
                    <option key={p.path + p.label} value={`${p.path}::${p.label}`}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        ) : null}
        <ul className="mt-3 space-y-2">
          {(doc.externalLinks ?? []).map((l) => (
            <li key={l.id} className="flex flex-wrap items-start gap-2 rounded border border-neutral-100 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                {l.category ? (
                  <span className="mb-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                    {l.category}
                  </span>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {readOnly ? (
                    <>
                      <Link to={l.path} className="font-medium text-emerald-800 underline">
                        {l.label}
                      </Link>
                      <code className="text-xs text-neutral-500">{l.path}</code>
                    </>
                  ) : (
                    <>
                      <input
                        value={l.label}
                        onChange={(e) => {
                          const next = (doc.externalLinks ?? []).map((x) =>
                            x.id === l.id ? { ...x, label: e.target.value } : x,
                          )
                          updateDocument(doc.id, { externalLinks: next })
                        }}
                        className="min-w-[120px] flex-1 rounded border px-2 py-1"
                      />
                      <input
                        value={l.path}
                        onChange={(e) => {
                          const next = (doc.externalLinks ?? []).map((x) =>
                            x.id === l.id ? { ...x, path: e.target.value } : x,
                          )
                          updateDocument(doc.id, { externalLinks: next })
                        }}
                        className="min-w-[160px] flex-1 rounded border px-2 py-1 font-mono text-xs"
                      />
                      <input
                        value={l.category ?? ''}
                        placeholder="Kategori"
                        onChange={(e) => {
                          const next = (doc.externalLinks ?? []).map((x) =>
                            x.id === l.id ? { ...x, category: e.target.value || undefined } : x,
                          )
                          updateDocument(doc.id, { externalLinks: next })
                        }}
                        className="w-40 rounded border px-2 py-1 text-xs"
                      />
                    </>
                  )}
                </div>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() =>
                    updateDocument(doc.id, {
                      externalLinks: (doc.externalLinks ?? []).filter((x) => x.id !== l.id),
                    })
                  }
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {!readOnly ? (
          <button
            type="button"
            className="mt-2 text-sm text-emerald-800 underline"
            onClick={() =>
              updateDocument(doc.id, {
                externalLinks: [
                  ...(doc.externalLinks ?? []),
                  { id: crypto.randomUUID(), label: 'Ny lenke', path: '/', category: 'Annet' },
                ],
              })
            }
          >
            + Tom rad (rediger sti)
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Diskusjon</h2>
        {!readOnly ? (
          <div className="mt-2">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={2}
              placeholder="Kommentar (enkel tekst — vises som avsnitt)"
              className="w-full rounded border border-neutral-200 px-2 py-2 text-sm"
            />
            <button
              type="button"
              className="mt-2 rounded-lg bg-[#2D403A] px-3 py-1.5 text-sm text-white"
              onClick={() => {
                if (!commentDraft.trim()) return
                addComment(doc.id, `<p>${escapeHtml(commentDraft)}</p>`)
                setCommentDraft('')
              }}
            >
              Legg til kommentar
            </button>
          </div>
        ) : null}
        <ul className="mt-4 space-y-3">
          {doc.comments.map((c) => (
            <li
              key={c.id}
              className={`rounded border px-3 py-2 text-sm ${c.resolved ? 'border-neutral-100 bg-neutral-50 opacity-70' : 'border-neutral-200'}`}
            >
              <div dangerouslySetInnerHTML={{ __html: c.html }} />
              <div className="mt-1 text-xs text-neutral-500">
                {c.author} · {new Date(c.createdAt).toLocaleString('nb-NO')}
              </div>
              {!c.resolved && !readOnly ? (
                <button
                  type="button"
                  className="mt-1 text-xs text-emerald-800 underline"
                  onClick={() => resolveComment(doc.id, c.id)}
                >
                  Marker som løst
                </button>
              ) : null}
            </li>
          ))}
        </ul>
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
              <div className="mt-2 max-h-48 overflow-auto">
                <WikiHtml
                  html={sortedVersions.find((x) => x.id === compareV1)?.html ?? ''}
                  templateVariables={doc.templateVariables}
                  allDocs={wikiRefs}
                />
              </div>
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
