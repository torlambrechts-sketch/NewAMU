/* eslint-disable no-restricted-syntax -- category rail items, filter pills,
   view-mode toggle buttons, and the inline search input are intentionally
   styled native elements. The Button/StandardInput primitives would override
   the bespoke compact chrome the design handover specifies (no border, ring
   shadows, custom hover states). See DESIGN_SYSTEM.md §3 / WikiPageTree.tsx
   for the same exception pattern. */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileEdit,
  FilePlus2,
  FileStack,
  FileText,
  FolderTree,
  History,
  LayoutGrid,
  ListChecks,
  Paperclip,
  Plus,
  Rows3,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { WarningBox } from '../../components/ui/AlertBox'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module/moduleTableKit'
import type { ComplianceReceipt, WikiPage, WikiReviewRequest, WikiSpace } from '../../types/documents'
import type { OrgCustomTemplate } from '../../hooks/useDocuments'
import {
  DOC_KIND_LABEL,
  DocKindIcon,
  DocProgressBar,
  DocStatusPill,
  Initials,
  LovChip,
  ModeToggle,
  categoryToKind,
  deriveDocStatus,
  displayVersion,
  formatIsoDate,
  type DocKind,
  type DocsMode,
  type DocStatusKey,
} from '../../components/documents/docsShared'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'

/**
 * /documents — Dokumenter & wiki hub.
 *
 * Two-column layout (Klarert Dokumenter design):
 *   • Left rail: kind-based categories (Alle / HMS / Rutiner / Risiko / Personal)
 *     + Compliance status panel + Expired warning panel.
 *   • Right section: three tabs (Dokumenter | Maler | Bekreftelser); the
 *     Dokumenter tab exposes four view modes (Tabell | Bokser | Hierarki |
 *     Tidslinje).
 *
 * Mode toggle (Enkel/Avansert) hides advanced columns + advisory panels in easy
 * mode for field users.
 */

type HubTab = 'docs' | 'maler' | 'bekreftelser'
type DocView = 'tabell' | 'bokser' | 'hierarki' | 'tidslinje'

const DOC_VIEW_MODES: { id: DocView; label: string; Icon: LucideIcon }[] = [
  { id: 'tabell', label: 'Tabell', Icon: Rows3 },
  { id: 'bokser', label: 'Bokser', Icon: LayoutGrid },
  { id: 'hierarki', label: 'Hierarki', Icon: FolderTree },
  { id: 'tidslinje', label: 'Tidslinje', Icon: CalendarDays },
]

const DOC_KIND_CATEGORIES: { id: 'all' | DocKind; label: string; Icon: LucideIcon }[] = [
  { id: 'all', label: 'Alle', Icon: LayoutGrid },
  { id: 'hms', label: 'HMS-håndbok', Icon: BookOpen },
  { id: 'rutine', label: 'Rutiner & prosedyrer', Icon: ListChecks },
  { id: 'risiko', label: 'Risikovurdering', Icon: AlertTriangle },
  { id: 'personal', label: 'Personalhåndbok', Icon: Users },
]

const MONTH_LABELS: Record<string, string> = {
  '01': 'Januar',
  '02': 'Februar',
  '03': 'Mars',
  '04': 'April',
  '05': 'Mai',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'August',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
}

/** Aggregate counts derived from the receipts table for ack KPIs. */
function buildReceiptIndex(receipts: ComplianceReceipt[]) {
  const byPage = new Map<string, Map<number, Set<string>>>()
  for (const r of receipts) {
    let byVer = byPage.get(r.pageId)
    if (!byVer) {
      byVer = new Map()
      byPage.set(r.pageId, byVer)
    }
    let users = byVer.get(r.pageVersion)
    if (!users) {
      users = new Set()
      byVer.set(r.pageVersion, users)
    }
    users.add(r.userId)
  }
  return byPage
}

/**
 * Build a DocRow snapshot. We never invent storage — every value is read from
 * existing tables (`wiki_pages`, `compliance_receipts`, `organization_members`,
 * `wiki_review_requests`).
 */
type DocRow = {
  page: WikiPage
  spaceTitle: string
  kind: DocKind
  ownerId: string
  ownerName: string
  editorId: string
  editorName: string
  status: DocStatusKey
  required: boolean
  confirmedCount: number
  totalRequired: number
  attachmentsCount: number
  editedAt: string
  publishedAt: string | null
  nextReview: string | null
}

function shellPath() {
  return '/documents'
}

function buildDocRows({
  pages,
  spaces,
  receipts,
  reviews,
  nameById,
  totalAudience,
  attachmentCounts,
}: {
  pages: WikiPage[]
  spaces: WikiSpace[]
  receipts: ComplianceReceipt[]
  reviews: WikiReviewRequest[]
  nameById: Map<string, string>
  totalAudience: number
  attachmentCounts: Map<string, number>
}): DocRow[] {
  const receiptIndex = buildReceiptIndex(receipts)
  const pendingReview = new Set<string>()
  for (const r of reviews) {
    if (r.status === 'pending') pendingReview.add(r.pageId)
  }
  const spaceById = new Map(spaces.map((s) => [s.id, s] as const))
  const now = Date.now()
  return pages.map((p) => {
    const space = spaceById.get(p.spaceId) ?? null
    const kind = categoryToKind(space?.category ?? null)
    const status = deriveDocStatus({
      status: p.status,
      archived: Boolean(p.archivedAt),
      pendingReview: pendingReview.has(p.id),
      nextRevisionAtMs: p.nextRevisionDueAt ? new Date(p.nextRevisionDueAt).getTime() : null,
      now,
    })
    const ackByVer = receiptIndex.get(p.id) ?? new Map<number, Set<string>>()
    const confirmedCount = ackByVer.get(p.version)?.size ?? 0
    const required = Boolean(p.requiresAcknowledgement)
    return {
      page: p,
      spaceTitle: space?.title ?? '—',
      kind,
      ownerId: p.authorId,
      ownerName: nameById.get(p.authorId) ?? 'Ukjent eier',
      editorId: p.authorId,
      editorName: nameById.get(p.authorId) ?? 'Ukjent',
      status,
      required,
      confirmedCount: required ? confirmedCount : 0,
      totalRequired: required ? totalAudience : 0,
      attachmentsCount: attachmentCounts.get(p.spaceId) ?? 0,
      editedAt: p.updatedAt,
      publishedAt: p.status === 'published' ? p.updatedAt : null,
      nextReview: p.nextRevisionDueAt ?? null,
    }
  })
}

export function DocumentsHome() {
  const docs = useDocuments()
  const navigate = useNavigate()
  const { orgProfiles, members, isAdmin, can } = useOrgSetupContext()

  const [mode, setMode] = useState<DocsMode>('advanced')
  const [category, setCategory] = useState<'all' | DocKind>('all')
  const [tab, setTab] = useState<HubTab>('docs')
  const [view, setView] = useState<DocView>('tabell')
  const [query, setQuery] = useState('')

  const easy = mode === 'easy'
  const canManage = isAdmin || can('documents.manage')

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of orgProfiles) map.set(p.id, p.display_name)
    return map
  }, [orgProfiles])

  // Total ack audience — treat all members as the universe of confirmers.
  // (Per-page audience filters live in `requiredAckRoles` / department; the
  // hub only needs a sane denominator.)
  const totalAudience = useMemo(() => members.length, [members])

  // Attachment counts derived from wiki_space_items already on the store —
  // shown as the paperclip pill in table/box views. Comments aren't loaded
  // at the org level by `useDocuments`, so we surface them only inside the
  // per-page detail (where `useWikiPageComments(pageId)` fetches the thread).
  const attachmentCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const item of docs.spaceItems) {
      m.set(item.spaceId, (m.get(item.spaceId) ?? 0) + 1)
    }
    return m
  }, [docs.spaceItems])

  const rows = useMemo(
    () =>
      buildDocRows({
        pages: docs.pages,
        spaces: docs.spaces,
        receipts: docs.receipts,
        reviews: docs.wikiReviewRequests,
        nameById,
        totalAudience,
        attachmentCounts,
      }),
    [
      docs.pages,
      docs.spaces,
      docs.receipts,
      docs.wikiReviewRequests,
      nameById,
      totalAudience,
      attachmentCounts,
    ],
  )

  const allCounts = useMemo(() => {
    const docsCount = rows.length
    const templatesCount = docs.orgCustomTemplates.length + docs.systemTemplatesCatalog.length
    return { docs: docsCount, maler: templatesCount }
  }, [rows.length, docs.orgCustomTemplates.length, docs.systemTemplatesCatalog.length])

  const perKindCounts = useMemo(() => {
    const out: Record<DocKind, { docs: number; maler: number }> = {
      hms: { docs: 0, maler: 0 },
      rutine: { docs: 0, maler: 0 },
      risiko: { docs: 0, maler: 0 },
      personal: { docs: 0, maler: 0 },
      annet: { docs: 0, maler: 0 },
    }
    for (const r of rows) out[r.kind].docs += 1
    // Templates don't have a SpaceCategory yet (they reference template tables)
    // — keep the breakdown 0 for now and only show the "Alle" totals.
    return out
  }, [rows])

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (category !== 'all' && r.kind !== category) return false
      if (q) {
        const hay = `${r.page.title} ${r.ownerName} ${r.page.legalRefs.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, category, query])

  // Health metrics for the rail (advanced mode only)
  const required = rows.filter((r) => r.required)
  const expired = rows.filter((r) => r.status === 'utgått')
  const dueSoon = rows.filter((r) => r.status === 'til revisjon')
  const inReview = rows.filter((r) => r.status === 'til godkjenning')
  const confirmedAvg = (() => {
    const reqs = required.filter((r) => r.totalRequired > 0)
    if (!reqs.length) return 0
    return reqs.reduce((a, r) => a + r.confirmedCount / r.totalRequired, 0) / reqs.length
  })()

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: DOCUMENTS_MODULE_TITLE, to: shellPath() },
      ]}
      title="Dokumenter & wiki"
      description={
        easy
          ? 'Skriv, godkjenn og publiser styrende dokumenter — håndbok, rutiner, SJA.'
          : 'Styrende dokumenter med revisjonshistorikk, bekreftelse fra ansatte og lovkobling. Lovpålagte dokumenter merket med skjold.'
      }
      headerActions={
        <>
          <ModeToggle mode={mode} onChange={setMode} />
          <Button
            variant="secondary"
            icon={<History className="h-4 w-4" aria-hidden />}
            onClick={() => navigate('/documents/analyse?tab=audit')}
          >
            Audit-logg
          </Button>
          {canManage ? (
            <Button
              variant="secondary"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => navigate('/documents/malbibliotek')}
            >
              Ny mal
            </Button>
          ) : null}
          {canManage ? (
            <Button
              variant="primary"
              icon={<FileEdit className="h-4 w-4" aria-hidden />}
              onClick={() => navigate('/documents/malbibliotek')}
            >
              Nytt dokument
            </Button>
          ) : null}
        </>
      }
    >
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ─── CATEGORY RAIL ─── */}
        <aside className="space-y-3">
          <div
            className="rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="border-b border-neutral-100 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Kategorier
              </h2>
            </div>
            <ul className="py-1.5">
              {DOC_KIND_CATEGORIES.map((c) => {
                const isActive = c.id === category
                const count =
                  c.id === 'all'
                    ? tab === 'maler'
                      ? allCounts.maler
                      : allCounts.docs
                    : tab === 'maler'
                      ? perKindCounts[c.id]?.maler ?? 0
                      : perKindCounts[c.id]?.docs ?? 0
                const Icon = c.Icon
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCategory(c.id)}
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
                        {c.label}
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

          {!easy ? (
            <div
              className="rounded-xl border border-neutral-200/80 bg-white p-4"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Compliance-status
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                <li className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-neutral-700">
                    <ShieldCheck className="h-3 w-3 text-[#1a3d32]" aria-hidden />
                    Lovpålagte
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {required.length}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-neutral-700">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Til revisjon
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {dueSoon.length}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-neutral-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Til godkjenning
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {inReview.length}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-neutral-700">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Utgått
                  </span>
                  <span className="font-semibold tabular-nums text-red-700">
                    {expired.length}
                  </span>
                </li>
              </ul>
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Snitt bekreftet
                  </span>
                  <span className="text-base font-bold tabular-nums text-[#1a3d32]">
                    {Math.round(confirmedAvg * 100)}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <DocProgressBar value={confirmedAvg} />
                </div>
              </div>
            </div>
          ) : null}

          {!easy && expired.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-[11px] text-red-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden />
                <div>
                  <div className="font-semibold">
                    {expired.length} dokument{expired.length === 1 ? '' : 'er'} utgått
                  </div>
                  <div className="mt-0.5">
                    Lovpålagte dokumenter må fornyes umiddelbart.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        {/* ─── RIGHT: Tabs + content ─── */}
        <section>
          <div
            className="rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <Tabs
                activeId={tab}
                onChange={(id) => setTab(id as HubTab)}
                items={[
                  {
                    id: 'docs',
                    label: 'Dokumenter',
                    icon: FileText,
                    badgeCount: filteredDocs.length,
                  },
                  {
                    id: 'maler',
                    label: 'Maler',
                    icon: FileStack,
                    badgeCount: allCounts.maler,
                  },
                  {
                    id: 'bekreftelser',
                    label: 'Bekreftelser',
                    icon: BadgeCheck,
                    badgeCount: required.length,
                  },
                ]}
              />
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-44 rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none transition-colors focus:border-[#1a3d32] focus:bg-white sm:w-52"
                    placeholder="Søk i tittel, innhold…"
                  />
                </div>
                {tab === 'docs' ? (
                  <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                    {DOC_VIEW_MODES.map(({ id, label, Icon }) => {
                      const active = id === view
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setView(id)}
                          title={label}
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
                ) : null}
              </div>
            </div>

            {tab === 'docs' ? (
              <DocList
                rows={filteredDocs}
                view={view}
                easy={easy}
                spaces={docs.spaces}
                onOpen={(id) => navigate(`/documents/page/${id}`)}
              />
            ) : tab === 'maler' ? (
              <MalerTable
                customTemplates={docs.orgCustomTemplates}
                systemTemplates={docs.systemTemplatesCatalog}
                category={category}
                easy={easy}
                canManage={canManage}
                onUse={() => navigate('/documents/malbibliotek')}
              />
            ) : (
              <BekreftelserOverview
                rows={required}
                easy={easy}
                onOpen={(id) => navigate(`/documents/page/${id}?tab=bekreftelser`)}
              />
            )}
          </div>
        </section>
      </div>
    </ModulePageShell>
  )
}

// ─── DOCS — view-mode dispatcher ──────────────────────────────────────────────
function DocList({
  rows,
  view,
  easy,
  onOpen,
}: {
  rows: DocRow[]
  view: DocView
  easy: boolean
  spaces: WikiSpace[]
  onOpen: (id: string) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen dokumenter i denne kategorien ennå.
      </div>
    )
  }
  if (view === 'tabell') return <DocTable rows={rows} easy={easy} onOpen={onOpen} />
  if (view === 'bokser') return <DocBoxes rows={rows} easy={easy} onOpen={onOpen} />
  if (view === 'hierarki') return <DocTree rows={rows} onOpen={onOpen} />
  return <DocTimeline rows={rows} easy={easy} onOpen={onOpen} />
}

// ─── DOCS · TABELL ────────────────────────────────────────────────────────────
function DocTable({
  rows,
  easy,
  onOpen,
}: {
  rows: DocRow[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className={MODULE_TABLE_TH}>Dokument</th>
            <th className={MODULE_TABLE_TH}>Status</th>
            <th className={MODULE_TABLE_TH}>Versjon</th>
            {!easy ? <th className={MODULE_TABLE_TH}>Bekreftet</th> : null}
            {!easy ? <th className={MODULE_TABLE_TH}>Lov</th> : null}
            <th className={MODULE_TABLE_TH}>Neste revisjon</th>
            {!easy ? <th className={MODULE_TABLE_TH}>Eier</th> : null}
            <th className={`${MODULE_TABLE_TH} text-right`} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.page.id}
              className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
              onClick={() => onOpen(r.page.id)}
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                    <DocKindIcon kind={r.kind} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-neutral-900">{r.page.title}</span>
                      {r.required ? (
                        <span
                          title="Lovpålagt"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#e7efe9] text-[#1a3d32]"
                        >
                          <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Endret {formatIsoDate(r.editedAt)} av {r.editorName}
                      {r.attachmentsCount > 0 ? (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-neutral-400">
                          <Paperclip className="h-2.5 w-2.5" aria-hidden />
                          {r.attachmentsCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3">
                <DocStatusPill status={r.status} />
              </td>
              <td className="px-5 py-3 tabular-nums text-neutral-700">v{displayVersion(r.page.version)}</td>
              {!easy ? (
                <td className="px-5 py-3">
                  {r.required ? (
                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <DocProgressBar
                          value={r.totalRequired ? r.confirmedCount / r.totalRequired : 0}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-neutral-700">
                        {r.confirmedCount}/{r.totalRequired}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-400">Ikke krevd</span>
                  )}
                </td>
              ) : null}
              {!easy ? (
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.page.legalRefs.length === 0 ? (
                      <span className="text-[10px] text-neutral-400">—</span>
                    ) : (
                      r.page.legalRefs.map((l) => <LovChip key={l}>{l}</LovChip>)
                    )}
                  </div>
                </td>
              ) : null}
              <td className="px-5 py-3 tabular-nums text-neutral-700">
                {r.nextReview ? (
                  formatIsoDate(r.nextReview)
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              {!easy ? (
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2">
                    <Initials name={r.ownerName} size={22} />
                    <span className="text-neutral-700">{r.ownerName}</span>
                  </span>
                </td>
              ) : null}
              <td className="px-5 py-3 text-right text-neutral-300">›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── DOCS · BOKSER ────────────────────────────────────────────────────────────
function DocBoxes({
  rows,
  easy,
  onOpen,
}: {
  rows: DocRow[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <article
          key={r.page.id}
          onClick={() => onOpen(r.page.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen(r.page.id)
            }
          }}
          tabIndex={0}
          role="button"
          className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white p-4 transition-all hover:border-[#1a3d32]/40 hover:shadow-md"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <div className="-mt-2 mb-2 h-1.5 w-12 rounded-b-md bg-[#f1ecdf] ring-1 ring-neutral-200/80" aria-hidden />
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
              <DocKindIcon kind={r.kind} className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  v{displayVersion(r.page.version)}
                </span>
                {r.required ? (
                  <span className="inline-flex items-center gap-0.5 rounded bg-[#e7efe9] px-1 py-0.5 text-[9px] font-bold text-[#14312a]">
                    <ShieldCheck className="h-2 w-2" aria-hidden /> Lovpålagt
                  </span>
                ) : null}
              </div>
              <h3
                className="mt-0.5 line-clamp-2 text-sm font-semibold leading-tight text-neutral-900"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {r.page.title}
              </h3>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <DocStatusPill status={r.status} />
            <span className="text-[11px] tabular-nums text-neutral-500">{formatIsoDate(r.editedAt)}</span>
          </div>

          {r.required && r.totalRequired > 0 ? (
            <div className="mt-3 rounded-md bg-[#fbf9f3] px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Bekreftet
                </span>
                <span className="text-xs font-bold tabular-nums text-neutral-900">
                  {r.confirmedCount}
                  <span className="text-[10px] font-normal text-neutral-500">
                    /{r.totalRequired}
                  </span>
                </span>
              </div>
              <div className="mt-1.5">
                <DocProgressBar
                  value={r.confirmedCount / r.totalRequired}
                  tone={r.confirmedCount / r.totalRequired >= 0.85 ? 'forest' : 'warn'}
                />
              </div>
            </div>
          ) : null}

          {!easy ? (
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-[11px]">
              <div className="flex items-center gap-2 text-neutral-500">
                {r.attachmentsCount > 0 ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Paperclip className="h-3 w-3" aria-hidden />
                    {r.attachmentsCount}
                  </span>
                ) : null}
              </div>
              <span className="inline-flex items-center gap-1.5">
                <Initials name={r.ownerName} size={18} />
                <span className="text-neutral-600">{r.ownerName.split(' ')[0]}</span>
              </span>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}

// ─── DOCS · HIERARKI ──────────────────────────────────────────────────────────
function DocTree({
  rows,
  onOpen,
}: {
  rows: DocRow[]
  onOpen: (id: string) => void
}) {
  // Build groups by kind, listing each row under its parent space.
  const rowsByKind = useMemo(() => {
    const m = new Map<DocKind, DocRow[]>()
    for (const r of rows) {
      const list = m.get(r.kind) ?? []
      list.push(r)
      m.set(r.kind, list)
    }
    return m
  }, [rows])

  const groups = (['hms', 'rutine', 'risiko', 'personal', 'annet'] as DocKind[])
    .map((kind) => ({
      kind,
      label: DOC_KIND_LABEL[kind],
      children: rowsByKind.get(kind) ?? [],
    }))
    .filter((g) => g.children.length > 0)

  const previewRow = rows[0]

  return (
    <div
      className="grid grid-cols-1 gap-0 divide-x-0 divide-y divide-neutral-100 md:grid-cols-[280px_minmax(0,1fr)] md:divide-x md:divide-y-0"
      style={{ minHeight: 420 }}
    >
      <div className="space-y-1 p-4">
        {groups.map((group) => (
          <div key={group.kind} className="select-none">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <ChevronDown className="h-3 w-3" aria-hidden />
              <DocKindIcon kind={group.kind} className="h-3 w-3 text-[#1a3d32]" />
              <span>{group.label}</span>
              <span className="ml-auto rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums">
                {group.children.length}
              </span>
            </div>
            <ul className="ml-3 border-l border-neutral-200 pl-2">
              {group.children.map((c) => (
                <li key={c.page.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(c.page.id)}
                    className="group flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-[#fbf9f3]"
                  >
                    <FileText
                      className="h-3 w-3 text-neutral-400 group-hover:text-[#1a3d32]"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-neutral-900">{c.page.title}</span>
                    {c.required ? (
                      <span title="Lovpålagt" className="inline-flex shrink-0">
                        <ShieldCheck
                          className="h-2.5 w-2.5 text-[#1a3d32]"
                          aria-hidden
                        />
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                      v{displayVersion(c.page.version)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-5">
        {previewRow ? (
          <article className="mx-auto max-w-2xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <DocKindIcon kind={previewRow.kind} className="h-3 w-3 text-[#1a3d32]" />
              <span>{DOC_KIND_LABEL[previewRow.kind]}</span>
              <span>·</span>
              <span>v{displayVersion(previewRow.page.version)}</span>
            </div>
            <h2
              className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              {previewRow.page.title}
            </h2>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-500">
              <DocStatusPill status={previewRow.status} />
              <span>
                Endret {formatIsoDate(previewRow.editedAt)} av {previewRow.editorName}
              </span>
            </div>
            <div className="mt-4 space-y-3 text-[13px] leading-relaxed text-neutral-700">
              <p>
                {previewRow.page.summary?.trim() ||
                  'Klikk en oppføring til venstre for å åpne dokumentet. Bruk hierarkiet til å navigere mellom relaterte dokumenter, eller filtrer via kategoriene.'}
              </p>
              <p>
                Mappe: <strong className="font-medium text-neutral-900">{previewRow.spaceTitle}</strong>. Eier:{' '}
                <strong className="font-medium text-neutral-900">{previewRow.ownerName}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpen(previewRow.page.id)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#143028]"
            >
              Åpne dokument <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </article>
        ) : null}
      </div>
    </div>
  )
}

// ─── DOCS · TIDSLINJE ─────────────────────────────────────────────────────────
function DocTimeline({
  rows,
  easy,
  onOpen,
}: {
  rows: DocRow[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  // Group by yyyy.mm of editedAt
  const groups = useMemo(() => {
    const m = new Map<string, DocRow[]>()
    const sorted = [...rows].sort(
      (a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime(),
    )
    for (const r of sorted) {
      const d = new Date(r.editedAt)
      if (Number.isNaN(d.getTime())) continue
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
      const list = m.get(key) ?? []
      list.push(r)
      m.set(key, list)
    }
    return Array.from(m.entries())
  }, [rows])

  return (
    <div className="p-5">
      <div className="space-y-5">
        {groups.map(([key, list]) => {
          const [mm, yyyy] = key.split('.')
          return (
            <div key={key}>
              <div className="mb-2 flex items-baseline gap-2">
                <h4
                  className="text-sm font-semibold text-neutral-900"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  {MONTH_LABELS[mm]} {yyyy}
                </h4>
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {list.length} endringer
                </span>
              </div>
              <ol className="relative border-l-2 border-neutral-200 pl-5">
                {list.map((r) => {
                  const dt = new Date(r.editedAt)
                  const day = dt.getDate()
                  const dotTone =
                    r.status === 'publisert'
                      ? 'bg-green-600'
                      : r.status === 'utgått'
                        ? 'bg-red-500'
                        : r.status === 'til godkjenning'
                          ? 'bg-amber-500'
                          : 'bg-neutral-400'
                  return (
                    <li key={r.page.id} className="relative mb-2.5 last:mb-0">
                      <span
                        className={[
                          'absolute -left-[28px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white',
                          dotTone,
                        ].join(' ')}
                        aria-hidden
                      >
                        {r.status === 'publisert' ? (
                          <BadgeCheck className="h-2.5 w-2.5 text-white" />
                        ) : r.status === 'utgått' ? (
                          <AlertTriangle className="h-2.5 w-2.5 text-white" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpen(r.page.id)}
                        className="block w-full rounded-md border border-neutral-200/80 bg-white px-3 py-2 text-left hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 shrink-0 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                              {MONTH_LABELS[mm].slice(0, 3)}
                            </div>
                            <div className="text-base font-bold tabular-nums leading-none text-neutral-900">
                              {day}
                            </div>
                          </div>
                          <div className="h-8 w-px bg-neutral-200" />
                          <DocKindIcon kind={r.kind} className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-neutral-900">
                              {r.page.title}{' '}
                              <span className="text-[10px] tabular-nums text-neutral-400">
                                v{displayVersion(r.page.version)}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {r.editorName}
                              {!easy ? ` · ${r.ownerId === r.editorId ? 'eier' : 'redaktør'}` : ''}
                            </div>
                          </div>
                          <DocStatusPill status={r.status} />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">Ingen historikk å vise.</p>
        ) : null}
      </div>
    </div>
  )
}

// ─── MALER TABLE ──────────────────────────────────────────────────────────────
type AnyTemplate =
  | { kind: 'org'; tpl: OrgCustomTemplate }
  | {
      kind: 'system'
      tpl: ReturnType<typeof useDocuments>['systemTemplatesCatalog'][number]
    }

function MalerTable({
  customTemplates,
  systemTemplates,
  category,
  easy,
  canManage,
  onUse,
}: {
  customTemplates: OrgCustomTemplate[]
  systemTemplates: ReturnType<typeof useDocuments>['systemTemplatesCatalog']
  category: 'all' | DocKind
  easy: boolean
  canManage: boolean
  onUse: () => void
}) {
  const all: AnyTemplate[] = useMemo(
    () => [
      ...systemTemplates.map((tpl) => ({ kind: 'system' as const, tpl })),
      ...customTemplates.map((tpl) => ({ kind: 'org' as const, tpl })),
    ],
    [systemTemplates, customTemplates],
  )
  const filtered = useMemo(() => {
    if (category === 'all') return all
    return all.filter((row) => {
      const c = row.tpl.category
      return categoryToKind(c) === category
    })
  }, [all, category])

  if (filtered.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen maler i denne kategorien ennå.
        {canManage ? (
          <div className="mt-3">
            <Button variant="primary" size="sm" onClick={onUse} icon={<Plus className="h-3.5 w-3.5" />}>
              Opprett mal
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className={MODULE_TABLE_TH}>Mal</th>
            <th className={MODULE_TABLE_TH}>Seksjoner</th>
            {!easy ? <th className={MODULE_TABLE_TH}>Lov</th> : null}
            <th className={MODULE_TABLE_TH}>Type</th>
            <th className={MODULE_TABLE_TH}>Oppdatert</th>
            <th className={`${MODULE_TABLE_TH} text-right`} />
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const isSystem = row.kind === 'system'
            const tpl = row.tpl
            const label = tpl.label
            const kind = categoryToKind(tpl.category)
            const lov = Array.isArray(tpl.legalBasis) ? tpl.legalBasis : []
            const sections = Array.isArray(tpl.pagePayload?.blocks)
              ? (tpl.pagePayload.blocks as unknown[]).length
              : 0
            return (
              <tr key={`${row.kind}:${tpl.id}`} className={MODULE_TABLE_TR_BODY}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                      <DocKindIcon kind={kind} className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="font-medium text-neutral-900">{label}</div>
                      <div className="text-[11px] text-neutral-500">{DOC_KIND_LABEL[kind]}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 tabular-nums text-neutral-800">{sections}</td>
                {!easy ? (
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {lov.length === 0 ? (
                        <span className="text-[10px] text-neutral-400">—</span>
                      ) : (
                        lov.map((l: string) => <LovChip key={l}>{l}</LovChip>)
                      )}
                    </div>
                  </td>
                ) : null}
                <td className="px-5 py-3 text-neutral-700">{isSystem ? 'System' : 'Egen mal'}</td>
                <td className="px-5 py-3 tabular-nums text-neutral-700">—</td>
                <td className="px-5 py-3 text-right">
                  {canManage ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<FilePlus2 className="h-3 w-3" aria-hidden />}
                      onClick={onUse}
                    >
                      Bruk mal
                    </Button>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── BEKREFTELSER OVERVIEW (top-level across required docs) ──────────────────
function BekreftelserOverview({
  rows,
  easy,
  onOpen,
}: {
  rows: DocRow[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  const required = rows.filter((r) => r.required && r.totalRequired > 0)
  const totalReq = required.reduce((a, r) => a + r.totalRequired, 0)
  const totalDone = required.reduce((a, r) => a + r.confirmedCount, 0)
  const overall = totalReq ? totalDone / totalReq : 0

  if (required.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen dokumenter krever bekreftelse ennå.
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <div className="rounded-md bg-[#fbf9f3] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Bekreftet totalt
          </div>
          <div
            className="mt-1 text-2xl font-bold tabular-nums text-[#1a3d32]"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {Math.round(overall * 100)}%
          </div>
          <div className="mt-1.5">
            <DocProgressBar value={overall} />
          </div>
        </div>
        <div className="rounded-md bg-[#fbf9f3] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Bekreftelser
          </div>
          <div
            className="mt-1 text-2xl font-bold tabular-nums text-neutral-900"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {totalDone}
          </div>
          <div className="text-[11px] text-neutral-500">av {totalReq} forventet</div>
        </div>
        <div className="rounded-md bg-amber-50 p-3 ring-1 ring-amber-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Gjenstår
          </div>
          <div
            className="mt-1 text-2xl font-bold tabular-nums text-amber-900"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {totalReq - totalDone}
          </div>
          <div className="text-[11px] text-amber-800">ansatte må bekrefte</div>
        </div>
        <div className="rounded-md bg-[#fbf9f3] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Lovpålagte dok.
          </div>
          <div
            className="mt-1 text-2xl font-bold tabular-nums text-[#1a3d32]"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {required.length}
          </div>
          <div className="text-[11px] text-neutral-500">krever bekreftelse</div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-y border-neutral-200">
            <tr>
              <th className={MODULE_TABLE_TH}>Dokument</th>
              <th className={MODULE_TABLE_TH}>Lov</th>
              <th className={MODULE_TABLE_TH}>Versjon</th>
              <th className={MODULE_TABLE_TH}>Bekreftet</th>
              <th className={MODULE_TABLE_TH}>Gjenstår</th>
              {!easy ? <th className={MODULE_TABLE_TH}>Neste revisjon</th> : null}
              <th className={`${MODULE_TABLE_TH} text-right`} />
            </tr>
          </thead>
          <tbody>
            {required.map((r) => {
              const pct = r.totalRequired ? r.confirmedCount / r.totalRequired : 0
              const remaining = r.totalRequired - r.confirmedCount
              return (
                <tr
                  key={r.page.id}
                  className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                  onClick={() => onOpen(r.page.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <DocKindIcon kind={r.kind} className="h-3.5 w-3.5 text-neutral-500" />
                      <span className="font-medium text-neutral-900">{r.page.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.page.legalRefs.length === 0 ? (
                        <span className="text-[10px] text-neutral-400">—</span>
                      ) : (
                        r.page.legalRefs.map((l) => <LovChip key={l}>{l}</LovChip>)
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-neutral-700">
                    v{displayVersion(r.page.version)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <DocProgressBar
                          value={pct}
                          tone={pct >= 0.85 ? 'forest' : pct >= 0.5 ? 'warn' : 'danger'}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-neutral-900">
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    <span
                      className={[
                        'font-semibold',
                        remaining > 30 ? 'text-amber-700' : 'text-neutral-700',
                      ].join(' ')}
                    >
                      {remaining}
                    </span>
                    <span className="text-neutral-400"> ansatte</span>
                  </td>
                  {!easy ? (
                    <td className="px-5 py-3 tabular-nums text-neutral-700">
                      {r.nextReview ? formatIsoDate(r.nextReview) : '—'}
                    </td>
                  ) : null}
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Bell className="h-3 w-3" aria-hidden />}
                      onClick={(e) => {
                        e.stopPropagation()
                        // Reuse the existing acknowledgement reminder flow (no
                        // bespoke endpoint needed — opens the detail tab where
                        // admins trigger the reminder.).
                        onOpen(r.page.id)
                      }}
                    >
                      Påminn
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

