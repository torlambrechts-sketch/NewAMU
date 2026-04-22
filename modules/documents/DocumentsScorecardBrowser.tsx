import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, FolderOpen, Search } from 'lucide-react'
import { useDocuments } from '../../src/hooks/useDocuments'
import type { PageStatus, SpaceCategory, WikiPage, WikiSpace } from '../../src/types/documents'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { Badge } from '../../src/components/ui/Badge'
import {
  DOCUMENTS_SCORECARD_CREAM_DEEP,
  DOCUMENTS_SCORECARD_FOREST,
  DOCUMENTS_SCORECARD_SERIF,
  DOCUMENTS_SCORECARD_SKILLS_BG,
} from './documentsScorecardLayoutConstants'

const MAX_VISIBLE = 7

const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as SpaceCategory[]

const PAGE_STATUS_LABEL: Record<PageStatus, string> = {
  published: 'Publisert',
  draft: 'Utkast',
  archived: 'Arkivert',
}

type ListKind = 'space' | 'page'

type BrowserRow = {
  kind: ListKind
  id: string
  title: string
  meta: string
  href: string
  updatedAt: string
  pageStatus?: PageStatus
}

function WhiteCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-neutral-200/80 bg-white shadow-sm ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

function statusBadgeVariant(status: PageStatus): 'success' | 'draft' | 'neutral' {
  if (status === 'published') return 'success'
  if (status === 'draft') return 'draft'
  return 'neutral'
}

function rowsForCategory(
  category: SpaceCategory,
  spaces: WikiSpace[],
  pages: WikiPage[],
  q: string,
  statusFilter: 'all' | PageStatus,
): BrowserRow[] {
  const query = q.trim().toLowerCase()
  const catSpaces = spaces.filter((s) => s.status === 'active' && s.category === category)
  const spaceById = new Map(spaces.map((s) => [s.id, s]))

  const out: BrowserRow[] = []

  for (const s of catSpaces) {
    const matches =
      !query ||
      s.title.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      CATEGORY_LABELS[s.category].toLowerCase().includes(query)
    if (matches) {
      out.push({
        kind: 'space',
        id: s.id,
        title: s.title,
        meta: 'Mappe',
        href: `/documents/space/${s.id}`,
        updatedAt: s.updatedAt,
      })
    }
  }

  for (const p of pages) {
    const sp = spaceById.get(p.spaceId)
    if (!sp || sp.category !== category) continue
    if (statusFilter !== 'all' && p.status !== statusFilter) continue
    const matches =
      !query ||
      p.title.toLowerCase().includes(query) ||
      (p.summary ?? '').toLowerCase().includes(query) ||
      sp.title.toLowerCase().includes(query)
    if (matches) {
      out.push({
        kind: 'page',
        id: p.id,
        title: p.title,
        meta: `${sp.title} · ${PAGE_STATUS_LABEL[p.status]}`,
        href: `/documents/page/${p.id}`,
        updatedAt: p.updatedAt,
        pageStatus: p.status,
      })
    }
  }

  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return out
}

function categoryEmoji(category: SpaceCategory): string {
  switch (category) {
    case 'hms_handbook':
      return '📋'
    case 'policy':
      return '📜'
    case 'procedure':
      return '🔄'
    case 'guide':
      return '📖'
    default:
      return '🗂️'
  }
}

function CategoryScorecard({
  category,
  rows,
  expanded,
  onToggleExpand,
}: {
  category: SpaceCategory
  rows: BrowserRow[]
  expanded: boolean
  onToggleExpand: () => void
}) {
  const limit = expanded ? rows.length : MAX_VISIBLE
  const visible = rows.slice(0, limit)
  const hidden = rows.length - visible.length

  const folderCount = rows.filter((r) => r.kind === 'space').length
  const pageCount = rows.filter((r) => r.kind === 'page').length

  return (
    <WhiteCard className="flex h-[28rem] flex-col overflow-hidden p-0">
      <div className="flex shrink-0 items-start gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="mt-0.5 text-xl" aria-hidden>
          {categoryEmoji(category)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900" style={{ fontFamily: DOCUMENTS_SCORECARD_SERIF }}>
            {CATEGORY_LABELS[category]}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {folderCount} mapper · {pageCount} dokumenter
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Totalt</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: DOCUMENTS_SCORECARD_FOREST }}>
            {rows.length}
          </p>
        </div>
      </div>
      <div className="shrink-0 px-4 py-2">
        <span className="inline-flex rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900">
          Kategori
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col border-t border-neutral-100" style={{ backgroundColor: DOCUMENTS_SCORECARD_SKILLS_BG }}>
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-700">Innhold</span>
          <span className="text-xs text-neutral-600">Sist oppdatert</span>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-1">
          {visible.length === 0 ? (
            <li className="text-sm text-neutral-500">Ingen treff i denne kategorien.</li>
          ) : (
            visible.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <Link
                  to={row.href}
                  className="flex items-start gap-2 rounded-md border border-transparent px-1 py-1.5 text-sm transition hover:border-neutral-200 hover:bg-white/80"
                >
                  {row.kind === 'space' ? (
                    <FolderOpen className="mt-0.5 size-4 shrink-0 text-[#1a3d32]" aria-hidden />
                  ) : (
                    <FileText className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-neutral-900">{row.title}</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{row.meta}</span>
                  </span>
                  <Badge
                    variant={row.kind === 'page' ? statusBadgeVariant(row.pageStatus ?? 'published') : 'neutral'}
                    className="shrink-0 text-[10px]"
                  >
                    {row.kind === 'space' ? 'Mappe' : 'Side'}
                  </Badge>
                </Link>
              </li>
            ))
          )}
        </ul>
        {hidden > 0 ? (
          <div className="shrink-0 border-t border-neutral-100/80 px-4 py-2">
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-0 w-full justify-between p-2 text-xs font-semibold uppercase tracking-wide text-neutral-700"
              onClick={onToggleExpand}
            >
              <span>Flere ({hidden})</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ) : expanded && rows.length > MAX_VISIBLE ? (
          <div className="shrink-0 border-t border-neutral-100/80 px-4 py-2">
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-0 w-full p-2 text-xs font-semibold uppercase tracking-wide text-neutral-700"
              onClick={onToggleExpand}
            >
              Vis færre
            </Button>
          </div>
        ) : null}
      </div>
    </WhiteCard>
  )
}

const statusFilterOptions: SelectOption[] = [
  { value: 'all', label: 'Alle statuser' },
  { value: 'published', label: PAGE_STATUS_LABEL.published },
  { value: 'draft', label: PAGE_STATUS_LABEL.draft },
  { value: 'archived', label: PAGE_STATUS_LABEL.archived },
]

/**
 * Scorecard-style overview of folders + documents per space category.
 * Visual language matches platform layout-reference scorecard (cream filter strip, candidate-style white cards).
 * For testing under `/documents/scorecard-browser` — not the canonical hub table yet.
 */
export function DocumentsScorecardBrowser() {
  const docs = useDocuments()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PageStatus>('all')
  const [expandedByCat, setExpandedByCat] = useState<Partial<Record<SpaceCategory, boolean>>>({})

  const activeSpaces = useMemo(() => docs.spaces.filter((s) => s.status === 'active'), [docs.spaces])

  const rowsByCategory = useMemo(() => {
    const m = new Map<SpaceCategory, BrowserRow[]>()
    for (const c of ALL_CATEGORIES) {
      m.set(c, rowsForCategory(c, activeSpaces, docs.pages, search, statusFilter))
    }
    return m
  }, [activeSpaces, docs.pages, search, statusFilter])

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <StandardInput
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk i mapper og dokumenter…"
          className="py-2.5 pl-10"
        />
      </div>

      <div
        className="grid gap-4 rounded-lg border border-neutral-200/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ backgroundColor: DOCUMENTS_SCORECARD_CREAM_DEEP }}
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Status (dokumenter)</p>
          <div className="mt-1.5">
            <SearchableSelect
              value={statusFilter}
              options={statusFilterOptions}
              onChange={(v) => setStatusFilter(v as 'all' | PageStatus)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {ALL_CATEGORIES.map((category) => (
          <CategoryScorecard
            key={category}
            category={category}
            rows={rowsByCategory.get(category) ?? []}
            expanded={Boolean(expandedByCat[category])}
            onToggleExpand={() =>
              setExpandedByCat((prev) => ({ ...prev, [category]: !prev[category] }))
            }
          />
        ))}
      </div>
    </div>
  )
}
