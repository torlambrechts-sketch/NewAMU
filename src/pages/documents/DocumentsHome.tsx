import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  Clock,
  FileText,
  ListChecks,
  Lock,
  MessageSquare,
  Pin,
  Search,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModuleKpiRow } from '../../components/module/ModuleKpiRow'
import type { ModuleKpiItem } from '../../components/module/ModuleKpiRow'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module/moduleTableKit'
import { Badge } from '../../components/ui/Badge'
import type { BadgeVariant } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { Tabs } from '../../components/ui/Tabs'
import { WarningBox } from '../../components/ui/AlertBox'
import type { WikiPage } from '../../types/documents'

/**
 * Dokumenter — Oversikt frontpage (`/documents`).
 *
 * Rebuilt from the Claude Design "Rec01 — Dokumenthub" artboard: a KPI strip,
 * a recently-updated card strip and a tabbed, filterable table of every page.
 * Renders inside the shared documents `ModulePageShell`.
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

export function DocumentsHome() {
  const docs = useDocuments()
  const { user, orgProfiles } = useOrgSetupContext()
  const navigate = useNavigate()

  const [tab, setTab] = useState<TabId>('all')
  const [query, setQuery] = useState('')
  const [spaceFilter, setSpaceFilter] = useState('')
  const [lawFilter, setLawFilter] = useState('')

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

  const lawOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of docs.pages) for (const ref of p.legalRefs) set.add(ref)
    return [...set].sort()
  }, [docs.pages])

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
        if (spaceFilter && p.spaceId !== spaceFilter) return false
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
  }, [docs.pages, tab, query, spaceFilter, lawFilter, user?.id, nameById, pendingReviewPageIds])

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

  return (
    <div className="space-y-4">
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <ModuleKpiRow items={kpis} />

      {recentCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {recentCards.map((page) => {
            const ownerName = nameById.get(page.authorId) ?? 'Ukjent eier'
            const expDays = daysUntil(page.nextRevisionDueAt)
            return (
              <div
                key={page.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/documents/page/${page.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/documents/page/${page.id}`)
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
                        {spaceById.get(page.spaceId) ?? 'Dokument'} · v{page.version}
                      </p>
                      <h3 className="font-serif text-[15px] font-semibold tracking-tight text-neutral-900">
                        {page.title}
                      </h3>
                    </div>
                  </div>
                  <Badge variant={STATUS_META[statusOf(page)].variant}>
                    {STATUS_META[statusOf(page)].label}
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
          })}
        </div>
      ) : null}

      <ModuleSectionCard className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-neutral-900">Alle dokumenter</h2>
            <p className="text-[11px] text-neutral-500">Filtrer på status, kategori, lovverk og eier.</p>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-2.5">
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
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-3">
          <div className="relative min-w-[240px] max-w-[380px] flex-1">
            <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <StandardInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="!pl-9"
              placeholder="Søk i tittel, eier, lov-anker…"
            />
          </div>
          <SearchableSelect
            value={spaceFilter}
            onChange={setSpaceFilter}
            placeholder="Kategori: Alle"
            options={[
              { value: '', label: 'Kategori: Alle' },
              ...docs.spaces.map((s) => ({ value: s.id, label: s.title })),
            ]}
            triggerClassName="py-2 text-xs"
          />
          <SearchableSelect
            value={lawFilter}
            onChange={setLawFilter}
            placeholder="Lovverk: Alle"
            options={[
              { value: '', label: 'Lovverk: Alle' },
              ...lawOptions.map((ref) => ({ value: ref, label: ref })),
            ]}
            triggerClassName="py-2 text-xs"
          />
          {query || spaceFilter || lawFilter ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setQuery('')
                setSpaceFilter('')
                setLawFilter('')
              }}
            >
              Nullstill
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={MODULE_TABLE_TH}>Tittel</th>
                <th className={MODULE_TABLE_TH}>Kategori</th>
                <th className={MODULE_TABLE_TH}>Lovverk</th>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH}>Eier</th>
                <th className={MODULE_TABLE_TH}>Versjon</th>
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
                    <td className="px-5 py-3 text-neutral-700">{spaceById.get(page.spaceId) ?? '—'}</td>
                    <td className="px-5 py-3">
                      {page.legalRefs.length > 0 ? (
                        <Badge variant="info">{page.legalRefs[0]}</Badge>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
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
                    <td className="px-5 py-3 tabular-nums text-neutral-700">v{page.version}</td>
                    <td className="px-5 py-3 text-neutral-600">{relativeTime(page.updatedAt)}</td>
                    <td className={`px-5 py-3 tabular-nums ${overdue ? 'font-medium text-red-700' : 'text-neutral-600'}`}>
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
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-neutral-500">
                    <MessageSquare className="mx-auto mb-2 h-6 w-6 text-neutral-300" aria-hidden />
                    Ingen dokumenter i dette utvalget.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
          <span>
            Viser {filtered.length} av {docs.pages.length}
          </span>
        </div>
      </ModuleSectionCard>
    </div>
  )
}
