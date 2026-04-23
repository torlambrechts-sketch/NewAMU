import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Folder, Layers, Search } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import type { WikiPage, WikiSpace } from '../../types/documents'
import { ModuleRecordsTableShell, MODULE_TABLE_TD, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../module'
import { Badge } from '../ui/Badge'
import { StandardInput } from '../ui/Input'
import { WarningBox } from '../ui/AlertBox'

/** Same as layout-reference `RefCandidateDetailPaneBlock` (`platformReferenceLayoutBlocks.tsx`). */
const BEIGE_NAV = '#EDE4D3'
const FOREST = '#1a3d32'
const SERIF = "'Libre Baskerville', Georgia, serif"

const CATEGORY_LABELS: Record<WikiSpace['category'], string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

/**
 * Documents hub layout inspired by platform layout-reference **Kandidatdetalj**:
 * ~22% beige section nav (mapper) on the **left**, standard records table (sider)
 * on the **right** — same split as {@link RefCandidateDetailPaneBlock}.
 *
 * Route: `/documents/kandidatdetalj-layout-test` (real data via {@link useDocuments}).
 */
export function DocumentKandidatdetaljLayoutWorkbench() {
  const docs = useDocuments()
  const navigate = useNavigate()
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null)
  const [folderQuery, setFolderQuery] = useState('')
  const [pageQuery, setPageQuery] = useState('')

  const activeSpaces = useMemo(() => docs.spaces.filter((s) => s.status === 'active'), [docs.spaces])

  const filteredSpaces = useMemo(() => {
    const q = folderQuery.trim().toLowerCase()
    if (!q) return activeSpaces
    return activeSpaces.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        CATEGORY_LABELS[s.category].toLowerCase().includes(q),
    )
  }, [activeSpaces, folderQuery])

  const pagesForTable = useMemo(() => {
    const q = pageQuery.trim().toLowerCase()
    let list: WikiPage[]
    if (selectedSpaceId == null) {
      const ids = new Set(activeSpaces.map((s) => s.id))
      list = docs.pages.filter((p) => ids.has(p.spaceId))
    } else {
      list = docs.pages.filter((p) => p.spaceId === selectedSpaceId)
    }
    if (!q) return list
    return list.filter((p) => p.title.toLowerCase().includes(q) || (p.summary ?? '').toLowerCase().includes(q))
  }, [docs.pages, activeSpaces, selectedSpaceId, pageQuery])

  const sortedPages = useMemo(
    () => [...pagesForTable].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [pagesForTable],
  )

  const selectedSpace = selectedSpaceId ? activeSpaces.find((s) => s.id === selectedSpaceId) : null
  const mainTitle = selectedSpace ? `Sider — ${selectedSpace.title}` : 'Sider — alle mapper'
  const mainDescription = selectedSpace
    ? `${CATEGORY_LABELS[selectedSpace.category]} · ${docs.pages.filter((p) => p.spaceId === selectedSpace.id).length} sider`
    : `${sortedPages.length} sider på tvers av aktive mapper`

  const spaceById = useMemo(() => new Map(activeSpaces.map((s) => [s.id, s])), [activeSpaces])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-neutral-500">
          <span>Dokumenter</span>
          <span className="mx-1.5 text-neutral-300">›</span>
          <span className="font-medium text-neutral-700">Layout-test</span>
          <span className="mx-1.5 text-neutral-300">›</span>
          <span>Kandidatdetalj-split</span>
        </p>
        <h2 className="mt-1.5 text-lg font-semibold text-neutral-900 sm:text-xl" style={{ fontFamily: SERIF }}>
          Mapper og dokumenter
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">
          Venstre kolonne følger layout-referansen «Kandidatdetalj» (beige seksjonsnav ~22 %). Høyre side viser standard
          tabellskall med sider fra valgt mappe eller alle mapper.
        </p>
      </div>

      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm lg:grid-cols-[minmax(200px,22%)_1fr]">
        <aside className="border-b border-neutral-200 lg:border-b-0 lg:border-r lg:border-neutral-200/80" style={{ backgroundColor: BEIGE_NAV }}>
          <div className="border-b border-neutral-200/60 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <StandardInput
                type="search"
                className="w-full py-2 pl-8 text-xs"
                placeholder="Søk i mapper…"
                value={folderQuery}
                onChange={(e) => setFolderQuery(e.target.value)}
                aria-label="Søk i mapper"
              />
            </div>
          </div>
          <nav className="max-h-[min(70vh,32rem)] overflow-y-auto p-2" aria-label="Dokumentmapper">
            <NavFolderRow
              label="Alle mapper"
              sub={`${activeSpaces.length} aktive`}
              icon={<Layers className="size-4 shrink-0 text-neutral-500" aria-hidden />}
              active={selectedSpaceId == null}
              onClick={() => setSelectedSpaceId(null)}
            />
            {filteredSpaces.map((space) => {
              const count = docs.pages.filter((p) => p.spaceId === space.id).length
              return (
                <NavFolderRow
                  key={space.id}
                  label={space.title}
                  sub={`${CATEGORY_LABELS[space.category]} · ${count} sider`}
                  icon={<span className="text-base leading-none">{space.icon}</span>}
                  active={selectedSpaceId === space.id}
                  onClick={() => setSelectedSpaceId(space.id)}
                />
              )
            })}
            {filteredSpaces.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-neutral-500">Ingen mapper matcher søket.</p>
            ) : null}
          </nav>
        </aside>

        <div className="min-w-0 bg-white p-4 md:p-6">
          <ModuleRecordsTableShell
            wrapInCard={false}
            title={mainTitle}
            titleTypography="sans"
            description={mainDescription}
            toolbar={
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
            }
            footer={<span className="text-sm text-neutral-500">{sortedPages.length} treff</span>}
          >
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {selectedSpaceId == null ? (
                    <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Mappe</th>
                  ) : null}
                  <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Tittel</th>
                  <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Status</th>
                  <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Endret</th>
                </tr>
              </thead>
              <tbody>
                {sortedPages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedSpaceId == null ? 4 : 3}
                      className="px-5 py-12 text-center text-sm text-neutral-500"
                    >
                      Ingen sider i denne visningen. Velg en annen mappe eller opprett sider i en mappe.
                    </td>
                  </tr>
                ) : null}
                {sortedPages.map((page) => {
                  const space = spaceById.get(page.spaceId)
                  const statusLabel =
                    page.status === 'published' ? 'Publisert' : page.status === 'draft' ? 'Utkast' : 'Arkivert'
                  const variant = page.status === 'published' ? 'success' : 'neutral'
                  return (
                    <tr
                      key={page.id}
                      className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                      onClick={() => navigate(`/documents/page/${page.id}/edit`)}
                    >
                      {selectedSpaceId == null ? (
                        <td className={`${MODULE_TABLE_TD} text-sm text-neutral-600`}>
                          <span className="inline-flex items-center gap-2">
                            <Folder className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
                            {space?.title ?? '—'}
                          </span>
                        </td>
                      ) : null}
                      <td className={`${MODULE_TABLE_TD} text-sm text-neutral-900`}>
                        <span className="inline-flex items-center gap-2">
                          <FileText className="size-4 shrink-0 text-neutral-400" aria-hidden />
                          <span className="font-medium">{page.title}</span>
                        </span>
                      </td>
                      <td className={`${MODULE_TABLE_TD}`}>
                        <Badge variant={variant} className="scale-95">
                          {statusLabel}
                        </Badge>
                      </td>
                      <td className={`${MODULE_TABLE_TD} text-sm text-neutral-600`}>{formatShortDate(page.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ModuleRecordsTableShell>
        </div>
      </div>
    </div>
  )
}

function NavFolderRow({
  label,
  sub,
  icon,
  active,
  onClick,
}: {
  label: string
  sub: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-0.5 flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left transition ${
        active ? 'bg-white/70 text-neutral-900 shadow-sm' : 'text-neutral-600 hover:bg-white/40'
      }`}
      style={active ? { boxShadow: `inset 3px 0 0 ${FOREST}` } : undefined}
      aria-current={active ? 'true' : undefined}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{sub}</span>
      </span>
    </button>
  )
}
