import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  LayoutGrid,
  ListChecks,
  Lock,
  MessageSquare,
  Pin,
  Rows3,
  Search,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModuleKpiRow } from '../../components/module/ModuleKpiRow'
import type { ModuleKpiItem } from '../../components/module/ModuleKpiRow'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module/moduleTableKit'
import { Badge } from '../../components/ui/Badge'
import type { BadgeVariant } from '../../components/ui/Badge'
import { StandardInput } from '../../components/ui/Input'
import { Tabs } from '../../components/ui/Tabs'
import { WarningBox } from '../../components/ui/AlertBox'
import type { WikiPage } from '../../types/documents'

/**
 * Dokumenter — Oversikt frontpage (`/documents`).
 *
 * Rebuilt to use the Records-shell pattern: two-column layout with a category
 * rail on the left (spaces as categories) and a content card on the right
 * with tab strip, search, and view-mode switcher (Tabell | Bokser).
 * The KPI strip and recent-cards strip are preserved above the shell.
 */

const AVATAR_COLORS = ['#0f766e', '#b45309', '#7e22ce', '#1a3d32', '#1e40af', '#be123c']

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.round(ms / 86_400_000)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function relativeTime(iso: string): string {
  const days = -((daysUntil(iso) ?? 0))
  if (days <= 0) return 'i dag'
  if (days === 1) return 'i går'
  if (days < 30) return `${days} d siden`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} mnd siden`
  return `${Math.round(months / 12)} år siden`
}

type StatusKey = 'aktiv' | 'kladd' | 'gjennomgang' | 'arkivert'

const STATUS_META: Record<StatusKey, { label: string; variant: BadgeVariant }> = {
  aktiv: { label: 'Aktiv', variant: 'success' },
  kladd: { label: 'Kladd', variant: 'draft' },
  gjennomgang: { label: 'Til gjennomgang', variant: 'info' },
  arkivert: { label: 'Arkivert', variant: 'neutral' },
}

type TabId = 'all' | 'mine' | 'review' | 'expiring' | 'archive'
type DocView = 'tabell' | 'bokser'

// ─── Space icon helper ────────────────────────────────────────────────────────

function getSpaceIcon(name: string): LucideIcon {
  const l = name.toLowerCase()
  if (l.includes('prosedyre') || l.includes('sjekk') || l.includes('rutine')) return ListChecks
  if (l.includes('kontrakt') || l.includes('avtale') || l.includes('policy')) return FileText
  return BookOpen
}

// ─── View switcher ────────────────────────────────────────────────────────────

const DOC_VIEW_MODES = [
  { id: 'tabell', label: 'Tabell', Icon: Rows3 },
  { id: 'bokser', label: 'Bokser', Icon: LayoutGrid },
] as const

function ViewSwitcher({ value, onChange }: { value: DocView; onChange: (v: DocView) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
      {DOC_VIEW_MODES.map(({ id, label, Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onChange(id as DocView)}
            className={[
              'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200'
                : 'text-neutral-500 hover:text-neutral-800',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Document card (used in Bokser view and recent strip) ─────────────────────

function DocCard({
  page,
  spaceLabel,
  ownerName,
  statusKey,
  onClick,
}: {
  page: WikiPage
  spaceLabel: string
  ownerName: string
  statusKey: StatusKey
  onClick: () => void
}) {
  const expDays = daysUntil(page.nextRevisionDueAt)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="flex cursor-pointer flex-col rounded-xl border border-neutral-200/80 bg-white text-left shadow-sm transition-colors hover:border-neutral-300"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {spaceLabel} · v{page.version}
            </p>
            <h3 className="font-serif text-[15px] font-semibold tracking-tight text-neutral-900">
              {page.title}
            </h3>
          </div>
        </div>
        <Badge variant={STATUS_META[statusKey].variant}>
          {STATUS_META[statusKey].label}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: avatarColor(page.authorId) }}
          >
            {initials(ownerName)}
          </span>
          <span className="text-neutral-600">{ownerName}</span>
        </div>
        <span
          className={`flex items-center gap-1 ${
            expDays != null && expDays <= 30 ? 'text-red-700' : 'text-neutral-500'
          }`}
        >
          {expDays != null && expDays <= 30 ? (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Clock className="h-3.5 w-3.5" aria-hidden />
          )}
          {expDays != null && expDays <= 30
            ? `Utløper ${formatDate(page.nextRevisionDueAt as string)}`
            : `Oppd. ${relativeTime(page.updatedAt)}`}
        </span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DocumentsHome() {
  const docs = useDocuments()
  const { user, orgProfiles } = useOrgSetupContext()
  const navigate = useNavigate()

  const [tab, setTab] = useState<TabId>('all')
  const [query, setQuery] = useState('')
  const [activeSpace, setActiveSpace] = useState('')
  const [lawFilter] = useState('')
  const [docView, setDocView] = useState<DocView>('tabell')

  useEffect(() => {
    setTab('all')
  }, [])

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of orgProfiles) map.set(p.id, p.display_name)
    return map
  }, [orgProfiles])

  const spaceById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of docs.spaces) map.set(s.id, s.title)
    return map
  }, [docs.spaces])

  /** Page ids that currently have a pending review request. */
  const pendingReviewPageIds = useMemo(() => {
    const set = new Set<string>()
    for (const r of docs.wikiReviewRequests) {
      if (r.status === 'pending') set.add(r.pageId)
    }
    return set
  }, [docs.wikiReviewRequests])

  const statusOf = (page: WikiPage): StatusKey => {
    if (page.status === 'archived') return 'arkivert'
    if (pendingReviewPageIds.has(page.id)) return 'gjennomgang'
    if (page.status === 'draft') return 'kladd'
    return 'aktiv'
  }

  const kpis = useMemo<ModuleKpiItem[]>(() => {
    const active = docs.pages.filter((p) => p.status === 'published').length
    const pendingReview = pendingReviewPageIds.size
    const expiring = docs.pages.filter((p) => {
      const d = daysUntil(p.nextRevisionDueAt)
      return d != null && d <= 30
    }).length
    const withLaw = docs.pages.filter((p) => p.legalRefs.length > 0).length
    const coverage = docs.pages.length > 0 ? Math.round((withLaw / docs.pages.length) * 100) : 0
    return [
      { big: active, title: 'Aktive dokumenter', sub: `${docs.pages.length} totalt` },
      {
        big: pendingReview,
        title: 'Til gjennomgang',
        sub: pendingReview > 0 ? 'Venter på godkjenning' : 'Ingen i kø',
        tone: pendingReview > 0 ? 'danger' : 'default',
      },
      {
        big: expiring,
        title: 'Utløper innen 30 d',
        sub: 'Krever revisjon',
        tone: expiring > 0 ? 'danger' : 'default',
      },
      { big: `${coverage}%`, title: 'Dekning lovkrav', sub: `${withLaw} sider med lov-anker` },
    ]
  }, [docs.pages, pendingReviewPageIds])

  const recentCards = useMemo(
    () =>
      [...docs.pages]
        .filter((p) => p.status === 'published')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3),
    [docs.pages],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...docs.pages]
      .filter((p) => {
        const st = statusOf(p)
        if (tab === 'mine' && p.authorId !== user?.id) return false
        if (tab === 'review' && st !== 'gjennomgang') return false
        if (tab === 'archive' && st !== 'arkivert') return false
        if (tab !== 'archive' && st === 'arkivert') return false
        if (tab === 'expiring') {
          const d = daysUntil(p.nextRevisionDueAt)
          if (d == null || d > 30) return false
        }
        if (activeSpace && p.spaceId !== activeSpace) return false
        if (lawFilter && !p.legalRefs.includes(lawFilter)) return false
        if (q) {
          const owner = nameById.get(p.authorId) ?? ''
          const hay = `${p.title} ${owner} ${p.legalRefs.join(' ')}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.pages, tab, query, activeSpace, lawFilter, user?.id, nameById, pendingReviewPageIds])

  const tabCounts = useMemo(() => {
    const mine = docs.pages.filter((p) => p.authorId === user?.id && statusOf(p) !== 'arkivert').length
    const review = docs.pages.filter((p) => statusOf(p) === 'gjennomgang').length
    const expiring = docs.pages.filter((p) => {
      const d = daysUntil(p.nextRevisionDueAt)
      return d != null && d <= 30
    }).length
    const archive = docs.pages.filter((p) => p.status === 'archived').length
    const all = docs.pages.filter((p) => p.status !== 'archived').length
    return { all, mine, review, expiring, archive }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.pages, user?.id, pendingReviewPageIds])

  // Per-space counts for the category rail (relative to current tab)
  const spaceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    // 'all' = everything matching current tab (no space filter)
    const baseFiltered = docs.pages.filter((p) => {
      const st = statusOf(p)
      if (tab === 'mine' && p.authorId !== user?.id) return false
      if (tab === 'review' && st !== 'gjennomgang') return false
      if (tab === 'archive' && st !== 'arkivert') return false
      if (tab !== 'archive' && st === 'arkivert') return false
      if (tab === 'expiring') {
        const d = daysUntil(p.nextRevisionDueAt)
        if (d == null || d > 30) return false
      }
      return true
    })
    counts[''] = baseFiltered.length
    for (const s of docs.spaces) {
      counts[s.id] = baseFiltered.filter((p) => p.spaceId === s.id).length
    }
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.pages, docs.spaces, tab, user?.id, pendingReviewPageIds])

  // Category rail items: "Alle" + each space
  const categoryItems = useMemo(() => [
    { id: '', label: 'Alle', Icon: LayoutGrid as LucideIcon },
    ...docs.spaces.map((s) => ({ id: s.id, label: s.title, Icon: getSpaceIcon(s.title) })),
  ], [docs.spaces])

  const showRecentCards = tab === 'all' && activeSpace === '' && docView === 'bokser'

  return (
    <div className="space-y-4">
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <ModuleKpiRow items={kpis} />

      {/* Two-column Records-shell layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">

        {/* ── LEFT: Category rail ── */}
        <aside>
          <div
            className="rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="hidden border-b border-neutral-100 px-4 py-3 lg:block">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Kategorier</h2>
            </div>

            {/* Mobile: horizontal chip scroll */}
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 lg:hidden">
              {categoryItems.map(({ id, label, Icon }) => {
                const isActive = id === activeSpace
                const count = spaceCounts[id] ?? 0
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSpace(id)}
                    className={[
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-[#1a3d32] text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
                    ].join(' ')}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    <span>{label}</span>
                    <span
                      className={[
                        'rounded-full px-1 py-0 text-[10px] tabular-nums',
                        isActive ? 'bg-white/20 text-white' : 'text-neutral-500',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Desktop: vertical list */}
            <ul className="hidden py-1.5 lg:block">
              {categoryItems.map(({ id, label, Icon }) => {
                const isActive = id === activeSpace
                const count = spaceCounts[id] ?? 0
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActiveSpace(id)}
                      className={[
                        'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-[#e7efe9] text-neutral-900'
                          : 'text-neutral-700 hover:bg-neutral-50',
                      ].join(' ')}
                      style={isActive ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
                    >
                      <Icon
                        className={[
                          'h-3.5 w-3.5 shrink-0',
                          isActive ? 'text-[#1a3d32]' : 'text-neutral-500',
                        ].join(' ')}
                        aria-hidden
                      />
                      <span
                        className={[
                          'min-w-0 flex-1 truncate',
                          isActive ? 'font-semibold' : 'font-medium',
                        ].join(' ')}
                      >
                        {label}
                      </span>
                      <span
                        className={[
                          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                          isActive
                            ? 'bg-white text-[#14312a]'
                            : 'bg-neutral-100 text-neutral-500',
                        ].join(' ')}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>

        {/* ── RIGHT: Content card ── */}
        <section className="min-w-0 space-y-4">
          {/* Recent cards strip — only when no filter active and in Bokser mode */}
          {showRecentCards && recentCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {recentCards.map((page) => {
                const ownerName = nameById.get(page.authorId) ?? 'Ukjent eier'
                return (
                  <DocCard
                    key={page.id}
                    page={page}
                    spaceLabel={spaceById.get(page.spaceId) ?? 'Dokument'}
                    ownerName={ownerName}
                    statusKey={statusOf(page)}
                    onClick={() => navigate(`/documents/page/${page.id}`)}
                  />
                )
              })}
            </div>
          ) : null}

          <div
            className="rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            {/* Header strip: tab strip + search + view switcher */}
            <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <Tabs
                activeId={tab}
                onChange={(id) => setTab(id as TabId)}
                items={[
                  { id: 'all', label: 'Alle', badgeCount: tabCounts.all },
                  { id: 'mine', label: 'Mine', badgeCount: tabCounts.mine },
                  { id: 'review', label: 'Til gjennomgang', badgeCount: tabCounts.review },
                  { id: 'expiring', label: 'Utløper snart', badgeCount: tabCounts.expiring },
                  { id: 'archive', label: 'Arkiv', badgeCount: tabCounts.archive },
                ]}
              />
              <ViewSwitcher value={docView} onChange={setDocView} />
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <StandardInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="!pl-9"
                  placeholder="Søk i tittel, eier, lov-anker…"
                />
              </div>
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="shrink-0 text-xs font-medium text-neutral-500 hover:text-neutral-800"
                >
                  Nullstill
                </button>
              ) : null}
            </div>

            {/* Content area */}
            {docView === 'tabell' ? (
              <>
                {/* Mobile: compact list */}
                <ul className="divide-y divide-neutral-100 sm:hidden">
                  {filtered.map((page) => {
                    const st = statusOf(page)
                    const spaceName = spaceById.get(page.spaceId) ?? '—'
                    return (
                      <li key={page.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/documents/page/${page.id}`)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 active:bg-neutral-100"
                        >
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                            <BookOpen className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-neutral-900">
                              {page.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-neutral-500">{spaceName}</div>
                          </div>
                          <Badge variant={STATUS_META[st].variant}>{STATUS_META[st].label}</Badge>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                  {filtered.length === 0 ? (
                    <li className="px-5 py-12 text-center text-sm text-neutral-500">
                      <MessageSquare className="mx-auto mb-2 h-6 w-6 text-neutral-300" aria-hidden />
                      Ingen dokumenter i dette utvalget.
                    </li>
                  ) : null}
                </ul>

                {/* Desktop: full table */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={MODULE_TABLE_TH}>Tittel</th>
                        <th className={MODULE_TABLE_TH}>Kategori</th>
                        <th className={MODULE_TABLE_TH}>Status</th>
                        <th className={MODULE_TABLE_TH}>Eier</th>
                        <th className={MODULE_TABLE_TH}>Sist endret</th>
                        <th className={MODULE_TABLE_TH}>Utløper</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((page) => {
                        const st = statusOf(page)
                        const ownerName = nameById.get(page.authorId) ?? 'Ukjent'
                        const expDays = daysUntil(page.nextRevisionDueAt)
                        const overdue = expDays != null && expDays <= 30
                        return (
                          <tr
                            key={page.id}
                            className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                            onClick={() => navigate(`/documents/page/${page.id}`)}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {page.requiresAcknowledgement ? (
                                  <Pin className="h-3.5 w-3.5 text-[#c9a227]" aria-hidden />
                                ) : (
                                  <span className="w-3.5" />
                                )}
                                {page.containsPii ? (
                                  <Lock className="h-4 w-4 text-neutral-400" aria-hidden />
                                ) : page.template === 'policy' ? (
                                  <ListChecks className="h-4 w-4 text-neutral-400" aria-hidden />
                                ) : (
                                  <FileText className="h-4 w-4 text-neutral-400" aria-hidden />
                                )}
                                <span className="font-medium text-neutral-900">{page.title}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-neutral-700">
                              {spaceById.get(page.spaceId) ?? '—'}
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant={STATUS_META[st].variant}>{STATUS_META[st].label}</Badge>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                  style={{ background: avatarColor(page.authorId) }}
                                >
                                  {initials(ownerName)}
                                </span>
                                <span className="text-neutral-700">{ownerName}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-neutral-600">{relativeTime(page.updatedAt)}</td>
                            <td
                              className={`px-5 py-3 tabular-nums ${
                                overdue ? 'font-medium text-red-700' : 'text-neutral-600'
                              }`}
                            >
                              {page.nextRevisionDueAt ? (
                                overdue ? (
                                  <span className="inline-flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                                    {formatDate(page.nextRevisionDueAt)}
                                  </span>
                                ) : (
                                  formatDate(page.nextRevisionDueAt)
                                )
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-sm text-neutral-500">
                            <MessageSquare className="mx-auto mb-2 h-6 w-6 text-neutral-300" aria-hidden />
                            Ingen dokumenter i dette utvalget.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              /* Bokser view */
              filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-neutral-500">
                  <MessageSquare className="mx-auto mb-2 h-6 w-6 text-neutral-300" aria-hidden />
                  Ingen dokumenter i dette utvalget.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((page) => {
                    const ownerName = nameById.get(page.authorId) ?? 'Ukjent eier'
                    return (
                      <DocCard
                        key={page.id}
                        page={page}
                        spaceLabel={spaceById.get(page.spaceId) ?? 'Dokument'}
                        ownerName={ownerName}
                        statusKey={statusOf(page)}
                        onClick={() => navigate(`/documents/page/${page.id}`)}
                      />
                    )
                  })}
                </div>
              )
            )}

            {/* Footer row */}
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
              <span>
                Viser {filtered.length} av {docs.pages.length}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
