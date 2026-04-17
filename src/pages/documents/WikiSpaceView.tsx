import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FilePlus,
  FileText,
  FolderInput,
  GripVertical,
  Image as ImageIcon,
  Link2,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useDocumentTemplates, useWikiPages, useWikiSpaces } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentsSearchBar } from '../../components/documents/DocumentsSearchBar'
import { readingMinutesFromBlocks } from '../../lib/wikiPageContent'
import { WikiBlockRenderer } from './WikiBlockRenderer'
import type { PageTemplate, WikiPage, WikiSpaceItem } from '../../types/documents'

const STATUS_LABEL = { published: 'Publisert', draft: 'Utkast', archived: 'Arkivert' }

const TEMPLATE_PICKER_GROUPS: { key: string; label: string; match: (c: PageTemplate['category']) => boolean }[] = [
  { key: 'hms_policy', label: 'HMS-policy', match: (c) => c === 'hms_handbook' || c === 'policy' },
  { key: 'procedure', label: 'Prosedyre', match: (c) => c === 'procedure' },
  { key: 'beredskap', label: 'Beredskap', match: (c) => c === 'guide' },
  { key: 'opplaering', label: 'Opplæring', match: (c) => c === 'template_library' },
]

const TEMPLATE_PICKER_ANNET = { key: 'annet', label: 'Annet' }

function templatePickerGroupKey(cat: PageTemplate['category']): string {
  const g = TEMPLATE_PICKER_GROUPS.find((x) => x.match(cat))
  return g?.key ?? 'annet'
}

const BTN_PRIMARY =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 text-sm font-medium text-white hover:bg-[#142e26]'
const BTN_OUTLINE =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'
const INPUT =
  'rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'
const CARD = 'rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm'

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

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fileItemIsImage(it: WikiSpaceItem) {
  return it.mimeType?.startsWith('image/') === true
}

export function WikiSpaceView() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const wiki = useWikiSpaces()
  const spacePages = useWikiPages(spaceId)
  const tmpl = useDocumentTemplates()
  const { can } = useOrgSetupContext()
  const canManage = can('documents.manage')
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const [newTitle, setNewTitle] = useState('')
  const [newPageTemplateId, setNewPageTemplateId] = useState<string>('')
  const [tplGroupCollapsed, setTplGroupCollapsed] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlHref, setUrlHref] = useState('')
  const [busy, setBusy] = useState(false)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [filesPanelOpen, setFilesPanelOpen] = useState(false)
  const [panelPageId, setPanelPageId] = useState<string | null>(null)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveTargetSpaceId, setMoveTargetSpaceId] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  const space = wiki.spaces.find((s) => s.id === spaceId)
  const itemsInSpace = useMemo(
    () => wiki.spaceItems.filter((i) => i.spaceId === spaceId),
    [wiki.spaceItems, spaceId],
  )
  const fileItems = useMemo(() => itemsInSpace.filter((i) => i.kind === 'file'), [itemsInSpace])
  const urlItems = useMemo(() => itemsInSpace.filter((i) => i.kind === 'url'), [itemsInSpace])

  const allOrderedPages = useMemo(() => {
    const list = spacePages.pages.filter((p) => p.spaceId === spaceId)
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'nb'))
  }, [spacePages.pages, spaceId])

  const pages = allOrderedPages.filter((p) => filter === 'all' || p.status === filter)

  const panelPage = panelPageId ? spacePages.pages.find((p) => p.id === panelPageId) ?? null : null

  const anyOverlayOpen = newPageOpen || filesPanelOpen || Boolean(panelPageId) || moveModalOpen
  useBodyScrollLock(anyOverlayOpen)

  useEffect(() => {
    if (!anyOverlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewPageOpen(false)
        setNewPageTemplateId('')
        setFilesPanelOpen(false)
        setPanelPageId(null)
        setMoveModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyOverlayOpen])

  const systemTemplateIds = useMemo(
    () => new Set(tmpl.systemTemplatesCatalog.map((t) => t.id)),
    [tmpl.systemTemplatesCatalog],
  )

  const templatesByPickerGroup = useMemo(() => {
    const m = new Map<string, PageTemplate[]>()
    for (const g of TEMPLATE_PICKER_GROUPS) m.set(g.key, [])
    m.set(TEMPLATE_PICKER_ANNET.key, [])
    for (const t of tmpl.pageTemplates) {
      const k = templatePickerGroupKey(t.category)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(t)
    }
    return m
  }, [tmpl.pageTemplates])

  const selectedNewPageTemplate = useMemo(
    () => (newPageTemplateId ? tmpl.pageTemplates.find((t) => t.id === newPageTemplateId) ?? null : null),
    [newPageTemplateId, tmpl.pageTemplates],
  )

  const selectedTemplateReadMin = selectedNewPageTemplate ? readingMinutesFromBlocks(selectedNewPageTemplate.page.blocks) : 0

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!spaceId) return
    if (!newPageTemplateId) {
      if (!newTitle.trim()) return
      const page = await spacePages.createPage(newTitle.trim())
      setNewTitle('')
      setNewPageOpen(false)
      navigate(`/documents/page/${page.id}/edit`)
      return
    }
    const tpl = tmpl.pageTemplates.find((t) => t.id === newPageTemplateId)
    if (!tpl) return
    const title = newTitle.trim() || tpl.page.title
    const templateSourceId = systemTemplateIds.has(tpl.id) ? tpl.id : undefined
    const page = await spacePages.createPage(title, tpl.page.template, tpl.page.blocks, {
      legalRefs: tpl.page.legalRefs,
      requiresAcknowledgement: tpl.page.requiresAcknowledgement,
      summary: tpl.page.summary,
      acknowledgementAudience: tpl.page.acknowledgementAudience,
      acknowledgementDepartmentId: tpl.page.acknowledgementDepartmentId,
      revisionIntervalMonths: tpl.page.revisionIntervalMonths,
      nextRevisionDueAt: tpl.page.nextRevisionDueAt,
      templateSourceId,
    })
    setNewTitle('')
    setNewPageTemplateId('')
    setNewPageOpen(false)
    navigate(`/documents/page/${page.id}/edit`)
  }

  if (!space) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
        Mappe ikke funnet.{' '}
        <Link to="/documents" className="text-[#1a3d32] underline">
          ← Tilbake
        </Link>
      </div>
    )
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!spaceId || !urlTitle.trim() || !urlHref.trim()) return
    setBusy(true)
    try {
      await wiki.addSpaceUrl(spaceId, urlTitle, urlHref)
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
      await wiki.uploadSpaceFile(spaceId, f)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const revisionMeta = (p: WikiPage) => {
    const due = p.nextRevisionDueAt ? new Date(p.nextRevisionDueAt) : null
    const days = due ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000)) : null
    const revisionWarn = due != null && days != null && days <= 60
    return { due, days, revisionWarn }
  }

  async function onDropReorder(targetId: string, droppedId: string) {
    if (!spaceId || filter !== 'all') return
    const ordered = pages.map((p) => p.id)
    const fromIdx = ordered.indexOf(droppedId)
    const toIdx = ordered.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
    const next = [...ordered]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, droppedId)
    try {
      await spacePages.reorderPagesInSpace(spaceId, next)
    } catch (err) {
      console.error(err)
    }
  }

  const otherSpaces = wiki.spaces.filter((s) => s.id !== spaceId && s.status === 'active')

  return (
    <DocumentsModuleLayout
      headerActions={<DocumentsSearchBar />}
      subHeader={
        <div className="mt-6 flex flex-col gap-3 border-b border-neutral-200/80 pb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="text-2xl">{space.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Aktiv mappe</p>
              <h2 className="font-serif text-xl font-semibold text-neutral-900">{space.title}</h2>
              <p className="mt-1 text-sm text-neutral-600">{space.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {wiki.ready && (
              <button type="button" onClick={() => setFilesPanelOpen(true)} className={BTN_OUTLINE}>
                <Upload className="size-4 shrink-0" aria-hidden />
                Last opp / lenke
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setNewPageTemplateId('')
                setNewTitle('')
                setNewPageOpen(true)
              }}
              className={BTN_PRIMARY}
            >
              <FilePlus className="size-4 shrink-0" aria-hidden />
              Ny side
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-none border px-3 py-2 text-xs font-medium ${
              filter === f
                ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
            }`}
          >
            {f === 'all' ? 'Alle' : f === 'published' ? 'Publisert' : 'Utkast'}
          </button>
        ))}
        {filter !== 'all' && (
          <span className="self-center text-xs text-neutral-500">Sortering (dra) er tilgjengelig i «Alle».</span>
        )}
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-600">Sider</h2>
        {pages.length === 0 ? (
          <p className={`${CARD} px-4 py-12 text-center text-sm text-neutral-500`}>
            Ingen sider ennå — trykk «Ny side» eller bruk en mal fra oversikten.
          </p>
        ) : (
          <div className="overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <p className="text-xs text-neutral-500">Dra håndtaket for å endre rekkefølge (kun visning «Alle»).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th className="w-10 px-2 py-3" aria-label="Sorter" />
                    <th className="px-4 py-3">Tittel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Versjon</th>
                    <th className="px-4 py-3">Oppdatert</th>
                    <th className="px-4 py-3">Revisjon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {pages.map((p) => {
                    const { due, days, revisionWarn } = revisionMeta(p)
                    const isDrag = dragId === p.id
                    const isOver = overId === p.id
                    return (
                      <tr
                        key={p.id}
                        draggable={filter === 'all'}
                        onDragStart={(e) => {
                          if (filter !== 'all') return
                          setDragId(p.id)
                          e.dataTransfer.setData('text/plain', p.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDragId(null)
                          setOverId(null)
                        }}
                        onDragOver={(e) => {
                          if (filter !== 'all' || !dragId) return
                          e.preventDefault()
                          setOverId(p.id)
                        }}
                        onDragLeave={() => setOverId((cur) => (cur === p.id ? null : cur))}
                        onDrop={(e) => {
                          e.preventDefault()
                          const id = e.dataTransfer.getData('text/plain')
                          setOverId(null)
                          setDragId(null)
                          void onDropReorder(p.id, id)
                        }}
                        className={`cursor-pointer transition-colors hover:bg-neutral-50 ${
                          isDrag ? 'opacity-50' : ''
                        } ${isOver && dragId && dragId !== p.id ? 'bg-emerald-50/80' : ''}`}
                        onClick={() => setPanelPageId(p.id)}
                      >
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          {filter === 'all' ? (
                            <span className="inline-flex cursor-grab text-neutral-300 active:cursor-grabbing" title="Dra for å sortere">
                              <GripVertical className="size-4" aria-hidden />
                            </span>
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#1a3d32]">{p.title}</span>
                          {p.summary && <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{p.summary}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-none border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
                            {STATUS_LABEL[p.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">v{p.version}</td>
                        <td className="px-4 py-3 text-xs text-neutral-600">
                          {new Date(p.updatedAt).toLocaleDateString('no-NO')}
                        </td>
                        <td className="px-4 py-3 text-xs">
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
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-600">Vedlegg</h2>
        {fileItems.length === 0 && urlItems.length === 0 ? (
          <p className={`${CARD} text-sm text-neutral-500`}>Ingen filer eller lenker. Bruk «Last opp / lenke».</p>
        ) : (
          <div className="space-y-6">
            {fileItems.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {fileItems.map((it) => (
                  <div key={it.id} className={`${CARD} flex flex-col`}>
                    <div className="mb-3 flex h-28 items-center justify-center rounded border border-neutral-100 bg-neutral-50">
                      {fileItemIsImage(it) ? (
                        <ImageIcon className="size-10 text-neutral-400" aria-hidden />
                      ) : (
                        <FileText className="size-10 text-neutral-400" aria-hidden />
                      )}
                    </div>
                    <p className="line-clamp-2 font-medium text-neutral-900">{it.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">{formatBytes(it.fileSize)}</p>
                    <p className="text-[11px] text-neutral-400">{new Date(it.createdAt).toLocaleDateString('no-NO')}</p>
                    <button
                      type="button"
                      className={`${BTN_OUTLINE} mt-3 w-full justify-center text-xs py-2`}
                      onClick={() => {
                        void (async () => {
                          const u = await wiki.getSpaceFileUrl(it)
                          if (u) window.open(u, '_blank', 'noopener,noreferrer')
                        })()
                      }}
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      Åpne
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Slette filen?')) void wiki.deleteSpaceItem(it)
                        }}
                        className="mt-2 text-xs text-red-600 hover:underline"
                      >
                        Slett
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {urlItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Eksterne lenker</h3>
                <ul className="divide-y divide-neutral-100 rounded-none border border-neutral-200 bg-white">
                  {urlItems.map((it) => (
                    <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <a href={it.url ?? '#'} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-medium text-[#1a3d32] hover:underline">
                        <ExternalLink className="size-4 shrink-0" />
                        <span className="truncate">{it.title}</span>
                      </a>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Fjerne lenken?')) void wiki.deleteSpaceItem(it)
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Slett
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {anyOverlayOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Lukk"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setNewPageOpen(false)
              setNewPageTemplateId('')
              setFilesPanelOpen(false)
              setPanelPageId(null)
              setMoveModalOpen(false)
            }}
          />
          <div
            ref={panelRef}
            className={`relative flex h-full w-full flex-col border-l border-neutral-200 bg-white shadow-xl ${
              newPageOpen ? 'max-w-lg lg:max-w-4xl' : 'max-w-lg'
            }`}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {newPageOpen
                  ? 'Ny wiki-side'
                  : filesPanelOpen
                    ? 'Last opp / lenke'
                    : moveModalOpen
                      ? 'Flytt side'
                      : panelPage
                        ? panelPage.title
                        : 'Detaljer'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setNewPageOpen(false)
                  setNewPageTemplateId('')
                  setFilesPanelOpen(false)
                  setPanelPageId(null)
                  setMoveModalOpen(false)
                }}
                className="rounded-none p-2 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {newPageOpen && (
                <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Velg en mal eller la feltet for mal stå tomt for en blank side. Du kan overstyre tittelen før du
                    oppretter.
                  </p>
                  <div className="max-h-[40vh] space-y-2 overflow-y-auto border border-neutral-100 bg-neutral-50/80 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Mal</p>
                    <label className="flex cursor-pointer items-center gap-2 rounded-none border border-transparent bg-white px-2 py-2 text-sm hover:border-neutral-200">
                      <input
                        type="radio"
                        name="new-page-tpl"
                        checked={newPageTemplateId === ''}
                        onChange={() => setNewPageTemplateId('')}
                        className="size-4 border-neutral-300"
                      />
                      <span>Blank side</span>
                    </label>
                    {[...TEMPLATE_PICKER_GROUPS, TEMPLATE_PICKER_ANNET].map((g) => {
                      const list = templatesByPickerGroup.get(g.key) ?? []
                      if (list.length === 0) return null
                      const collapsed = tplGroupCollapsed[g.key] === true
                      return (
                        <div key={g.key} className="rounded-none border border-neutral-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setTplGroupCollapsed((prev) => ({ ...prev, [g.key]: !collapsed }))}
                            className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-bold text-neutral-700"
                          >
                            {collapsed ? (
                              <ChevronRight className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
                            ) : (
                              <ChevronDown className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
                            )}
                            {g.label}
                            <span className="font-normal text-neutral-400">({list.length})</span>
                          </button>
                          {!collapsed ? (
                            <div className="border-t border-neutral-100 px-1 pb-2">
                              {list.map((tpl) => (
                                <label
                                  key={tpl.id}
                                  className="flex cursor-pointer items-start gap-2 px-2 py-1.5 text-sm hover:bg-neutral-50"
                                >
                                  <input
                                    type="radio"
                                    name="new-page-tpl"
                                    checked={newPageTemplateId === tpl.id}
                                    onChange={() => setNewPageTemplateId(tpl.id)}
                                    className="mt-1 size-4 shrink-0 border-neutral-300"
                                  />
                                  <span className="min-w-0">
                                    <span className="font-medium text-neutral-900">{tpl.label}</span>
                                    <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-500">{tpl.description}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-neutral-500">Tittel</label>
                        <input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder={selectedNewPageTemplate ? selectedNewPageTemplate.page.title : 'Tittel på siden'}
                          required={!newPageTemplateId}
                          className={`${INPUT} mt-1 w-full`}
                        />
                      </div>
                      <button type="submit" className={BTN_PRIMARY}>
                        Opprett og rediger
                      </button>
                    </div>
                    {selectedNewPageTemplate ? (
                      <div className="min-h-[200px] w-full shrink-0 border-t border-neutral-100 pt-4 lg:w-[42%] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Forhåndsvisning</p>
                        <div className="mt-2 space-y-2 text-xs text-neutral-600">
                          {selectedNewPageTemplate.page.legalRefs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedNewPageTemplate.page.legalRefs.map((ref) => (
                                <span
                                  key={ref}
                                  className="rounded-none bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#1a3d32]"
                                >
                                  {ref}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-neutral-400">Ingen lovhenvisninger i malen.</p>
                          )}
                          <p>
                            Krever bekreftelse:{' '}
                            <strong>{selectedNewPageTemplate.page.requiresAcknowledgement ? 'Ja' : 'Nei'}</strong>
                          </p>
                          <p>
                            Lesetid:{' '}
                            <strong>
                              {selectedTemplateReadMin > 0 ? `ca. ${selectedTemplateReadMin} min` : '—'}
                            </strong>
                          </p>
                        </div>
                        <div className="mt-3 max-h-[min(50vh,420px)] overflow-auto rounded border border-neutral-200 bg-white p-2">
                          <div
                            className="origin-top-left"
                            style={{ transform: 'scale(0.82)', width: `${100 / 0.82}%` }}
                          >
                            <WikiBlockRenderer blocks={selectedNewPageTemplate.page.blocks} pageId="preview" pageVersion={1} />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </form>
              )}

              {filesPanelOpen && wiki.ready && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">Last opp filer eller legg til eksterne referanser.</p>
                  <label className={`${BTN_OUTLINE} cursor-pointer`}>
                    <Upload className="size-4 shrink-0" aria-hidden />
                    Last opp fil
                    <input type="file" className="hidden" onChange={(e) => void handleUpload(e)} disabled={busy} />
                  </label>
                  <form onSubmit={(e) => void handleAddUrl(e)} className="space-y-2 border-t border-neutral-100 pt-4">
                    <input
                      value={urlTitle}
                      onChange={(e) => setUrlTitle(e.target.value)}
                      placeholder="Tittel på referanse"
                      className={`${INPUT} w-full`}
                    />
                    <input
                      value={urlHref}
                      onChange={(e) => setUrlHref(e.target.value)}
                      placeholder="https://…"
                      type="url"
                      className={`${INPUT} w-full`}
                    />
                    <button type="submit" disabled={busy} className={BTN_PRIMARY}>
                      <Link2 className="size-4 shrink-0" aria-hidden />
                      Legg til URL
                    </button>
                  </form>
                </div>
              )}

              {moveModalOpen && panelPage && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">Velg målmappe for «{panelPage.title}».</p>
                  <select
                    value={moveTargetSpaceId}
                    onChange={(e) => setMoveTargetSpaceId(e.target.value)}
                    className={`${INPUT} w-full bg-white`}
                  >
                    <option value="">Velg mappe…</option>
                    {otherSpaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!moveTargetSpaceId}
                    onClick={() => {
                      if (!moveTargetSpaceId || !panelPage) return
                      void spacePages.movePageToSpace(panelPage.id, moveTargetSpaceId).then(() => {
                        setMoveModalOpen(false)
                        setPanelPageId(null)
                        setMoveTargetSpaceId('')
                        navigate(`/documents/space/${moveTargetSpaceId}`)
                      })
                    }}
                    className={`${BTN_PRIMARY} w-full justify-center`}
                  >
                    <FolderInput className="size-4 shrink-0" />
                    Flytt hit
                  </button>
                </div>
              )}

              {panelPage && !newPageOpen && !filesPanelOpen && !moveModalOpen && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-none border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium">
                      {STATUS_LABEL[panelPage.status]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                      <BookOpen className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />v{panelPage.version}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                      <Clock className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                      {new Date(panelPage.updatedAt).toLocaleDateString('no-NO')}
                    </span>
                    {panelPage.isPinned ? (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                        <Pin className="size-3" aria-hidden />
                        Festet
                      </span>
                    ) : null}
                  </div>
                  {panelPage.summary && <p className="text-sm text-neutral-600">{panelPage.summary}</p>}
                  {panelPage.nextRevisionDueAt && (
                    <p className="text-xs text-neutral-600">
                      Neste revisjon:{' '}
                      <strong>{new Date(panelPage.nextRevisionDueAt).toLocaleDateString('no-NO')}</strong>
                    </p>
                  )}
                  {panelPage.legalRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {panelPage.legalRefs.slice(0, 6).map((r) => (
                        <span key={r} className="rounded-none bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-neutral-100 pt-4">
                    <p className="mb-2 text-xs font-semibold text-neutral-500">Side</p>
                    <button
                      type="button"
                      onClick={() =>
                        void spacePages.updatePage(panelPage.id, { isPinned: !panelPage.isPinned })
                      }
                      className={`${BTN_OUTLINE} mb-2 w-full justify-center text-xs py-2`}
                    >
                      {panelPage.isPinned ? (
                        <>
                          <PinOff className="size-4 shrink-0" /> Fjern feste
                        </>
                      ) : (
                        <>
                          <Pin className="size-4 shrink-0" /> Fest på forsiden
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={otherSpaces.length === 0}
                      onClick={() => {
                        setMoveTargetSpaceId(otherSpaces[0]?.id ?? '')
                        setMoveModalOpen(true)
                      }}
                      className={`${BTN_OUTLINE} mb-2 w-full justify-center text-xs py-2 disabled:opacity-40`}
                    >
                      <FolderInput className="size-4 shrink-0" />
                      Flytt til annet space
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
                    <Link to={`/documents/page/${panelPage.id}`} className={`${BTN_OUTLINE} w-full justify-center`}>
                      <Eye className="size-4 shrink-0" aria-hidden />
                      Forhåndsvis
                    </Link>
                    <Link to={`/documents/page/${panelPage.id}/edit`} className={`${BTN_PRIMARY} w-full justify-center`}>
                      <Pencil className="size-4 shrink-0" aria-hidden />
                      Rediger
                    </Link>
                    {panelPage.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => void spacePages.publishPage(panelPage.id)}
                        className={`${BTN_OUTLINE} w-full justify-center text-emerald-800`}
                      >
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                        Publiser
                      </button>
                    )}
                    {panelPage.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => void spacePages.archivePage(panelPage.id)}
                        className={`${BTN_OUTLINE} w-full justify-center`}
                      >
                        <Archive className="size-4 shrink-0" aria-hidden />
                        Arkiver
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Slett siden?')) void spacePages.deletePage(panelPage.id)
                        setPanelPageId(null)
                      }}
                      className="rounded-none border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
                    >
                      <Trash2 className="mr-2 inline size-4 align-text-bottom" aria-hidden />
                      Slett
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DocumentsModuleLayout>
  )
}
