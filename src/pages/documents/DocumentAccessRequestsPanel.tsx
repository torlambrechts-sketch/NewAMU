import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { WikiDocumentAccessRequest } from '../../types/wikiAccessRequest'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module/moduleTableKit'
import { Button } from '../../components/ui/Button'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WarningBox } from '../../components/ui/AlertBox'

const SCOPE_NB: Record<WikiDocumentAccessRequest['accessScope'], string> = {
  read: 'Les',
  edit: 'Rediger',
}

const DURATION_NB: Record<WikiDocumentAccessRequest['duration'], string> = {
  session: 'Kort / økt',
  '7d': '7 dager',
  '30d': '30 dager',
  permanent: 'Varig',
}

const STATUS_NB: Record<WikiDocumentAccessRequest['status'], string> = {
  pending: 'Venter',
  approved: 'Godkjent',
  rejected: 'Avslått',
  cancelled: 'Trukket',
}

type Props = {
  canManage: boolean
}

export function DocumentAccessRequestsPanel({ canManage }: Props) {
  const docs = useDocuments()
  const { user } = useOrgSetupContext()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [panelErr, setPanelErr] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  const pending = useMemo(
    () => docs.wikiAccessRequests.filter((r) => r.status === 'pending'),
    [docs.wikiAccessRequests],
  )
  const history = useMemo(
    () => docs.wikiAccessRequests.filter((r) => r.status !== 'pending').slice(0, 50),
    [docs.wikiAccessRequests],
  )

  if (!canManage) return null

  const setNote = (id: string, v: string) => {
    setAdminNotes((m) => ({ ...m, [id]: v }))
  }

  const decide = async (req: WikiDocumentAccessRequest, decision: 'approved' | 'rejected') => {
    setPanelErr(null)
    setBusyId(req.id)
    try {
      await docs.updateWikiAccessRequestDecision(req, decision, adminNotes[req.id] ?? null)
      setAdminNotes((m) => {
        const next = { ...m }
        delete next[req.id]
        return next
      })
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : 'Behandling feilet.')
    } finally {
      setBusyId(null)
    }
  }

  const cancelOwn = async (req: WikiDocumentAccessRequest) => {
    if (req.requesterId !== user?.id) return
    setBusyId(req.id)
    setPanelErr(null)
    try {
      await docs.cancelWikiAccessRequest(req.id)
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : 'Kunne ikke trekke søknad.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-sm font-semibold text-neutral-900">Tilgangssøknader</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Forespørsler om lese- eller redigeringstilgang til begrensede mapper eller dokumenter. Ved godkjenning legges
        brukeren inn som direkte brukertilgang på mappen (mappe-tilgang).
      </p>
      {panelErr ? (
        <div className="mt-3">
          <WarningBox>{panelErr}</WarningBox>
        </div>
      ) : null}

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">Venter på behandling</h3>
      {pending.length === 0 ? (
        <p className="text-sm text-neutral-600">Ingen ventende søknader.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className={MODULE_TABLE_TH}>Ressurs</th>
                <th className={MODULE_TABLE_TH}>Søker</th>
                <th className={MODULE_TABLE_TH}>Ønsket</th>
                <th className={MODULE_TABLE_TH}>Begrunnelse</th>
                <th className={MODULE_TABLE_TH}>Notat / handling</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className={MODULE_TABLE_TR_BODY}>
                  <td className="px-4 py-3 align-top text-neutral-800">
                    <span className="font-medium">{r.title}</span>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {r.resourceType === 'folder' ? 'Mappe' : 'Dokument'}
                      {r.pageId ? ` · id ${r.pageId.slice(0, 8)}…` : null}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-neutral-700">
                    {r.requesterName}
                    <p className="mt-1 font-mono text-[10px] text-neutral-400">{r.requesterId.slice(0, 8)}…</p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-neutral-700">
                    {SCOPE_NB[r.accessScope]}
                    <br />
                    {DURATION_NB[r.duration]}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 align-top text-xs text-neutral-700">
                    {r.justification}
                  </td>
                  <td className="min-w-[240px] px-4 py-3 align-top">
                    <StandardTextarea
                      rows={2}
                      className="text-xs"
                      placeholder="Valgfritt notat til søker…"
                      value={adminNotes[r.id] ?? ''}
                      onChange={(e) => setNote(r.id, e.target.value)}
                      disabled={busyId === r.id}
                    />
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {r.requesterId === user?.id ? (
                        <Button type="button" variant="secondary" size="sm" disabled={busyId === r.id} onClick={() => void cancelOwn(r)}>
                          Trekk
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<X className="h-3.5 w-3.5" />}
                        disabled={busyId === r.id}
                        onClick={() => void decide(r, 'rejected')}
                      >
                        Avslå
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={<Check className="h-3.5 w-3.5" />}
                        disabled={busyId === r.id}
                        onClick={() => void decide(r, 'approved')}
                      >
                        Godkjenn
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-neutral-500">Nylig behandlet</h3>
      {history.length === 0 ? (
        <p className="text-sm text-neutral-600">Ingen arkiverte søknader ennå.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className={MODULE_TABLE_TH}>Ressurs</th>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH}>Søker</th>
                <th className={MODULE_TABLE_TH}>Behandlet</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className={MODULE_TABLE_TR_BODY}>
                  <td className="px-4 py-2 text-neutral-800">{r.title}</td>
                  <td className="px-4 py-2 text-xs font-medium text-neutral-700">{STATUS_NB[r.status]}</td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{r.requesterName}</td>
                  <td className="px-4 py-2 text-xs text-neutral-500">
                    {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('no-NO') : '—'}
                    {r.adminNote ? <p className="mt-1 text-neutral-600">{r.adminNote}</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModuleSectionCard>
  )
}
