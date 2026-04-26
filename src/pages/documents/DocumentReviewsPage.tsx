import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModulePageShell, ModuleSectionCard, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WarningBox } from '../../components/ui/AlertBox'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'

export function DocumentReviewsPage() {
  const navigate = useNavigate()
  const docs = useDocuments()
  const { user } = useOrgSetupContext()
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const pending = useMemo(
    () => docs.wikiReviewRequests.filter((r) => r.status === 'pending' && r.reviewerId === user?.id),
    [docs.wikiReviewRequests, user?.id],
  )

  const pageTitle = (id: string) => docs.pages.find((p) => p.id === id)?.title ?? id

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }, { label: 'Godkjenninger' }]}
      title="Ventende dokumentgodkjenninger"
      description={
        <p className="max-w-3xl text-sm text-neutral-600">
          Her vises dokumenter som er sendt til deg for godkjenning før publisering.
        </p>
      }
    >
      {err ? (
        <div className="mb-4">
          <WarningBox>{err}</WarningBox>
        </div>
      ) : null}
      <ModuleSectionCard>
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen ventende forespørsler.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className={MODULE_TABLE_TH}>
                  <th className="px-3 py-2">Dokument</th>
                  <th className="px-3 py-2">Versjon</th>
                  <th className="px-3 py-2">Merknad</th>
                  <th className="px-3 py-2 text-right">Handling</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id} className={MODULE_TABLE_TR_BODY}>
                    <td className="px-3 py-2 font-medium text-neutral-900">{pageTitle(r.pageId)}</td>
                    <td className="px-3 py-2 text-neutral-600">v{r.pageVersion}</td>
                    <td className="px-3 py-2">
                      <StandardTextarea
                        rows={2}
                        value={commentDrafts[r.id] ?? ''}
                        onChange={(e) => setCommentDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        placeholder="Valgfri merknad til søker ved avslag…"
                        className="text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={async () => {
                            setBusyId(r.id)
                            setErr(null)
                            try {
                              await docs.requestReviewChanges(r.id, commentDrafts[r.id] ?? 'Trenger endringer.')
                              setCommentDrafts((d) => {
                                const n = { ...d }
                                delete n[r.id]
                                return n
                              })
                            } catch (e) {
                              setErr(e instanceof Error ? e.message : 'Kunne ikke sende tilbakemelding.')
                            } finally {
                              setBusyId(null)
                            }
                          }}
                        >
                          Be om endringer
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={async () => {
                            setBusyId(r.id)
                            setErr(null)
                            try {
                              await docs.approveReviewRequest(r.id)
                            } catch (e) {
                              setErr(e instanceof Error ? e.message : 'Kunne ikke godkjenne.')
                            } finally {
                              setBusyId(null)
                            }
                          }}
                        >
                          Godkjenn og publiser
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
      <Button type="button" variant="secondary" className="mt-6" onClick={() => navigate('/documents')}>
        Tilbake til dokumenter
      </Button>
    </ModulePageShell>
  )
}
