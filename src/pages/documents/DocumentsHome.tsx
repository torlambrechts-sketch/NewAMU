import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cloud,
  FileText,
  FolderPlus,
  History,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PageTemplate, WikiPage, WikiSpace } from '../../types/documents'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DOCUMENTS_HUB_SECTION_IDS } from '../../components/documents/documentsHubSectionIds'
import { DocumentFolderJobsStrip, type DocumentFolderJobsItem } from '../../components/documents/DocumentFolderJobsStrip'
import { InspectionReadinessScore } from '../../components/documents/InspectionReadinessScore'
import {
  ModuleDocumentsForestCard,
  ModuleDocumentsHubLayout,
  ModuleDocumentsInsightPanel,
  ModuleRecordsTableShell,
  MODULE_TABLE_TD,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../components/module'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Button } from '../../components/ui/Button'
import { InfoBox } from '../../components/ui/AlertBox'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { useDocumentsHubActionsRegister } from '../../../modules/documents/DocumentsHubActionsContext'

const CATEGORY_LABELS: Record<WikiSpace['category'], string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

const CATEGORY_ICONS: Record<WikiSpace['category'], string> = {
  hms_handbook: '📋',
  policy: '📜',
  procedure: '🔄',
  guide: '📖',
  template_library: '🗂️',
}

const categoryOptions: SelectOption[] = (Object.keys(CATEGORY_LABELS) as WikiSpace['category'][]).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

const CATEGORY_FILTER_OPTIONS: SelectOption[] = [{ value: 'all', label: 'Alle kategorier' }, ...categoryOptions]

const DATE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'any', label: 'Når som helst' },
  { value: '7d', label: 'Siste 7 dager' },
  { value: '30d', label: 'Siste 30 dager' },
  { value: 'year', label: 'Dette året' },
]

type PageStatusFilter = 'all' | WikiPage['status']

type LibraryTab = 'recent' | 'shared' | 'starred'

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatFileSize(bytes: number | null) {
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function pagePassesDateFilter(page: WikiPage, filter: string, now: number) {
  if (filter === 'any') return true
  const t = new Date(page.updatedAt).getTime()
  if (filter === '7d') return now - t <= 7 * 86_400_000
  if (filter === '30d') return now - t <= 30 * 86_400_000
  if (filter === 'year') {
    const d = new Date(page.updatedAt)
    return d.getFullYear() === new Date(now).getFullYear()
  }
  return true
}

function daysUntil(iso: string | null | undefined) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - Date.now()) / 86_400_000)
}

function buildFolderJobsItems(
  spaces: WikiSpace[],
  pages: WikiPage[],
  categoryLabel: (c: WikiSpace['category']) => string,
): DocumentFolderJobsItem[] {
  return spaces.map((space) => {
    const inSpace = pages.filter((p) => p.spaceId === space.id)
    const sorted = [...inSpace].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    const recent = sorted.slice(0, 5).map((p) => ({
      name: p.title,
      modified: formatShortDate(p.updatedAt),
      pageId: p.id,
      spaceId: p.spaceId,
    }))
    return {
      id: space.id,
      name: space.title,
      meta: `${space.icon} ${categoryLabel(space.category)}`,
      code: space.id.slice(0, 8).toUpperCase(),
      documentCount: inSpace.length,
      recentDocuments: recent,
    }
  })
}

export function DocumentsHome() {
  const docs = useDocuments()
  const navigate = useNavigate()
  const location = useLocation()
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('documents.manage')

  const [showNewSpace, setShowNewSpace] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState<WikiSpace['category']>('hms_handbook')
  const [savingSpace, setSavingSpace] = useState(false)

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [pageStatus, setPageStatus] = useState<PageStatusFilter>('all')
  const [dateFilter, setDateFilter] = useState('any')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('recent')
  const [pageQuery, setPageQuery] = useState('')

  const openNewFolder = useCallback(() => setShowNewSpace(true), [])
  useDocumentsHubActionsRegister(openNewFolder)

  useEffect(() => {
    const raw = location.hash.replace(/^#/, '')
    if (!raw) return
    const allowed = Object.values(DOCUMENTS_HUB_SECTION_IDS) as string[]
    if (!allowed.includes(raw)) return
    queueMicrotask(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash])

  const activeSpaces = useMemo(() => docs.spaces.filter((s) => s.status === 'active'), [docs.spaces])
  const archivedSpaces = useMemo(() => docs.spaces.filter((s) => s.status === 'archived'), [docs.spaces])

  const spaceById = useMemo(() => new Map(docs.spaces.map((s) => [s.id, s])), [docs.spaces])

  const folderStripItems = useMemo(
    () => buildFolderJobsItems(activeSpaces, docs.pages, (c) => CATEGORY_LABELS[c]),
    [activeSpaces, docs.pages],
  )

  const folderStripArchived = useMemo(
    () => (archivedSpaces.length > 0 ? buildFolderJobsItems(archivedSpaces, docs.pages, (c) => CATEGORY_LABELS[c]) : []),
    [archivedSpaces, docs.pages],
  )

  const fileItems = useMemo(() => docs.spaceItems.filter((i) => i.kind === 'file'), [docs.spaceItems])
  const fileBytesTotal = useMemo(() => fileItems.reduce((s, i) => s + (i.fileSize ?? 0), 0), [fileItems])

  const clearFilters = () => {
    setCategoryFilter('all')
    setPageStatus('all')
    setDateFilter('any')
    setPageQuery('')
  }

  const now = Date.now()

  const filteredPagesForTable = useMemo(() => {
    const q = pageQuery.trim().toLowerCase()
    return docs.pages
      .filter((p) => {
        const space = spaceById.get(p.spaceId)
        if (!space || space.status !== 'active') return false
        if (libraryTab === 'shared' && p.status !== 'published') return false
        if (libraryTab === 'starred' && !p.requiresAcknowledgement) return false
        if (categoryFilter !== 'all' && space.category !== categoryFilter) return false
        if (pageStatus !== 'all' && p.status !== pageStatus) return false
        if (!pagePassesDateFilter(p, dateFilter, now)) return false
        if (q && !p.title.toLowerCase().includes(q) && !(p.summary ?? '').toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [docs.pages, spaceById, libraryTab, categoryFilter, pageStatus, dateFilter, pageQuery, now])

  const publishedCount = useMemo(() => docs.pages.filter((p) => p.status === 'published').length, [docs.pages])
  const totalPages = docs.pages.length
  const compliancePct =
    totalPages === 0 ? 100 : Math.min(100, Math.round((publishedCount / totalPages) * 100))

  const draftPages = useMemo(() => docs.pages.filter((p) => p.status === 'draft'), [docs.pages])

  const expiringPages = useMemo(() => {
    return docs.pages.filter((p) => {
      if (p.status !== 'published' || !p.nextRevisionDueAt) return false
      const d = daysUntil(p.nextRevisionDueAt)
      return d != null && d >= 0 && d <= 90
    })
  }, [docs.pages])

  const pagesNeedingAck = useMemo(() => {
    return docs.pages.filter((p) => p.status === 'published' && p.requiresAcknowledgement)
  }, [docs.pages])

  const pendingPreview = useMemo(() => {
    const rows: { id: string; title: string }[] = []
    for (const p of draftPages) {
      rows.push({ id: `draft:${p.id}`, title: p.title })
      if (rows.length >= 2) break
    }
    if (rows.length < 2) {
      for (const p of pagesNeedingAck) {
        if (docs.receipts.some((r) => r.pageId === p.id)) continue
        rows.push({ id: `ack:${p.id}`, title: p.title })
        if (rows.length >= 2) break
      }
    }
    return rows
  }, [draftPages, pagesNeedingAck, docs.receipts])

  const pendingCount = draftPages.length + pagesNeedingAck.filter((p) => !docs.receipts.some((r) => r.pageId === p.id)).length

  const libraryDescription =
    libraryTab === 'recent'
      ? 'Sider sortert etter siste endring (mapper som er aktive).'
      : libraryTab === 'shared'
        ? 'Kun publiserte sider (synlige i biblioteket).'
        : 'Sider som krever les og bekreft (signatur / kvittering).'

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSavingSpace(true)
    try {
      await docs.createSpace(newTitle, newDesc, newCategory, CATEGORY_ICONS[newCategory])
      setNewTitle('')
      setNewDesc('')
      setShowNewSpace(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingSpace(false)
    }
  }

  const filterAside = (
    <ModuleDocumentsInsightPanel title="Filtre">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-neutral-700">Kategori (mappe)</p>
          <SearchableSelect
            className="mt-1.5"
            value={categoryFilter}
            options={CATEGORY_FILTER_OPTIONS}
            onChange={setCategoryFilter}
            placeholder="Velg kategori"
            triggerClassName="py-2 text-xs"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-700">Sidestatus</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { id: 'all' as const, label: 'Alle' },
                { id: 'published' as const, label: 'Publisert' },
                { id: 'draft' as const, label: 'Utkast' },
                { id: 'archived' as const, label: 'Arkivert' },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={pageStatus === opt.id ? 'primary' : 'secondary'}
                onClick={() => setPageStatus(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-700">Endret</p>
          <SearchableSelect
            className="mt-1.5"
            value={dateFilter}
            options={DATE_FILTER_OPTIONS}
            onChange={setDateFilter}
            placeholder="Tidsrom"
            triggerClassName="py-2 text-xs"
          />
        </div>
        <Button type="button" variant="secondary" className="w-full" onClick={clearFilters}>
          Nullstill filtre
        </Button>
        <InfoBox>Mapper åpnes fra katalogen over. Bruk fanene under for å begrense listen.</InfoBox>
      </div>
    </ModuleDocumentsInsightPanel>
  )

  const storageCard = (
    <ModuleDocumentsForestCard icon={Cloud} title="Vedlegg i mapper">
      <p className="text-[11px] leading-snug text-white/75">
        {fileItems.length} fil{fileItems.length === 1 ? '' : 'er'} · {formatFileSize(fileBytesTotal || null)} totalt
      </p>
      <p className="mt-1 text-[10px] leading-snug text-white/60">Opplasting til mappe skjer inne i hver mappe.</p>
    </ModuleDocumentsForestCard>
  )

  const pendingCard = (
    <ModuleDocumentsForestCard icon={AlertTriangle} title="Utkast og oppfølging">
      {pendingCount === 0 ? (
        <p className="text-[11px] leading-snug text-white/75">Ingen utkast eller sider som mangler kvittering i denne visningen.</p>
      ) : (
        <>
          <p className="text-2xl font-bold tabular-nums leading-tight text-white">{pendingCount}</p>
          <ul className="mt-2 space-y-2">
            {pendingPreview.map((row) => (
              <li
                key={row.id}
                className="border-b border-white/10 pb-2 text-[11px] font-medium leading-snug text-white/90 last:border-0 last:pb-0"
              >
                {row.title}
              </li>
            ))}
          </ul>
        </>
      )}
    </ModuleDocumentsForestCard>
  )

  const complianceCard = (
    <ModuleDocumentsForestCard icon={CheckCircle2} title="Publisert andel">
      <p className="text-2xl font-bold tabular-nums leading-tight text-white">{compliancePct}%</p>
      <p className="mt-1 text-[11px] leading-snug text-white/75">
        {publishedCount} av {totalPages} sider er publisert (alle mapper).
      </p>
    </ModuleDocumentsForestCard>
  )

  const expiringCard = (
    <ModuleDocumentsForestCard icon={Clock} title="Revisjon nær">
      <p className="text-2xl font-bold tabular-nums leading-tight text-white">{expiringPages.length}</p>
      <p className="mt-1 text-[11px] leading-snug text-white/75">Publiserte sider med frist innen 90 dager.</p>
    </ModuleDocumentsForestCard>
  )

  const documentsTableBlock = (
    <ModuleRecordsTableShell
      wrapInCard={false}
      title="Sider og dokumenter"
      titleTypography="sans"
      description={libraryDescription}
      headerActions={
        <Button type="button" variant="ghost" size="sm" icon={<History className="h-4 w-4" />} disabled>
          Vis historikk
        </Button>
      }
      toolbar={
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              type="search"
              className="w-full py-2 pl-10"
              placeholder="Søk i sider…"
              value={pageQuery}
              onChange={(e) => setPageQuery(e.target.value)}
              aria-label="Søk i sider"
            />
          </div>
          <Tabs
            className="shrink-0"
            overflow="scroll"
            items={[
              { id: 'recent', label: 'Nylig' },
              { id: 'shared', label: 'Delt' },
              { id: 'starred', label: 'Merket' },
            ]}
            activeId={libraryTab}
            onChange={(id) => setLibraryTab(id as LibraryTab)}
          />
        </div>
      }
      footer={<span className="text-sm text-neutral-500">{filteredPagesForTable.length} treff</span>}
    >
      <table className="min-w-full border-collapse text-sm leading-normal text-neutral-600">
        <thead>
          <tr>
            <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Tittel</th>
            <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Status</th>
            <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Mappe</th>
            <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Endret</th>
          </tr>
        </thead>
        <tbody>
          {filteredPagesForTable.map((page) => {
            const space = spaceById.get(page.spaceId)
            const statusLabel =
              page.status === 'published' ? 'Publisert' : page.status === 'draft' ? 'Utkast' : 'Arkivert'
            const variant = page.status === 'published' ? 'success' : page.status === 'draft' ? 'neutral' : 'neutral'
            return (
              <tr
                key={page.id}
                className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                onClick={() => navigate(`/documents/page/${page.id}/edit`)}
              >
                <td className={`${MODULE_TABLE_TD} text-sm text-neutral-900`}>
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                    <span className="font-medium">{page.title}</span>
                  </span>
                </td>
                <td className={`${MODULE_TABLE_TD} text-sm`}>
                  <Badge variant={variant} className="scale-95">
                    {statusLabel}
                  </Badge>
                </td>
                <td className={`${MODULE_TABLE_TD} text-sm text-neutral-600`}>{space?.title ?? '—'}</td>
                <td className={`${MODULE_TABLE_TD} text-sm text-neutral-600`}>{formatShortDate(page.updatedAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ModuleRecordsTableShell>
  )

  const topStrip = (
    <DocumentFolderJobsStrip
      folders={folderStripItems}
      archivedFolders={folderStripArchived.length > 0 ? folderStripArchived : undefined}
      onNewFolderClick={canManage ? () => setShowNewSpace(true) : undefined}
      onFolderOpen={(id) => navigate(`/documents/space/${id}`)}
      onRecentDocumentClick={(d) => {
        if (d.pageId) navigate(`/documents/page/${d.pageId}/edit`)
      }}
    />
  )

  const hubMain = <div className="space-y-4">{documentsTableBlock}</div>

  return (
    <DocumentsModuleLayout>
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <div className="mb-5 flex flex-col gap-3 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">
            <span>Dokumenter</span>
            <span className="mx-1.5 text-neutral-300">›</span>
            <span className="font-medium text-neutral-700">Oversikt</span>
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-neutral-900 sm:text-xl">Bibliotek og sider</h2>
          <p className="mt-1.5 max-w-3xl text-xs text-neutral-600 sm:text-sm">
            {canManage
              ? 'Mapper, siste sider i hver mappe og liste over alle sider. Last opp filer og opprett sider inne i den enkelte mappen.'
              : 'Mapper og sider du har tilgang til. Be administrator om ny mappe eller mal dersom du trenger det.'}
          </p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" icon={<FolderPlus className="h-4 w-4" />} onClick={() => setShowNewSpace(true)}>
              Ny mappe
            </Button>
            <Button type="button" variant="secondary" icon={<Upload className="h-4 w-4" />} disabled>
              Last opp dokument
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                const first = activeSpaces[0]
                if (!first) return
                void docs
                  .createPage(first.id, 'Ny side', 'standard', [])
                  .then((p) => navigate(`/documents/page/${p.id}/edit`))
                  .catch((err) => console.error(err))
              }}
              disabled={activeSpaces.length === 0}
            >
              Nytt dokument
            </Button>
          </div>
        ) : null}
      </div>

      <ModuleDocumentsHubLayout
        regionId={DOCUMENTS_HUB_SECTION_IDS.mapper}
        top={topStrip}
        main={hubMain}
        aside={
          <>
            {filterAside}
            {storageCard}
            {pendingCard}
            {complianceCard}
            {expiringCard}
          </>
        }
        below={
          <>
            <div id={DOCUMENTS_HUB_SECTION_IDS.readiness} className="scroll-mt-6">
              <InspectionReadinessScore />
            </div>

            {showNewSpace && canManage ? (
              <ModuleSectionCard className="p-5 md:p-6">
                <h2 className="text-sm font-semibold text-neutral-900">Ny dokumentmappe</h2>
                <form onSubmit={(e) => void handleCreateSpace(e)} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="doc-new-space-title">
                      Tittel
                    </label>
                    <StandardInput
                      id="doc-new-space-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tittel"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="doc-new-space-category">
                      Kategori
                    </label>
                    <SearchableSelect
                      value={newCategory}
                      options={categoryOptions}
                      onChange={(v) => setNewCategory(v as WikiSpace['category'])}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="doc-new-space-desc">
                      Kort beskrivelse
                    </label>
                    <StandardInput
                      id="doc-new-space-desc"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Kort beskrivelse"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="primary" disabled={savingSpace}>
                      {savingSpace ? 'Oppretter…' : 'Opprett'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setShowNewSpace(false)}>
                      Avbryt
                    </Button>
                  </div>
                </form>
              </ModuleSectionCard>
            ) : null}

            <ModuleSectionCard id={DOCUMENTS_HUB_SECTION_IDS.templates} className="scroll-mt-6 p-5 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Malbibliotek</h2>
                <span className="text-xs text-neutral-500">
                  {docs.pageTemplates.length}{' '}
                  {docs.backend === 'supabase' ? 'tilgjengelige maler' : 'mal(er) (demo lokalt)'}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {docs.pageTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    spaces={activeSpaces}
                    onUse={async (spaceId) => {
                      const page = await docs.createPage(
                        spaceId,
                        tpl.page.title,
                        tpl.page.template,
                        tpl.page.blocks,
                        {
                          legalRefs: tpl.page.legalRefs,
                          requiresAcknowledgement: tpl.page.requiresAcknowledgement,
                          summary: tpl.page.summary,
                          acknowledgementAudience: tpl.page.acknowledgementAudience,
                          revisionIntervalMonths: tpl.page.revisionIntervalMonths,
                          templateId: tpl.id,
                        },
                      )
                      navigate(`/documents/page/${page.id}/edit`)
                    }}
                  />
                ))}
              </div>
            </ModuleSectionCard>
          </>
        }
      />
    </DocumentsModuleLayout>
  )
}

function TemplateCard({
  tpl,
  spaces,
  onUse,
}: {
  tpl: PageTemplate
  spaces: WikiSpace[]
  onUse: (spaceId: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(spaces[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  const spaceOptions: SelectOption[] = useMemo(
    () => spaces.map((s) => ({ value: s.id, label: s.title })),
    [spaces],
  )

  return (
    <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="font-medium text-neutral-900">{tpl.label}</div>
      <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{tpl.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tpl.legalBasis.slice(0, 2).map((ref) => (
          <span key={ref} className="rounded bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#1a3d32]">
            {ref}
          </span>
        ))}
        {tpl.legalBasis.length > 2 && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
            +{tpl.legalBasis.length - 2}
          </span>
        )}
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <SearchableSelect value={selected} options={spaceOptions} onChange={(v) => setSelected(v)} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy || !selected}
              onClick={() => {
                setBusy(true)
                void Promise.resolve(onUse(selected)).finally(() => {
                  setBusy(false)
                  setOpen(false)
                })
              }}
            >
              {busy ? '…' : 'Bruk mal'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            setSelected(spaces[0]?.id ?? '')
            setOpen(true)
          }}
          disabled={spaces.length === 0}
        >
          + Bruk mal
        </Button>
      )}
    </div>
  )
}
