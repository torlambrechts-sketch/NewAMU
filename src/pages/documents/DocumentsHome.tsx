import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Pin,
  Plus,
} from 'lucide-react'
import { useComplianceDocs, useDocumentTemplates, useWikiSpaces } from '../../hooks/useDocuments'
import type { PageTemplate, WikiSpace } from '../../types/documents'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentsSearchBar } from '../../components/documents/DocumentsSearchBar'
import { readingMinutesFromBlocks } from '../../lib/wikiPageContent'

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

const CATEGORY_ORDER: WikiSpace['category'][] = [
  'hms_handbook',
  'policy',
  'procedure',
  'guide',
  'template_library',
]

/** Template picker groups (maps DB categories into UI buckets) */
const TEMPLATE_PICKER_GROUPS: { key: string; label: string; match: (c: PageTemplate['category']) => boolean }[] = [
  { key: 'hms_policy', label: 'HMS-policy', match: (c) => c === 'hms_handbook' || c === 'policy' },
  { key: 'procedure', label: 'Prosedyre', match: (c) => c === 'procedure' },
  { key: 'beredskap', label: 'Beredskap', match: (c) => c === 'guide' },
  { key: 'opplaering', label: 'Opplæring', match: (c) => c === 'template_library' },
]

function templatePickerGroupKey(cat: PageTemplate['category']): string {
  const g = TEMPLATE_PICKER_GROUPS.find((x) => x.match(cat))
  return g?.key ?? 'annet'
}

const TEMPLATE_PICKER_ANNET = { key: 'annet', label: 'Annet' }

const BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 text-sm font-medium text-white hover:bg-[#142e26]'
const BTN_OUTLINE =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'
const INPUT =
  'rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'
const CARD =
  'rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm transition hover:border-neutral-300'

export function DocumentsHome() {
  const wiki = useWikiSpaces()
  const compliance = useComplianceDocs()
  const tmpl = useDocumentTemplates()
  const navigate = useNavigate()

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

  const [tplGroupCollapsed, setTplGroupCollapsed] = useState<Record<string, boolean>>({})

  const [quickOpen, setQuickOpen] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCategory, setQuickCategory] = useState<WikiSpace['category']>('hms_handbook')
  const [savingSpace, setSavingSpace] = useState(false)
  const [collapsed, setCollapsed] = useState<Partial<Record<WikiSpace['category'], boolean>>>({})

  const activeSpaces = wiki.spaces.filter((s) => s.status === 'active')
  const loadError = wiki.error ?? compliance.error ?? tmpl.error

  const pinnedPages = useMemo(
    () => compliance.pages.filter((p) => p.isPinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [compliance.pages],
  )

  const spacesByCategory = useMemo(() => {
    const m = new Map<WikiSpace['category'], WikiSpace[]>()
    for (const c of CATEGORY_ORDER) m.set(c, [])
    for (const s of activeSpaces) {
      const arr = m.get(s.category) ?? []
      arr.push(s)
      m.set(s.category, arr)
    }
    return m
  }, [activeSpaces])

  async function handleQuickCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    setSavingSpace(true)
    try {
      await wiki.createSpace(quickTitle.trim(), '', quickCategory, CATEGORY_ICONS[quickCategory])
      setQuickTitle('')
      setQuickOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingSpace(false)
    }
  }

  return (
    <DocumentsModuleLayout
      headerActions={<DocumentsSearchBar />}
      subHeader={
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-b border-neutral-200/80 pb-6">
          {!quickOpen ? (
            <>
              <Link to="/documents/my" className={BTN_OUTLINE}>
                Mine dokumenter
              </Link>
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className={`${BTN_PRIMARY} gap-2`}
                title="Ny mappe"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                Ny mappe
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => void handleQuickCreate(e)}
              className="flex w-full max-w-xl flex-wrap items-end gap-2 rounded-none border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <div className="min-w-[140px] flex-1">
                <label className="text-[10px] font-bold uppercase text-neutral-500">Tittel</label>
                <input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Mappenavn"
                  required
                  className={`${INPUT} mt-0.5 w-full`}
                  autoFocus
                />
              </div>
              <div className="w-40">
                <label className="text-[10px] font-bold uppercase text-neutral-500">Kategori</label>
                <select
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value as WikiSpace['category'])}
                  className={`${INPUT} mt-0.5 w-full bg-white`}
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={savingSpace} className={BTN_PRIMARY}>
                {savingSpace ? '…' : 'Opprett'}
              </button>
              <button type="button" onClick={() => setQuickOpen(false)} className={BTN_OUTLINE}>
                Avbryt
              </button>
            </form>
          )}
        </div>
      }
    >
      {loadError && (
        <div className="mt-4 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Publiserte sider" value={compliance.stats.published} icon={<FileText className="size-5 text-emerald-600" />} />
        <StatCard label="Utkast" value={compliance.stats.drafts} icon={<BookOpen className="size-5 text-amber-500" />} />
        <StatCard label="Krever signatur" value={compliance.stats.requireAck} icon={<FileText className="size-5 text-[#1a3d32]" />} />
        <StatCard label="Compliance-kvitteringer" value={compliance.stats.acknowledged} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
      </div>

      {wiki.myRecentWikiEdits.length > 0 && (
        <div className="mt-8 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-800">Sist redigert av meg</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {wiki.myRecentWikiEdits.map((row) => (
              <li key={row.pageId} className="py-2 first:pt-0">
                <Link to={`/documents/page/${row.pageId}`} className="text-sm font-medium text-[#1a3d32] hover:underline">
                  {row.pageTitle}
                </Link>
                <p className="text-xs text-neutral-500">
                  {row.action === 'created' ? 'Opprettet' : row.action === 'published' ? 'Publisert' : 'Oppdatert'}{' '}
                  {new Date(row.at).toLocaleString('no-NO')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pinnedPages.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-500">
            <Pin className="size-4 text-amber-600" aria-hidden />
            Festede sider
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {pinnedPages.map((p) => {
              const sp = wiki.spaces.find((s) => s.id === p.spaceId)
              return (
                <Link
                  key={p.id}
                  to={`/documents/page/${p.id}`}
                  className="min-w-[200px] max-w-[260px] shrink-0 rounded-none border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm transition hover:border-amber-300"
                >
                  <span className="text-xs font-medium text-amber-900">{sp?.title ?? 'Mappe'}</span>
                  <p className="mt-1 line-clamp-2 font-serif text-sm font-semibold text-neutral-900">{p.title}</p>
                  <span
                    className={`mt-2 inline-block rounded-none border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      p.status === 'published'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : p.status === 'draft'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-neutral-200 bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {p.status === 'published' ? 'Publisert' : p.status === 'draft' ? 'Utkast' : 'Arkivert'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-neutral-500">Mapper</h2>
        <div className="space-y-8">
          {CATEGORY_ORDER.map((cat) => {
            const list = spacesByCategory.get(cat) ?? []
            if (list.length === 0) return null
            const isCollapsed = collapsed[cat] === true
            return (
              <section key={cat}>
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [cat]: !isCollapsed }))}
                  className="mb-3 flex w-full items-center gap-2 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-neutral-400" aria-hidden />
                  ) : (
                    <ChevronDown className="size-4 text-neutral-400" aria-hidden />
                  )}
                  <span className="text-sm font-bold text-neutral-800">{CATEGORY_LABELS[cat]}</span>
                  <span className="text-xs text-neutral-500">({list.length})</span>
                </button>
                {!isCollapsed ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((space) => {
                      const pagesInSpace = compliance.pages.filter((p) => p.spaceId === space.id)
                      const published = pagesInSpace.filter((p) => p.status === 'published').length
                      const latest = [...pagesInSpace].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
                      return (
                        <Link key={space.id} to={`/documents/space/${space.id}`} className={CARD}>
                          <div className="flex items-start gap-3 border-b border-neutral-100 pb-3">
                            <span className="text-2xl">{space.icon}</span>
                            <div className="min-w-0 flex-1">
                              <span className="inline-block rounded-none border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                                {CATEGORY_LABELS[space.category]}
                              </span>
                              <div className="mt-1 font-serif text-lg font-semibold leading-snug text-[#1a3d32]">{space.title}</div>
                            </div>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm text-neutral-600">{space.description || 'Ingen beskrivelse.'}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                            <span className="inline-flex items-center gap-1.5">
                              <BookOpen className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                              {pagesInSpace.length} {pagesInSpace.length === 1 ? 'side' : 'sider'} · {published} publisert
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5 shrink-0 text-neutral-400" />
                              Mappe oppdatert {new Date(space.updatedAt).toLocaleDateString('no-NO')}
                            </span>
                          </div>
                          {latest ? (
                            <p className="mt-2 line-clamp-1 text-xs text-neutral-500">
                              Siste side: <span className="font-medium text-neutral-700">{latest.title}</span>
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-neutral-400">Ingen sider i mappen ennå.</p>
                          )}
                          <span className={`${BTN_OUTLINE} mt-4 w-full sm:w-auto`}>Åpne mappe →</span>
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Malbibliotek</h2>
          <span className="text-xs text-neutral-500">{tmpl.pageTemplates.length} tilgjengelige maler</span>
        </div>
        <div className="space-y-6">
          {[...TEMPLATE_PICKER_GROUPS, TEMPLATE_PICKER_ANNET].map((g) => {
            const list = templatesByPickerGroup.get(g.key) ?? []
            if (list.length === 0) return null
            const collapsed = tplGroupCollapsed[g.key] === true
            return (
              <section key={g.key}>
                <button
                  type="button"
                  onClick={() => setTplGroupCollapsed((prev) => ({ ...prev, [g.key]: !collapsed }))}
                  className="mb-3 flex w-full items-center gap-2 text-left"
                >
                  {collapsed ? (
                    <ChevronRight className="size-4 text-neutral-400" aria-hidden />
                  ) : (
                    <ChevronDown className="size-4 text-neutral-400" aria-hidden />
                  )}
                  <span className="text-sm font-bold text-neutral-800">{g.label}</span>
                  <span className="text-xs text-neutral-500">({list.length})</span>
                </button>
                {!collapsed ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((tpl) => (
                      <TemplateCard
                        key={tpl.id}
                        tpl={tpl}
                        spaces={activeSpaces}
                        usageCount={tmpl.templateUsageCounts.get(tpl.id) ?? 0}
                        systemTemplateIds={systemTemplateIds}
                        onUse={async (spaceId, templateSourceId) => {
                          const page = await wiki.createPage(
                            spaceId,
                            tpl.page.title,
                            tpl.page.template,
                            tpl.page.blocks,
                            {
                              legalRefs: tpl.page.legalRefs,
                              requiresAcknowledgement: tpl.page.requiresAcknowledgement,
                              summary: tpl.page.summary,
                              acknowledgementAudience: tpl.page.acknowledgementAudience,
                              acknowledgementDepartmentId: tpl.page.acknowledgementDepartmentId,
                              revisionIntervalMonths: tpl.page.revisionIntervalMonths,
                              nextRevisionDueAt: tpl.page.nextRevisionDueAt,
                              templateSourceId: templateSourceId ?? undefined,
                            },
                          )
                          navigate(`/documents/page/${page.id}/edit`)
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      </div>
    </DocumentsModuleLayout>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-none bg-neutral-50">{icon}</div>
      <div>
        <div className="text-2xl font-semibold tabular-nums text-neutral-900">{value}</div>
        <div className="text-sm text-neutral-500">{label}</div>
      </div>
    </div>
  )
}

function TemplateCard({
  tpl,
  spaces,
  usageCount,
  systemTemplateIds,
  onUse,
}: {
  tpl: PageTemplate
  spaces: WikiSpace[]
  usageCount: number
  systemTemplateIds: Set<string>
  onUse: (spaceId: string, templateSourceId?: string | null) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(spaces[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const systemSourceId = systemTemplateIds.has(tpl.id) ? tpl.id : null
  const readMin = readingMinutesFromBlocks(tpl.page.blocks)
  const readLabel = readMin > 0 ? `ca. ${readMin} min lesing` : null

  return (
    <div className="rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="font-medium text-neutral-900">{tpl.label}</div>
        {usageCount > 0 ? (
          <span className="shrink-0 rounded-none border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            Brukt {usageCount} {usageCount === 1 ? 'gang' : 'ganger'}
          </span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{tpl.description}</p>
      {readLabel ? <p className="mt-1 text-[11px] text-neutral-400">{readLabel}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {tpl.legalBasis.slice(0, 2).map((ref) => (
          <span key={ref} className="rounded-none bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#1a3d32]">
            {ref}
          </span>
        ))}
        {tpl.legalBasis.length > 2 && (
          <span className="rounded-none bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">+{tpl.legalBasis.length - 2}</span>
        )}
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !selected}
              onClick={() => {
                setBusy(true)
                void Promise.resolve(onUse(selected, systemSourceId)).finally(() => {
                  setBusy(false)
                  setOpen(false)
                })
              }}
              className="flex-1 rounded-none border border-[#1a3d32] bg-[#1a3d32] py-1.5 text-xs font-medium text-white hover:bg-[#142e26] disabled:opacity-50"
            >
              {busy ? '…' : 'Bruk mal'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-none border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSelected(spaces[0]?.id ?? '')
            setOpen(true)
          }}
          disabled={spaces.length === 0}
          className="mt-3 w-full rounded-none border border-neutral-200 py-1.5 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Bruk mal
        </button>
      )}
    </div>
  )
}
