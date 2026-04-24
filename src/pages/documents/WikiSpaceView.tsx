import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, Pencil, Plus, Search, Upload, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  ModulePageShell,
  ModuleRecordsTableShell,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import type { PageStatus } from '../../types/documents'
import { canViewWikiSpace } from '../../lib/wikiSpaceAccessGrants'

const STATUS_LABEL: Record<PageStatus, string> = {
  published: 'Publisert',
  draft: 'Utkast',
  archived: 'Arkivert',
}

function pageStatusBadgeVariant(s: PageStatus): 'success' | 'draft' | 'neutral' {
  if (s === 'published') return 'success'
  if (s === 'draft') return 'draft'
  return 'neutral'
}

const FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Alle statuser' },
  { value: 'published', label: STATUS_LABEL.published },
  { value: 'draft', label: STATUS_LABEL.draft },
]

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
}

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

export function WikiSpaceView() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { can, isAdmin, user, profile, members } = useOrgSetupContext()
  const canManage = isAdmin || can('documents.manage')
  const bypassFolderRbac = canManage
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const [newTitle, setNewTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [pageSearch, setPageSearch] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlHref, setUrlHref] = useState('')
  const [busy, setBusy] = useState(false)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [filesPanelOpen, setFilesPanelOpen] = useState(false)
  const [panelPageId, setPanelPageId] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  const space = docs.spaces.find((s) => s.id === spaceId)
  const itemsInSpace = useMemo(
    () => docs.spaceItems.filter((i) => i.spaceId === spaceId),
    [docs.spaceItems, spaceId],
  )

  const allSpacePages = useMemo(
    () => docs.pages.filter((p) => p.spaceId === spaceId),
    [docs.pages, spaceId],
  )

  const pages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase()
    return allSpacePages
      .filter((p) => filter === 'all' || p.status === filter)
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          (p.summary ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [allSpacePages, filter, pageSearch])

  const panelPage = panelPageId ? docs.pages.find((p) => p.id === panelPageId) ?? null : null

  const kpiItems = useMemo(() => {
    const pub = allSpacePages.filter((p) => p.status === 'published').length
    const dr = allSpacePages.filter((p) => p.status === 'draft').length
    const arch = allSpacePages.filter((p) => p.status === 'archived').length
    return [
      { big: String(allSpacePages.length), title: 'Sider totalt', sub: 'I denne mappen' },
      { big: String(pub), title: 'Publisert', sub: 'Synlige dokumenter' },
      { big: String(dr), title: 'Utkast', sub: 'Ikke publisert' },
      { big: String(arch), title: 'Arkivert', sub: 'Ut av aktiv liste' },
    ]
  }, [allSpacePages])

  const anyOverlayOpen = newPageOpen || filesPanelOpen || Boolean(panelPageId)
  useBodyScrollLock(anyOverlayOpen)

  useEffect(() => {
    if (!anyOverlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewPageOpen(false)
        setFilesPanelOpen(false)
        setPanelPageId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyOverlayOpen])

  if (!spaceId) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Mappe"
        notFound={{ title: 'Mangler mappe-ID', onBack: () => navigate('/documents') }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!space) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Mappe"
        notFound={{
          title: 'Mappe ikke funnet',
          backLabel: '← Tilbake til bibliotek',
          onBack: () => navigate('/documents'),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  const canViewSpace = canViewWikiSpace({
    spaceId: space.id,
    grants: docs.wikiSpaceAccessGrants,
    bypassRestriction: bypassFolderRbac,
    userId: user?.id,
    profile,
    members,
  })

  if (!canViewSpace) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
          { label: space.title },
        ]}
        title="Ingen tilgang"
        description={
          <p className="max-w-3xl text-sm text-neutral-600">Du har ikke tilgang til dokumenter i denne mappen.</p>
        }
      >
        <WarningBox>
          Mappen er begrenset til bestemte brukere, avdelinger eller team. Kontakt en administrator hvis du mener dette
          er feil.
        </WarningBox>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => navigate('/documents')}>
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !spaceId) return
    const page = await docs.createPage(spaceId, newTitle)
    setNewTitle('')
    setNewPageOpen(false)
    navigate(`/documents/page/${page.id}/reference-edit`)
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!spaceId || !urlTitle.trim() || !urlHref.trim()) return
    setBusy(true)
    try {
      await docs.addSpaceUrl(spaceId, urlTitle, urlHref)
      setUrlTitle('')
      setUrlHref('')
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !spaceId) return
    setBusy(true)
    try {
      await docs.uploadSpaceFile(spaceId, f)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const revisionMeta = (p: (typeof pages)[0]) => {
    const due = p.nextRevisionDueAt ? new Date(p.nextRevisionDueAt) : null
    const days = due ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000)) : null
    const revisionWarn = due != null && days != null && days <= 60
    return { due, days, revisionWarn }
  }

  const headerActions = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
      {docs.backend === 'supabase' ? (
        <Button type="button" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setFilesPanelOpen(true)}>
          Filer og lenker
        </Button>
      ) : null}
      {canManage ? (
        <Button type="button" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setNewPageOpen(true)}>
          Ny side
        </Button>
      ) : null}
    </div>
  )

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        { label: space.title },
      ]}
      title={space.title}
      description={
        <p className="max-w-3xl text-sm text-neutral-600">
          {space.description || 'Dokumenter i henhold til internkontrollforskriften § 5 — systematisk utforming, revisjon og tilgjengelighet.'}
        </p>
      }
      headerActions={headerActions}
    >
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <p className="text-sm text-neutral-500">
        <span aria-hidden>{space.icon}</span>{' '}
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Mappe</span>
      </p>

      <ModuleRecordsTableShell
        kpiItems={kpiItems}
        title="Sider i mappen"
        description="Klikk en rad for detaljer og handlinger."
        toolbar={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <StandardInput
                type="search"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                placeholder="Søk i sider…"
                className="py-2 pl-10"
              />
            </div>
            <div className="min-w-[200px] shrink-0 sm:max-w-xs">
              <SearchableSelect
                value={filter}
                options={FILTER_OPTIONS}
                onChange={(v) => setFilter(v as 'all' | 'published' | 'draft')}
              />
            </div>
          </div>
        }
        footer={<span className="text-sm text-neutral-500">{pages.length} treff</span>}
      >
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          {pages.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                  Ingen sider matcher — trykk «Ny side» eller bruk en mal fra oversikten.
                </td>
              </tr>
            </tbody>
          ) : (
            <>
              <thead>
                <tr>
                  <th className={MODULE_TABLE_TH}>Tittel</th>
                  <th className={MODULE_TABLE_TH}>Status</th>
                  <th className={MODULE_TABLE_TH}>Versjon</th>
                  <th className={MODULE_TABLE_TH}>Oppdatert</th>
                  <th className={MODULE_TABLE_TH}>Revisjon</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => {
                  const { due, days, revisionWarn } = revisionMeta(p)
                  return (
                    <tr
                      key={p.id}
                      className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                      onClick={() => setPanelPageId(p.id)}
                    >
                      <td className="px-5 py-4 align-middle">
                        <span className="font-medium text-neutral-900">{p.title}</span>
                        {p.summary ? <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{p.summary}</p> : null}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <Badge variant={pageStatusBadgeVariant(p.status)}>
                          {STATUS_LABEL[p.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 align-middle text-neutral-600">v{p.version}</td>
                      <td className="px-5 py-4 align-middle text-xs text-neutral-600">
                        {new Date(p.updatedAt).toLocaleDateString('no-NO')}
                      </td>
                      <td className="px-5 py-4 align-middle text-xs">
                        {!p.nextRevisionDueAt ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <span
                            className={
                              days != null && days < 0
                                ? 'font-medium text-red-800'
                                : revisionWarn
                                  ? 'font-medium text-amber-800'
                                  : 'text-neutral-600'
                            }
                          >
                            {due!.toLocaleDateString('no-NO')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </>
          )}
        </table>
      </ModuleRecordsTableShell>

      {anyOverlayOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <Button
            type="button"
            variant="ghost"
            aria-label="Lukk"
            className="absolute inset-0 h-auto min-h-0 rounded-none bg-black/40 p-0 hover:bg-black/50"
            onClick={() => {
              setNewPageOpen(false)
              setFilesPanelOpen(false)
              setPanelPageId(null)
            }}
          />
          <div
            ref={panelRef}
            className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {newPageOpen
                  ? 'Ny wiki-side'
                  : filesPanelOpen
                    ? 'Filer og lenker'
                    : panelPage
                      ? panelPage.title
                      : 'Detaljer'}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Lukk panel"
                onClick={() => {
                  setNewPageOpen(false)
                  setFilesPanelOpen(false)
                  setPanelPageId(null)
                }}
                icon={<X className="h-5 w-5" />}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {newPageOpen && (
                <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
                  <p className="text-sm text-neutral-600">Opprett en tom side og gå rett til redigering.</p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-new-page-title">
                      Tittel
                    </label>
                    <StandardInput
                      id="wiki-new-page-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tittel på siden"
                      required
                    />
                  </div>
                  <Button type="submit" variant="primary">
                    Opprett og rediger
                  </Button>
                </form>
              )}

              {filesPanelOpen && docs.backend === 'supabase' && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Last opp filer eller legg til eksterne referanser i denne mappen.
                  </p>
                  <div>
                    <input id="wiki-space-upload" type="file" className="sr-only" onChange={(e) => void handleUpload(e)} disabled={busy} />
                    <Button type="button" variant="secondary" icon={<Upload className="h-4 w-4" />} disabled={busy} onClick={() => document.getElementById('wiki-space-upload')?.click()}>
                      Last opp fil
                    </Button>
                  </div>
                  <form onSubmit={(e) => void handleAddUrl(e)} className="space-y-3 border-t border-neutral-100 pt-4">
                    <StandardInput
                      value={urlTitle}
                      onChange={(e) => setUrlTitle(e.target.value)}
                      placeholder="Tittel på referanse"
                    />
                    <StandardInput value={urlHref} onChange={(e) => setUrlHref(e.target.value)} placeholder="https://…" type="url" />
                    <Button type="submit" variant="primary" disabled={busy}>
                      Legg til URL
                    </Button>
                  </form>
                  {itemsInSpace.length > 0 && (
                    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                      {itemsInSpace.map((it) => (
                        <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="truncate font-medium text-neutral-800">
                            {it.kind === 'url' ? '[URL] ' : '[Fil] '}
                            {it.title}
                          </span>
                          <div className="flex items-center gap-1">
                            {it.kind === 'file' ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  void (async () => {
                                    const u = await docs.getSpaceFileUrl(it)
                                    if (u) window.open(u, '_blank', 'noopener,noreferrer')
                                  })()
                                }}
                              >
                                Åpne
                              </Button>
                            ) : null}
                            {canManage ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Fjerne elementet?')) void docs.deleteSpaceItem(it)
                                }}
                              >
                                Slett
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {panelPage && !newPageOpen && !filesPanelOpen && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={pageStatusBadgeVariant(panelPage.status)}>
                      {STATUS_LABEL[panelPage.status]}
                    </Badge>
                    <span className="text-xs text-neutral-600">v{panelPage.version}</span>
                    <span className="text-xs text-neutral-600">
                      {new Date(panelPage.updatedAt).toLocaleDateString('no-NO')}
                    </span>
                  </div>
                  {panelPage.summary ? <p className="text-sm text-neutral-600">{panelPage.summary}</p> : null}
                  {panelPage.nextRevisionDueAt ? (
                    <p className="text-xs text-neutral-600">
                      Neste revisjon:{' '}
                      <strong>{new Date(panelPage.nextRevisionDueAt).toLocaleDateString('no-NO')}</strong>
                    </p>
                  ) : null}
                  {panelPage.legalRefs.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {panelPage.legalRefs.slice(0, 6).map((r) => (
                        <span key={r} className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="min-w-0 flex-1"
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => navigate(`/documents/page/${panelPage.id}`)}
                      >
                        Vis dokument
                      </Button>
                      {canManage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-neutral-500 hover:text-neutral-800"
                          title="Rediger"
                          aria-label="Rediger"
                          onClick={() => navigate(`/documents/page/${panelPage.id}/reference-edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    {panelPage.status === 'draft' ? (
                      <Button type="button" variant="secondary" className="w-full" onClick={() => void docs.publishPage(panelPage.id)}>
                        Publiser
                      </Button>
                    ) : null}
                    {panelPage.status !== 'archived' ? (
                      <Button type="button" variant="secondary" className="w-full" onClick={() => void docs.archivePage(panelPage.id)}>
                        Arkiver
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="danger"
                      className="w-full"
                      onClick={() => {
                        if (confirm('Slett siden?')) void docs.deletePage(panelPage.id)
                        setPanelPageId(null)
                      }}
                    >
                      Slett
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ModulePageShell>
  )
}
