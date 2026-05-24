/* eslint-disable no-restricted-syntax -- comment composer, filter pills,
   Notion-style ToC items, acknowledge CTA, and inline reply controls are
   intentionally styled native elements. See WikiCommentsRail.tsx and
   WikiPageTree.tsx for the same exception. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  FileDown,
  GitBranch,
  History,
  Info,
  MessageSquare,
  Pencil,
  Quote as QuoteIcon,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useReaderWidth } from '../../hooks/useReaderWidth'
import { useWikiPageComments } from '../../hooks/useWikiPageComments'
import { useWikiPageAvvik } from '../../hooks/useWikiPageAvvik'
import {
  ModulePageShell,
  ModuleSectionCard,
} from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { DocumentAccessRequestForm } from '../../components/documents/DocumentAccessRequestForm'
import { DocumentAccessRequestDialog } from '../../components/documents/DocumentAccessRequestDialog'
import { DocumentAvvikChip } from '../../components/documents/DocumentAvvikPanel'
import { MentionAutocomplete } from '../../components/documents/MentionAutocomplete'
import { useTaskItemsData, type CreateTaskItemInput } from '../../../modules/tasks/useTaskItemsData'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import type { TaskItemPriority } from '../../types/task'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import type {
  AuditLedgerEntry,
  ContentBlock,
  HeadingBlock,
  PageStatus,
  TextBlock,
  WikiCommentAnchor,
  WikiPage,
  WikiPageComment,
  WikiPageVersionSnapshot,
} from '../../types/documents'
import { useTickingClock } from '../../lib/useTickingClock'
import {
  canViewWikiSpace,
  folderAllowsWritePageInSpace,
  wikiSpaceHasRestrictedAccess,
} from '../../lib/wikiSpaceAccessGrants'
import { canBypassWikiFolderGrants, canEditWikiDocuments } from '../../lib/documentsAccess'
import { headingAnchorId } from '../../lib/wikiPageLinks'
import {
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
  formatIsoDateTime,
  type DocsMode,
  type DocStatusKey,
} from '../../components/documents/docsShared'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import {
  injectCommentHighlights,
  type CommentAnchorHighlight,
} from '../../lib/wikiCommentHighlights'

/**
 * Document detail page — Notion-style document viewer with five tabs:
 *   Innhold · Bekreftelser · Kommentarer · Historikk · Innstillinger
 *
 * This page replaces the legacy long-form WikiPageView. Layout mirrors the
 * "Klarert Dokumenter" design handover: status strip, tabbed body, three-
 * column reader (ToC + Notion paper + sidebar) on Innhold/Kommentarer.
 */

type DetailTab = 'innhold' | 'bekreftelser' | 'kommentarer' | 'historikk' | 'innstillinger'

function publishedPageToSnapshot(page: WikiPage): WikiPageVersionSnapshot {
  return {
    id: `current:${page.id}`,
    pageId: page.id,
    version: page.version,
    title: page.title,
    summary: page.summary ?? '',
    status: page.status,
    template: page.template,
    legalRefs: Array.isArray(page.legalRefs) ? page.legalRefs : [],
    lang: page.lang,
    requiresAcknowledgement: page.requiresAcknowledgement,
    acknowledgementAudience: page.acknowledgementAudience ?? 'all_employees',
    acknowledgementDepartmentId: page.acknowledgementDepartmentId ?? null,
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
    nextRevisionDueAt: page.nextRevisionDueAt ?? null,
    revisionIntervalMonths: page.revisionIntervalMonths ?? 12,
    frozenAt: page.updatedAt,
  }
}

function badgeForStatus(s: PageStatus): 'success' | 'draft' | 'neutral' {
  if (s === 'published') return 'success'
  if (s === 'draft') return 'draft'
  return 'neutral'
}

export function WikiPageView() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const docs = useDocuments()
  const {
    can,
    user,
    profile,
    members,
    isAdmin,
    orgProfiles,
  } = useOrgSetupContext()

  const canEditDocs = canEditWikiDocuments(can, profile?.is_org_admin)
  const bypassFolderRbac = canBypassWikiFolderGrants(can, profile?.is_org_admin)

  const {
    ensurePageLoaded,
    pageHydrateLoading,
    pageHydrateError,
    resolvePageMetaForAccessRequest,
    createWikiAccessRequest,
    fetchPageBacklinks,
    auditLedger,
  } = docs

  const { comments, addComment, setResolved, removeComment, logCommentEvent } =
    useWikiPageComments(pageId)
  const { isWide: readerWide, toggle: toggleReaderWide } = useReaderWidth()
  const { linked: linkedAvvik } = useWikiPageAvvik(pageId)
  const openAvvikCount = useMemo(
    () => linkedAvvik.filter((a) => !a.closedAt).length,
    [linkedAvvik],
  )
  void readerWide
  void toggleReaderWide

  const resolveMemberName = useCallback(
    (uid: string | undefined | null) =>
      (uid && orgProfiles.find((p) => p.id === uid)?.display_name) ??
      (uid ? uid.slice(0, 8) : 'Ukjent'),
    [orgProfiles],
  )

  const [mode, setMode] = useState<DocsMode>('advanced')
  const easy = mode === 'easy'

  /** Lightweight feedback banner for non-form actions (archive/delete/etc.). */
  const [actionMsg, setActionMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null,
  )
  useEffect(() => {
    if (!actionMsg) return
    const id = window.setTimeout(() => setActionMsg(null), 6000)
    return () => window.clearTimeout(id)
  }, [actionMsg])

  const [backlinkIds, setBacklinkIds] = useState<string[]>([])
  const [accessReqBusy, setAccessReqBusy] = useState(false)
  const [accessReqErr, setAccessReqErr] = useState<string | null>(null)
  const [accessReqDone, setAccessReqDone] = useState(false)
  const [gateMetaLoading, setGateMetaLoading] = useState(false)
  const [blockedSpaceTitle, setBlockedSpaceTitle] = useState<string | null>(null)
  const [editAccessOpen, setEditAccessOpen] = useState(false)
  const [editAccessBusy, setEditAccessBusy] = useState(false)
  const [editAccessErr, setEditAccessErr] = useState<string | null>(null)
  const [editAccessDone, setEditAccessDone] = useState(false)

  const timeNow = useTickingClock()

  const page = docs.pages.find((p) => p.id === pageId)
  const space = page ? docs.spaces.find((s) => s.id === page.spaceId) : null

  const canViewFolder =
    !page || !space
      ? true
      : canViewWikiSpace({
          spaceId: space.id,
          grants: docs.wikiSpaceAccessGrants,
          bypassRestriction: bypassFolderRbac,
          userId: user?.id,
          profile,
          members,
        })

  useEffect(() => {
    void ensurePageLoaded(pageId)
  }, [ensurePageLoaded, pageId])

  const folderRestricted = page
    ? wikiSpaceHasRestrictedAccess(page.spaceId, docs.wikiSpaceAccessGrants)
    : false

  const showAccessRequestGate = Boolean(page && !canViewFolder && folderRestricted && user?.id)

  const canEditThisDoc =
    Boolean(page) &&
    canEditDocs &&
    (bypassFolderRbac ||
      folderAllowsWritePageInSpace({
        spaceId: page!.spaceId,
        grants: docs.wikiSpaceAccessGrants,
        userId: user?.id,
        profile,
        members,
      }))

  useEffect(() => {
    if (!showAccessRequestGate || !page) {
      setBlockedSpaceTitle(null)
      setGateMetaLoading(false)
      return
    }
    if (space?.title) {
      setBlockedSpaceTitle(space.title)
      setGateMetaLoading(false)
      return
    }
    let cancelled = false
    setGateMetaLoading(true)
    void (async () => {
      const meta = await resolvePageMetaForAccessRequest(page.id)
      if (!cancelled) {
        setBlockedSpaceTitle(
          meta?.spaceId
            ? docs.spaces.find((s) => s.id === meta.spaceId)?.title ?? `Mappe ${meta.spaceId}`
            : null,
        )
        setGateMetaLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    showAccessRequestGate,
    page,
    space?.title,
    resolvePageMetaForAccessRequest,
    docs.spaces,
  ])

  useEffect(() => {
    if (canEditThisDoc) {
      setEditAccessOpen(false)
      setEditAccessBusy(false)
      setEditAccessErr(null)
      setEditAccessDone(false)
    }
  }, [canEditThisDoc])

  useEffect(() => {
    if (!page || page.status !== 'published') {
      setBacklinkIds([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const ids = await fetchPageBacklinks(page.id)
        if (!cancelled) setBacklinkIds(ids)
      } catch {
        if (!cancelled) setBacklinkIds([])
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the page identity or status changes; the inner `page` reference is fresh per run.
  }, [page?.id, page?.status, fetchPageBacklinks])

  const initialTab = ((): DetailTab => {
    const t = searchParams.get('tab')
    if (
      t === 'innhold' ||
      t === 'bekreftelser' ||
      t === 'kommentarer' ||
      t === 'historikk' ||
      t === 'innstillinger'
    ) {
      return t
    }
    return 'innhold'
  })()

  const [tab, setTabState] = useState<DetailTab>(initialTab)
  const setTab = useCallback(
    (id: DetailTab) => {
      setTabState(id)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id === 'innhold') next.delete('tab')
          else next.set('tab', id)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  // Derived: status pill, version, kind, ack stats, totals.
  const kind = useMemo(() => categoryToKind(space?.category ?? null), [space?.category])
  const pendingReview = useMemo(
    () => docs.wikiReviewRequests.some((r) => r.pageId === pageId && r.status === 'pending'),
    [docs.wikiReviewRequests, pageId],
  )
  const docStatus: DocStatusKey = useMemo(() => {
    if (!page) return 'kladd'
    return deriveDocStatus({
      status: page.status,
      archived: Boolean(page.archivedAt),
      pendingReview,
      nextRevisionAtMs: page.nextRevisionDueAt ? new Date(page.nextRevisionDueAt).getTime() : null,
      now: timeNow,
    })
  }, [page, pendingReview, timeNow])

  const due = page?.nextRevisionDueAt ? new Date(page.nextRevisionDueAt) : null
  const daysToDue = due ? Math.ceil((due.getTime() - timeNow) / 86_400_000) : null

  const alreadySigned = page ? docs.hasAcknowledged(page.id, page.version) : false
  const showSignBadge = page
    ? page.requiresAcknowledgement && docs.acknowledgementRequiredForMe(page)
    : false
  const versions = page ? docs.versionsForPage(page.id) : []
  const currentPublishedSnapshot =
    page && page.status === 'published' ? publishedPageToSnapshot(page) : null
  void currentPublishedSnapshot

  // ack counts for this page+version
  const confirmedCount = useMemo(() => {
    if (!page) return 0
    return docs.receipts.filter((r) => r.pageId === page.id && r.pageVersion === page.version)
      .length
  }, [docs.receipts, page])
  const totalRequired = useMemo(() => members.length, [members])
  const confirmedPct = page && totalRequired ? confirmedCount / totalRequired : 0

  // Comments — counts for tab badge.
  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.deletedAt && !c.parentCommentId),
    [comments],
  )
  const totalComments = topLevelComments.length

  // Audit ledger entries for this page (with most-recent first)
  const pageLedger = useMemo<AuditLedgerEntry[]>(() => {
    if (!page) return []
    return [...auditLedger]
      .filter((e) => e.pageId === page.id)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [auditLedger, page])

  // Loading / error gates
  if (!pageId) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Dokument"
        notFound={{ title: 'Mangler dokument-ID', onBack: () => navigate('/documents') }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (pageHydrateError && !page) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Dokument"
      >
        <WarningBox>{pageHydrateError}</WarningBox>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => navigate('/documents')}
        >
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  if (pageHydrateLoading && !page) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Laster dokument…"
        loading
        loadingLabel="Laster dokument…"
      >
        {null}
      </ModulePageShell>
    )
  }

  if (docs.error && !page) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Dokument"
      >
        <WarningBox>{docs.error}</WarningBox>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => navigate('/documents')}
        >
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  if (!page) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Dokument"
        notFound={{
          title: 'Side ikke funnet',
          backLabel: '← Tilbake til bibliotek',
          onBack: () => navigate('/documents'),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!canViewFolder) {
    if (showAccessRequestGate) {
      const folderTitle = space?.title ?? blockedSpaceTitle ?? `Mappe (${page.spaceId})`
      return (
        <ModulePageShell
          breadcrumb={[
            { label: 'HMS' },
            { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
            { label: page.title },
          ]}
          title="Begrenset tilgang"
          description={
            <p className="max-w-3xl text-sm text-neutral-600">
              Du har ikke tilgang til dette dokumentet ennå. Send en formell forespørsel — den behandles av
              dokumentansvarlig.
            </p>
          }
        >
          {gateMetaLoading ? (
            <p className="text-sm text-neutral-500">Henter mappeinformasjon…</p>
          ) : null}
          {accessReqDone ? (
            <InfoBox>Søknaden er sendt. Du får tilgang når en administrator godkjenner den.</InfoBox>
          ) : (
            <DocumentAccessRequestForm
              documentLabel={page.title}
              subLabel={`Mappe: ${folderTitle}`}
              busy={accessReqBusy}
              error={accessReqErr}
              onCancel={() => navigate('/documents')}
              onSubmit={async ({ justification, accessScope, duration }) => {
                if (!user?.id || !profile) return
                setAccessReqErr(null)
                setAccessReqBusy(true)
                try {
                  await createWikiAccessRequest({
                    resourceType: 'document',
                    spaceId: page.spaceId,
                    pageId: page.id,
                    title: page.title,
                    justification,
                    accessScope,
                    duration,
                    requesterName: profile.display_name ?? '',
                  })
                  setAccessReqDone(true)
                } catch (err) {
                  setAccessReqErr(err instanceof Error ? err.message : 'Kunne ikke sende søknad.')
                } finally {
                  setAccessReqBusy(false)
                }
              }}
            />
          )}
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/documents')}
          >
            Tilbake til bibliotek
          </Button>
        </ModulePageShell>
      )
    }
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Ingen tilgang"
        description={
          <p className="max-w-3xl text-sm text-neutral-600">
            Du har ikke tilgang til dokumenter i denne mappen.
          </p>
        }
      >
        <WarningBox>
          Mappen er begrenset til bestemte brukere, avdelinger eller team. Kontakt en administrator
          hvis du mener dette er feil.
        </WarningBox>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => navigate('/documents')}
        >
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  // Sections derived from text/heading blocks for the Notion-style ToC
  const sections = buildSectionsFromBlocks(page.blocks)
  const ownerName = resolveMemberName(page.authorId)

  // Header actions vary by status
  const editorPath = `/documents/page/${page.id}/edit`
  const handleEdit = () => {
    if (canEditThisDoc) navigate(editorPath)
    else if (folderRestricted && user?.id) {
      setEditAccessErr(null)
      setEditAccessDone(false)
      setEditAccessOpen(true)
    }
  }
  const handleAcknowledge = async () => {
    if (!page || !user) return
    try {
      await docs.acknowledge(page.id, profile?.display_name ?? '')
    } catch (err) {
      console.error('Acknowledge failed', err)
    }
  }

  const tabItems: TabItem[] = [
    { id: 'innhold', label: 'Innhold', icon: BookOpen },
    {
      id: 'bekreftelser',
      label: 'Bekreftelser',
      icon: BadgeCheck,
      badgeCount: page.requiresAcknowledgement ? confirmedCount : undefined,
    },
    {
      id: 'kommentarer',
      label: 'Kommentarer',
      icon: MessageSquare,
      badgeCount: totalComments,
    },
    {
      id: 'historikk',
      label: 'Historikk',
      icon: History,
      badgeCount: pageLedger.length,
    },
    { id: 'innstillinger', label: 'Innstillinger', icon: Settings },
  ]

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ...(space ? [{ label: space.title, to: `/documents/space/${space.id}` }] : []),
        { label: page.title },
      ]}
      title={page.title}
      description={
        easy ? (
          <p className="max-w-3xl text-sm text-neutral-600">
            Versjon {displayVersion(page.version)} · {ownerName}
          </p>
        ) : (
          <p className="max-w-3xl text-sm text-neutral-600">
            Versjon {displayVersion(page.version)} · sist endret {formatIsoDate(page.updatedAt)} av{' '}
            {ownerName} · eier {ownerName}
          </p>
        )
      }
      headerActions={
        <>
          <Button
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" aria-hidden />}
            onClick={() => navigate('/documents')}
          >
            Tilbake
          </Button>
          <ModeToggle mode={mode} onChange={setMode} />
          <Badge variant={badgeForStatus(page.status)}>
            {page.status === 'published' ? 'Publisert' : page.status === 'draft' ? 'Utkast' : 'Arkivert'}
          </Badge>
          <DocumentAvvikChip count={openAvvikCount} />
          {showSignBadge && alreadySigned ? <Badge variant="success">Signert</Badge> : null}
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" aria-hidden />}
            onClick={() => window.print()}
          >
            Last ned PDF
          </Button>
          {docStatus === 'kladd' && canEditDocs ? (
            <Button
              variant="secondary"
              icon={<Pencil className="h-4 w-4" aria-hidden />}
              onClick={handleEdit}
            >
              Fortsett å redigere
            </Button>
          ) : null}
          {docStatus === 'kladd' && canEditDocs ? (
            <Button variant="primary" icon={<Send className="h-4 w-4" aria-hidden />}>
              Send til godkjenning
            </Button>
          ) : null}
          {docStatus === 'til godkjenning' && (canEditDocs || isAdmin) ? (
            <Button variant="primary" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
              Godkjenn & publiser
            </Button>
          ) : null}
          {docStatus === 'publisert' && canEditDocs ? (
            <Button
              variant="primary"
              icon={<Pencil className="h-4 w-4" aria-hidden />}
              onClick={handleEdit}
            >
              Rediger
            </Button>
          ) : null}
          {docStatus === 'til revisjon' && canEditDocs ? (
            <Button
              variant="primary"
              icon={<GitBranch className="h-4 w-4" aria-hidden />}
              onClick={handleEdit}
            >
              Start revisjon
            </Button>
          ) : null}
          {docStatus === 'utgått' && canEditDocs ? (
            <Button
              variant="primary"
              icon={<RefreshCw className="h-4 w-4" aria-hidden />}
              onClick={handleEdit}
            >
              Fornye
            </Button>
          ) : null}
        </>
      }
    >
      {actionMsg ? (
        actionMsg.tone === 'success' ? (
          <InfoBox>{actionMsg.text}</InfoBox>
        ) : (
          <WarningBox>{actionMsg.text}</WarningBox>
        )
      ) : null}

      {/* Status strip */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-5 py-3"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <DocStatusPill status={docStatus} />
          <span className="text-xs tabular-nums text-neutral-500">
            v{displayVersion(page.version)}
          </span>
          {page.requiresAcknowledgement ? (
            <span className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Lovpålagt
            </span>
          ) : null}
          {!easy
            ? page.legalRefs.map((l) => (
                <LovChip key={l}>{l}</LovChip>
              ))
            : null}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
          {page.status === 'published' ? (
            <span className="inline-flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
              Publisert <span className="tabular-nums">{formatIsoDate(page.updatedAt)}</span>
            </span>
          ) : null}
          {page.nextRevisionDueAt ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
              Neste revisjon{' '}
              <span
                className={[
                  'tabular-nums',
                  daysToDue != null && daysToDue < 0
                    ? 'font-medium text-red-700'
                    : daysToDue != null && daysToDue <= 60
                      ? 'font-medium text-amber-700'
                      : '',
                ].join(' ')}
              >
                {formatIsoDate(page.nextRevisionDueAt)}
                {daysToDue != null && daysToDue < 0 ? ' (forfalt)' : ''}
              </span>
            </span>
          ) : null}
          {page.requiresAcknowledgement && totalRequired > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
              <span className="tabular-nums">
                {confirmedCount}/{totalRequired}
              </span>{' '}
              bekreftet
            </span>
          ) : null}
        </div>
      </div>

      {/* Tabs card */}
      <div
        className="rounded-xl border border-neutral-200/80 bg-white"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div className="border-b border-neutral-100 px-5 py-2.5">
          <Tabs items={tabItems} activeId={tab} onChange={(id) => setTab(id as DetailTab)} />
        </div>

        <div
          className={[
            tab === 'innhold' || tab === 'kommentarer' ? 'bg-[#F6F4ED] p-5' : 'p-5',
          ].join(' ')}
        >
          {tab === 'innhold' ? (
            <DdInnhold
              page={page}
              sections={sections}
              docKind={kind}
              easy={easy}
              confirmedPct={confirmedPct}
              confirmedCount={confirmedCount}
              totalRequired={totalRequired}
              ownerName={ownerName}
              backlinkIds={backlinkIds}
              backlinkTitleById={(id) => docs.pages.find((p) => p.id === id)?.title ?? id}
              onAcknowledge={handleAcknowledge}
              alreadySigned={alreadySigned}
              showSignBadge={showSignBadge}
            />
          ) : null}

          {tab === 'bekreftelser' ? (
            <DdBekreftelser
              page={page}
              easy={easy}
              receipts={docs.receipts}
              members={members.map((m) => ({
                id: m.id,
                display_name:
                  orgProfiles.find((p) => p.id === m.id)?.display_name ?? m.display_name,
                department_id: m.department_id ?? null,
              }))}
              departments={[]}
              confirmedPct={confirmedPct}
              confirmedCount={confirmedCount}
              totalRequired={totalRequired}
            />
          ) : null}

          {tab === 'kommentarer' ? (
            <DdKommentarer
              page={page}
              sections={sections}
              docKind={kind}
              comments={comments}
              easy={easy}
              canComment={Boolean(user?.id && can('documents.view') && page.status !== 'archived')}
              mentionUsers={orgProfiles.map((p) => ({ id: p.id, displayName: p.display_name }))}
              assignableUsers={orgProfiles.map((p) => ({ id: p.id, display_name: p.display_name }))}
              onAddComment={async (body, anchor) => {
                await addComment({
                  blockIndex: anchor?.blockIndex ?? 0,
                  body,
                  authorName: profile?.display_name ?? '',
                  kind: 'comment',
                  legalBasis: page.legalRefs,
                  anchor: anchor ?? null,
                })
              }}
              onReply={async (parentId, body) => {
                // Inherit blockIndex from the parent comment so reply threads
                // stay attached to the same paragraph the original quote
                // anchors to. Falls back to 0 only when the parent (or its
                // blockIndex) can't be found.
                const parent = comments.find((c) => c.id === parentId)
                await addComment({
                  blockIndex: parent?.blockIndex ?? 0,
                  body,
                  authorName: profile?.display_name ?? '',
                  parentCommentId: parentId,
                  kind: 'comment',
                  legalBasis: page.legalRefs,
                })
              }}
              onResolve={(id, r) => setResolved(id, r)}
              onDelete={(id) => removeComment(id)}
              onSuggestion={async (id, decision) => {
                const c = comments.find((x) => x.id === id)
                if (c) await logCommentEvent({ id: c.id, pageId: c.pageId }, decision)
                await setResolved(id, true)
              }}
              resolveUserName={resolveMemberName}
            />
          ) : null}

          {tab === 'historikk' ? (
            <DdHistorikk
              page={page}
              easy={easy}
              auditEntries={pageLedger}
              versions={versions}
              ownerName={ownerName}
              resolveUserName={resolveMemberName}
            />
          ) : null}

          {tab === 'innstillinger' ? (
            <DdInnstillinger
              page={page}
              ownerName={ownerName}
              easy={easy}
              canManage={canEditDocs || isAdmin}
              onArchive={async () => {
                if (!page) return
                try {
                  await docs.archivePage(page.id)
                  setActionMsg({ tone: 'success', text: 'Dokumentet er arkivert.' })
                } catch (err) {
                  console.error('Archive failed', err)
                  setActionMsg({
                    tone: 'error',
                    text: `Kunne ikke arkivere dokumentet: ${
                      err instanceof Error ? err.message : 'ukjent feil'
                    }`,
                  })
                }
              }}
              onDelete={async () => {
                if (!page) return
                const ok = window.confirm(
                  'Slette dokument? Krever bekreftelse fra eier + HMS-leder. Historikk slettes etter 5 år.',
                )
                if (!ok) return
                try {
                  await docs.deletePage(page.id)
                  navigate('/documents')
                } catch (err) {
                  console.error('Delete failed', err)
                  setActionMsg({
                    tone: 'error',
                    text: `Kunne ikke slette dokumentet: ${
                      err instanceof Error ? err.message : 'ukjent feil'
                    }`,
                  })
                }
              }}
            />
          ) : null}
        </div>
      </div>

      <DocumentAccessRequestDialog
        open={editAccessOpen && Boolean(page && user?.id && profile)}
        title="Be om redigeringstilgang"
        documentLabel={page?.title ?? 'Dokument'}
        subLabel={space?.title ? `Mappe: ${space.title}` : undefined}
        busy={editAccessBusy}
        error={editAccessErr}
        done={editAccessDone}
        onClose={() => {
          if (editAccessBusy) return
          setEditAccessOpen(false)
          setEditAccessErr(null)
          setEditAccessDone(false)
        }}
        onSubmit={async ({ justification, accessScope, duration }) => {
          if (!page || !user?.id || !profile) return
          setEditAccessErr(null)
          setEditAccessBusy(true)
          try {
            await createWikiAccessRequest({
              resourceType: 'document',
              spaceId: page.spaceId,
              pageId: page.id,
              title: page.title,
              justification,
              accessScope,
              duration,
              requesterName: profile.display_name ?? '',
            })
            setEditAccessDone(true)
          } catch (err) {
            setEditAccessErr(err instanceof Error ? err.message : 'Kunne ikke sende søknad.')
          } finally {
            setEditAccessBusy(false)
          }
        }}
      />

      <div data-print-only className="mt-8 hidden border-t border-black pt-4 text-xs text-neutral-600">
        Eksportert fra Klarert · v{displayVersion(page.version)} ·{' '}
        {new Date().toLocaleDateString('no-NO')}
      </div>
    </ModulePageShell>
  )
}

// ============================================================================
// Helper — split blocks into Notion-style "sections" anchored by headings
// ============================================================================
type DocSection = {
  id: string
  n: string
  title: string
  paragraphs: { html: string; blockIndex: number }[]
}

function buildSectionsFromBlocks(blocks: ContentBlock[] | undefined): DocSection[] {
  if (!Array.isArray(blocks)) return []
  const out: DocSection[] = []
  const headingCounts = new Map<string, number>()
  let current: DocSection | null = null
  let counter = 0
  blocks.forEach((b, idx) => {
    if (b && b.kind === 'heading') {
      counter += 1
      const text = String((b as HeadingBlock).text ?? '').trim() || `Seksjon ${counter}`
      const base = text.toLowerCase().replace(/\s+/g, ' ').trim()
      const occ = headingCounts.get(base) ?? 0
      headingCounts.set(base, occ + 1)
      current = {
        id: headingAnchorId(text, occ),
        n: String(counter),
        title: text,
        paragraphs: [],
      }
      out.push(current)
      return
    }
    if (!current) {
      // implicit intro section
      counter = 1
      current = { id: 's-intro', n: '1', title: 'Introduksjon', paragraphs: [] }
      out.push(current)
    }
    if (b && b.kind === 'text') {
      current.paragraphs.push({ html: (b as TextBlock).body ?? '', blockIndex: idx })
    }
  })
  return out
}

// ============================================================================
// INNHOLD tab
// ============================================================================
function DdInnhold({
  page,
  sections,
  docKind,
  easy,
  confirmedPct,
  confirmedCount,
  totalRequired,
  ownerName,
  backlinkIds,
  backlinkTitleById,
  onAcknowledge,
  alreadySigned,
  showSignBadge,
}: {
  page: WikiPage
  sections: DocSection[]
  docKind: ReturnType<typeof categoryToKind>
  easy: boolean
  confirmedPct: number
  confirmedCount: number
  totalRequired: number
  ownerName: string
  backlinkIds: string[]
  backlinkTitleById: (id: string) => string
  onAcknowledge: () => Promise<void>
  alreadySigned: boolean
  showSignBadge: boolean
}) {
  const [activeSection, setActiveSection] = useState<string | null>(sections[0]?.id ?? null)

  // Auto-update active section as user scrolls
  useEffect(() => {
    if (sections.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveSection(visible[0]!.target.id)
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [sections])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
      {/* ToC */}
      <aside className="hidden lg:block">
        <NotionToc
          sections={sections}
          activeSection={activeSection}
          onSelect={(id) => {
            setActiveSection(id)
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </aside>

      {/* Document */}
      <article
        className="mx-auto w-full max-w-[720px] rounded-xl bg-white px-6 py-8 ring-1 ring-neutral-200/70 sm:px-10 sm:py-10 md:px-14 md:py-12"
        style={{
          fontFamily: "'Inter', sans-serif",
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
        }}
      >
        <NotionDocHeader page={page} docKind={docKind} />

        {sections.length === 0 ? (
          <p className="mt-8 text-sm text-neutral-500">Dokumentet har ingen innholdsseksjoner ennå.</p>
        ) : (
          sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-10 first:mt-0">
              <h2 className="text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
                {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-[15.5px] leading-[1.65] text-neutral-700">
                {s.paragraphs.length === 0 ? (
                  <p className="text-neutral-500">—</p>
                ) : (
                  s.paragraphs.map((p, i) => (
                    <div
                      key={i}
                      className="-mx-2 rounded px-2 py-0.5 transition-colors hover:bg-neutral-50"
                      dangerouslySetInnerHTML={{ __html: sanitizeLearningHtml(p.html) }}
                    />
                  ))
                )}
              </div>
            </section>
          ))
        )}

        {/* Acknowledgement prompt */}
        {page.requiresAcknowledgement && showSignBadge ? (
          <div className="mt-10 rounded-lg border border-[#1a3d32]/30 bg-[#f1f6f2] p-4">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1a3d32]" aria-hidden />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Bekreft at du har lest dokumentet
                </h3>
                <p className="mt-0.5 text-[12px] text-neutral-600">
                  Dette er et lovpålagt dokument
                  {page.legalRefs[0] ? ` (${page.legalRefs[0]})` : ''}. Din bekreftelse logges med
                  tidspunkt og versjon.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void onAcknowledge()
                    }}
                    disabled={alreadySigned}
                    className="rounded-md bg-[#1a3d32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#143028] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {alreadySigned ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3 w-3" aria-hidden /> Bekreftet — v
                        {displayVersion(page.version)}
                      </span>
                    ) : (
                      `Jeg bekrefter — v${displayVersion(page.version)}`
                    )}
                  </button>
                  {!alreadySigned ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
                    >
                      Spør meg senere
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </article>

      {/* Right sidebar */}
      <aside className="space-y-3">
        {page.requiresAcknowledgement && totalRequired > 0 ? (
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Bekreftelser</h3>
              <span className="text-base font-bold tabular-nums text-[#1a3d32]">
                {Math.round(confirmedPct * 100)}%
              </span>
            </div>
            <div className="mt-2">
              <DocProgressBar value={confirmedPct} />
            </div>
            <div className="mt-1.5 text-[11px] tabular-nums text-neutral-600">
              {confirmedCount} av {totalRequired} ansatte
            </div>
            {!easy ? (
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                <Bell className="h-3 w-3" aria-hidden /> Send påminnelse til{' '}
                {totalRequired - confirmedCount}
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          className="rounded-xl border border-neutral-200/80 bg-white p-4"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <h3 className="text-sm font-semibold text-neutral-900">Detaljer</h3>
          <dl className="mt-2 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Versjon</dt>
              <dd className="tabular-nums text-neutral-900">v{displayVersion(page.version)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Eier</dt>
              <dd className="text-neutral-900">{ownerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Sist endret</dt>
              <dd className="tabular-nums text-neutral-900">{formatIsoDate(page.updatedAt)}</dd>
            </div>
            {page.status === 'published' ? (
              <div className="flex justify-between">
                <dt className="text-neutral-500">Publisert</dt>
                <dd className="tabular-nums text-neutral-900">{formatIsoDate(page.updatedAt)}</dd>
              </div>
            ) : null}
            {page.nextRevisionDueAt ? (
              <div className="flex justify-between">
                <dt className="text-neutral-500">Neste revisjon</dt>
                <dd className="tabular-nums text-neutral-900">
                  {formatIsoDate(page.nextRevisionDueAt)}
                </dd>
              </div>
            ) : null}
          </dl>
          {!easy && page.legalRefs.length > 0 ? (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Lovverk
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {page.legalRefs.map((l) => (
                  <LovChip key={l}>{l}</LovChip>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {!easy && backlinkIds.length > 0 ? (
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <h3 className="text-sm font-semibold text-neutral-900">Refererte dokumenter</h3>
            <ul className="mt-2 space-y-1.5">
              {backlinkIds.map((id) => (
                <li key={id}>
                  <Link
                    to={`/documents/page/${id}`}
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-neutral-50"
                  >
                    <DocKindIcon kind={docKind} className="h-3 w-3 text-neutral-500" />
                    <span className="min-w-0 flex-1 truncate text-neutral-700">
                      {backlinkTitleById(id)}
                    </span>
                    <ExternalLink className="h-2.5 w-2.5 text-neutral-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

// Notion-style header
function NotionDocHeader({
  page,
  docKind,
}: {
  page: WikiPage
  docKind: ReturnType<typeof categoryToKind>
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-neutral-400">
        {docKind} · v{displayVersion(page.version)}
      </div>
      <h1 className="mt-3 text-4xl font-bold leading-[1.15] tracking-tight text-neutral-900">
        {page.title}
      </h1>
      <p className="mt-3 text-[14px] text-neutral-500">
        Gjeldende fra {page.status === 'published' ? formatIsoDate(page.updatedAt) : 'ikke publisert'} ·
        neste revisjon {page.nextRevisionDueAt ? formatIsoDate(page.nextRevisionDueAt) : 'ikke planlagt'}
      </p>
      <hr className="my-6 border-neutral-100" />
    </div>
  )
}

// Notion-style ToC
function NotionToc({
  sections,
  activeSection,
  onSelect,
}: {
  sections: DocSection[]
  activeSection: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="sticky top-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Innhold</div>
      <ul className="mt-2 space-y-0.5">
        {sections.map((s) => {
          const active = s.id === activeSection
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={[
                  'flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-neutral-200/70 font-semibold text-neutral-900'
                    : 'text-neutral-600 hover:bg-neutral-100',
                ].join(' ')}
              >
                <span className="tabular-nums text-neutral-400">{s.n}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ============================================================================
// BEKREFTELSER tab
// ============================================================================
function DdBekreftelser({
  page,
  easy,
  receipts,
  members,
  departments,
  confirmedPct,
  confirmedCount,
  totalRequired,
}: {
  page: WikiPage
  easy: boolean
  receipts: { pageId: string; pageVersion: number; userId: string; userName: string; acknowledgedAt: string }[]
  members: { id: string; display_name: string; department_id: string | null }[]
  departments: { id: string; name: string }[]
  confirmedPct: number
  confirmedCount: number
  totalRequired: number
}) {
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'not'>('all')

  // Build per-user status against current version
  const ackByUser = useMemo(() => {
    const m = new Map<string, { when: string; version: number }>()
    for (const r of receipts) {
      if (r.pageId === page.id && r.pageVersion === page.version) {
        m.set(r.userId, { when: r.acknowledgedAt, version: r.pageVersion })
      }
    }
    return m
  }, [receipts, page.id, page.version])

  const rows = useMemo(() => {
    return members
      .map((m) => {
        const ack = ackByUser.get(m.id) ?? null
        return {
          id: m.id,
          name: m.display_name,
          deptId: m.department_id,
          confirmed: ack != null,
          when: ack?.when ?? null,
          version: ack?.version ?? null,
        }
      })
      .sort((a, b) => {
        if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [members, ackByUser])

  const confirmed = rows.filter((r) => r.confirmed)
  const notConfirmed = rows.filter((r) => !r.confirmed)
  const list = filter === 'confirmed' ? confirmed : filter === 'not' ? notConfirmed : rows
  const remaining = totalRequired - confirmedCount

  // Department breakdown (server-side departments may be empty here; build
  // straight from member.department_id with a sensible fallback bucket).
  const deptMap = useMemo(() => {
    const map = new Map<string, { label: string; total: number; done: number }>()
    for (const r of rows) {
      const key = r.deptId ?? 'unassigned'
      const label = departments.find((d) => d.id === r.deptId)?.name ?? 'Andre'
      const cur = map.get(key) ?? { label, total: 0, done: 0 }
      cur.total += 1
      if (r.confirmed) cur.done += 1
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [rows, departments])

  // Demo metric (reminders sent) — we don't yet have a reminder log, so this
  // shows 0 in production while the design keeps the slot.
  const remindersSent = 0

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Bekreftelsesrate
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-[#1a3d32]">
              {Math.round(confirmedPct * 100)}%
            </div>
            <div className="mt-1.5">
              <DocProgressBar value={confirmedPct} />
            </div>
          </div>
          <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Bekreftet
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">
              {confirmedCount}
            </div>
            <div className="text-[10px] text-neutral-500">på v{displayVersion(page.version)}</div>
          </div>
          <div className="rounded-md bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Gjenstår
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-amber-900">{remaining}</div>
            <div className="text-[10px] text-amber-800">ansatte</div>
          </div>
          <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Påminnelser
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">
              {remindersSent}
            </div>
            <div className="text-[10px] text-neutral-500">sendt</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: 'all' as const, label: `Alle (${rows.length})` },
              { id: 'confirmed' as const, label: `Bekreftet (${confirmed.length})` },
              { id: 'not' as const, label: `Ikke bekreftet (${notConfirmed.length})` },
            ]).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  filter === f.id
                    ? 'bg-[#1a3d32] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-3 w-3" aria-hidden />}
            onClick={() => {
              // CSV export of current filtered list
              const header = 'Navn;Avdeling;Status;Tidspunkt;Versjon'
              const lines = list.map((r) =>
                [
                  r.name,
                  r.deptId ?? '—',
                  r.confirmed ? 'Bekreftet' : 'Venter',
                  r.when ? formatIsoDateTime(r.when) : '',
                  r.version != null ? `v${displayVersion(r.version)}` : '',
                ].join(';'),
              )
              const csv = `${header}\n${lines.join('\n')}`
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `bekreftelser-${page.id}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Eksporter rapport
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-md border border-neutral-200/80">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-[#fbf9f3]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700">Navn</th>
                {!easy ? (
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Avdeling</th>
                ) : null}
                <th className="px-3 py-2 text-left font-semibold text-neutral-700">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700">Tidspunkt</th>
                {!easy ? (
                  <th className="px-3 py-2 text-left font-semibold text-neutral-700">Versjon</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {list.map((r, i) => (
                <tr key={r.id} className="hover:bg-neutral-50/60">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Initials
                        name={r.name}
                        size={20}
                        tone={(['forest', 'cream', 'sand'] as const)[i % 3]}
                      />
                      <span className="font-medium text-neutral-900">{r.name}</span>
                    </div>
                  </td>
                  {!easy ? (
                    <td className="px-3 py-2 text-neutral-700">
                      {r.deptId
                        ? departments.find((d) => d.id === r.deptId)?.name ?? '—'
                        : '—'}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    {r.confirmed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">
                        <Check className="h-2.5 w-2.5" aria-hidden /> Bekreftet
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        <Clock className="h-2.5 w-2.5" aria-hidden /> Venter
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-700">
                    {r.when ? formatIsoDateTime(r.when) : <span className="text-neutral-400">—</span>}
                  </td>
                  {!easy ? (
                    <td className="px-3 py-2 tabular-nums text-neutral-700">
                      {r.version != null ? (
                        `v${displayVersion(r.version)}`
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
              {list.length === 0 ? (
                <tr>
                  <td
                    colSpan={easy ? 3 : 5}
                    className="px-3 py-6 text-center text-neutral-500"
                  >
                    Ingen treff for valgt filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-3">
        <div
          className="rounded-xl border border-neutral-200/80 bg-white p-4"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <h3 className="text-sm font-semibold text-neutral-900">Per avdeling</h3>
          {deptMap.length === 0 ? (
            <p className="mt-2 text-xs text-neutral-500">Ingen avdelingsdata.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {deptMap.map((d, i) => {
                const p = d.total ? d.done / d.total : 0
                return (
                  <li key={i}>
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="font-medium text-neutral-900">{d.label}</span>
                      <span className="tabular-nums text-neutral-600">
                        {d.done}/{d.total}
                      </span>
                    </div>
                    <div className="mt-1">
                      <DocProgressBar
                        value={p}
                        tone={p >= 0.85 ? 'forest' : p >= 0.5 ? 'warn' : 'danger'}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {!easy ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-2">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">Auto-påminnelse</h4>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Ansatte som ikke bekrefter innen 14 dager fra publisering får automatisk varsel på
                  e-post.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

// ============================================================================
// KOMMENTARER tab
// ============================================================================
function DdKommentarer({
  page,
  sections,
  docKind,
  comments,
  easy,
  canComment,
  mentionUsers,
  assignableUsers,
  onAddComment,
  onReply,
  onResolve,
  onDelete,
  onSuggestion,
  resolveUserName,
}: {
  page: WikiPage
  sections: DocSection[]
  docKind: ReturnType<typeof categoryToKind>
  comments: WikiPageComment[]
  easy: boolean
  canComment: boolean
  mentionUsers: { id: string; displayName: string }[]
  assignableUsers: { id: string; display_name: string }[]
  onAddComment: (body: string, anchor?: WikiCommentAnchor | null) => Promise<void>
  onReply: (parentId: string, body: string) => Promise<void>
  onResolve: (id: string, resolved: boolean) => void
  onDelete: (id: string) => void
  onSuggestion: (id: string, decision: 'accepted' | 'rejected') => Promise<void>
  resolveUserName: (uid: string) => string
}) {
  void onSuggestion // surface for future inline-suggestion UI
  void onDelete
  const taskApi = useTaskItemsData()
  const [activeSection, setActiveSection] = useState<string | null>(sections[0]?.id ?? null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [newBody, setNewBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [busy, setBusy] = useState(false)
  /** Text selected in the document body that anchors the new comment. */
  const [pendingAnchor, setPendingAnchor] = useState<WikiCommentAnchor | null>(null)
  /** Comment whose "Create task" panel is currently open. */
  const [taskForComment, setTaskForComment] = useState<WikiPageComment | null>(null)

  // Top-level comments only, in document order (use blockIndex then createdAt)
  const tops = useMemo(
    () =>
      comments
        .filter((c) => !c.parentCommentId && !c.deletedAt)
        .sort((a, b) => a.blockIndex - b.blockIndex || a.createdAt.localeCompare(b.createdAt)),
    [comments],
  )
  const commentNum = new Map<string, number>()
  tops.forEach((c, i) => commentNum.set(c.id, i + 1))

  const open = tops.filter((c) => !c.resolved)
  const resolved = tops.filter((c) => c.resolved)
  const visible = filter === 'open' ? open : filter === 'resolved' ? resolved : tops

  const repliesByParent = useMemo(() => {
    const m = new Map<string, WikiPageComment[]>()
    for (const c of comments) {
      if (!c.parentCommentId || c.deletedAt) continue
      const list = m.get(c.parentCommentId) ?? []
      list.push(c)
      m.set(c.parentCommentId, list)
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    return m
  }, [comments])

  /** Anchored highlights — numbered to match the comment cards in the rail.
   *  Includes the pending quote (while composing) and any already-saved
   *  anchored comments, so the marker stays on the paragraph after the
   *  comment has been posted. Open threads use amber, resolved use green,
   *  pending (during composition) uses orange — matching the Klarert
   *  Dokumenter design handover. */
  const commentAnchors = useMemo<CommentAnchorHighlight[]>(() => {
    const out: CommentAnchorHighlight[] = []
    tops.forEach((c, i) => {
      const quoted = c.anchor?.quotedText?.trim()
      if (!quoted) return
      out.push({
        commentId: c.id,
        quotedText: quoted,
        index: i + 1,
        // Light tinted background + matching saturated underline + filled
        // circular badge — same triple per resolved/open state.
        color: c.resolved ? '#dcfce7' : '#fef3c7',
        borderColor: c.resolved ? '#16a34a' : '#d97706',
        badgeColor: c.resolved ? '#16a34a' : '#d97706',
        badgeTextColor: '#ffffff',
        badgeFloat: true,
      })
    })
    if (pendingAnchor?.quotedText?.trim()) {
      out.push({
        commentId: 'pending',
        quotedText: pendingAnchor.quotedText,
        index: tops.length + 1,
        color: '#ffedd5',
        borderColor: '#ea580c',
        badgeColor: '#ea580c',
        badgeTextColor: '#ffffff',
        badgeFloat: true,
      })
    }
    return out
  }, [tops, pendingAnchor])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
      <aside className="hidden lg:block">
        <NotionToc
          sections={sections}
          activeSection={activeSection}
          onSelect={(id) => {
            setActiveSection(id)
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </aside>

      <article
        className="mx-auto w-full max-w-[720px] rounded-xl bg-white px-6 py-8 ring-1 ring-neutral-200/70 sm:px-10 sm:py-10 md:px-14 md:py-12"
        style={{
          fontFamily: "'Inter', sans-serif",
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
        }}
        onMouseUp={() => {
          if (!canComment) return
          const sel = window.getSelection()
          const text = sel?.toString().trim() ?? ''
          if (text.length < 4 || text.length > 300) {
            // Selection too short / too long — fall back to block-level comment.
            return
          }
          // Map selection to a block index by walking up to the nearest
          // <section id="..."> ancestor that matches a section id.
          let anchorNode: Node | null = sel?.anchorNode ?? null
          let blockIndex = 0
          while (anchorNode) {
            if (
              anchorNode.nodeType === 1 &&
              (anchorNode as Element).tagName === 'SECTION'
            ) {
              const sid = (anchorNode as Element).id
              const idx = sections.findIndex((sec) => sec.id === sid)
              if (idx >= 0) {
                // Use the first text block under the heading as a stable
                // anchor — sections may contain multiple paragraphs.
                const firstPar = sections[idx].paragraphs[0]
                if (firstPar) blockIndex = firstPar.blockIndex
                break
              }
            }
            anchorNode = anchorNode.parentNode
          }
          setPendingAnchor({ blockIndex, from: 0, to: text.length, quotedText: text })
        }}
      >
        <NotionDocHeader page={page} docKind={docKind} />

        {sections.length === 0 ? (
          <p className="mt-8 text-sm text-neutral-500">Dokumentet har ingen innholdsseksjoner ennå.</p>
        ) : (
          sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-10 first:mt-0">
              <h2 className="text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
                {s.title}
              </h2>
              <div
                className="mt-3 space-y-3 text-[15.5px] leading-[1.65] text-neutral-700"
                onClick={(e) => {
                  const target = e.target as HTMLElement | null
                  const mark = target?.closest('mark[data-comment-id]') as HTMLElement | null
                  if (!mark) return
                  const id = mark.getAttribute('data-comment-id')
                  if (!id || id === 'pending') return
                  setActiveId(id)
                  const card = document.getElementById(`cm-thread-${id}`)
                  card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
              >
                {s.paragraphs.length === 0 ? (
                  <p className="text-neutral-500">—</p>
                ) : (
                  s.paragraphs.map((p, i) => (
                    <div
                      key={i}
                      dangerouslySetInnerHTML={{
                        __html: injectCommentHighlights(
                          sanitizeLearningHtml(p.html),
                          commentAnchors,
                        ),
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          ))
        )}
      </article>

      <aside className="space-y-3">
        {/* Composer */}
        {canComment ? (
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-3"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Ny kommentar
              </h3>
              {pendingAnchor ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-900 hover:bg-amber-200"
                  onClick={() => setPendingAnchor(null)}
                  title="Fjern forankring"
                >
                  <QuoteIcon className="h-2.5 w-2.5" aria-hidden /> Forankret
                  <X className="h-2.5 w-2.5" aria-hidden />
                </button>
              ) : null}
            </div>
            {pendingAnchor ? (
              <blockquote className="mt-2 rounded-md border-l-2 border-amber-400 bg-amber-50/60 px-2 py-1 text-[11px] italic text-neutral-700">
                «{pendingAnchor.quotedText}»
              </blockquote>
            ) : (
              <p className="mt-1 text-[10px] text-neutral-500">
                Marker tekst i dokumentet for å forankre. Skriv «@» for å varsle en kollega.
              </p>
            )}
            <div className="mt-2">
              <MentionAutocomplete
                value={newBody}
                onChange={setNewBody}
                users={mentionUsers}
                rows={2}
                placeholder="Skriv en kommentar…"
                className="!bg-neutral-50 !text-xs !px-2 !py-2"
              />
            </div>
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <Button
                variant="primary"
                size="sm"
                disabled={busy || !newBody.trim()}
                onClick={async () => {
                  if (!newBody.trim()) return
                  setBusy(true)
                  try {
                    await onAddComment(newBody.trim(), pendingAnchor)
                    setNewBody('')
                    setPendingAnchor(null)
                  } catch (err) {
                    console.error('Add comment failed', err)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Kommenter
              </Button>
            </div>
          </div>
        ) : null}

        {/* Filter pills */}
        <div className="flex items-center gap-1">
          {([
            { id: 'open' as const, label: `Åpne (${open.length})` },
            { id: 'resolved' as const, label: `Løst (${resolved.length})` },
            { id: 'all' as const, label: `Alle (${tops.length})` },
          ]).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                'rounded-full px-2 py-1 text-[10px] font-semibold transition-colors',
                filter === f.id
                  ? 'bg-[#1a3d32] text-white'
                  : 'bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Comment cards */}
        <ul className="space-y-2">
          {visible.length === 0 ? (
            <li className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-xs text-neutral-500">
              Ingen kommentarer i denne visningen.
            </li>
          ) : (
            visible.map((c) => {
              const active = activeId === c.id
              const replies = repliesByParent.get(c.id) ?? []
              const num = commentNum.get(c.id) ?? 0
              const authorLabel = c.isAnonymous
                ? 'Anonym'
                : c.authorName || resolveUserName(c.authorId)
              return (
                <li key={c.id} id={`cm-thread-${c.id}`}>
                  <button
                    type="button"
                    onClick={() => setActiveId(active ? null : c.id)}
                    className={[
                      'block w-full rounded-xl border bg-white p-3 text-left transition-all',
                      c.resolved ? 'opacity-75' : '',
                      active
                        ? c.resolved
                          ? 'border-green-400 ring-2 ring-green-200'
                          : 'border-amber-400 ring-2 ring-amber-200'
                        : 'border-neutral-200/80 hover:border-neutral-300',
                    ].join(' ')}
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={[
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                          c.resolved ? 'bg-green-600 text-white' : 'bg-amber-600 text-white',
                        ].join(' ')}
                      >
                        {num}
                      </span>
                      <Initials name={authorLabel} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-xs font-semibold text-neutral-900">
                            {authorLabel}
                          </span>
                          {c.resolved ? (
                            <span className="rounded-full bg-green-100 px-1.5 py-0 text-[9px] font-bold text-green-800">
                              Løst
                            </span>
                          ) : null}
                        </div>
                        {!easy ? (
                          <div className="truncate text-[10px] text-neutral-500">
                            {formatIsoDateTime(c.createdAt)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-2 text-[12px] leading-relaxed text-neutral-800">{c.body}</p>

                    {replies.length > 0 ? (
                      <ul className="mt-2 space-y-1.5 border-l-2 border-neutral-200 pl-2.5">
                        {replies.map((r) => (
                          <li key={r.id} className="flex items-start gap-1.5">
                            <Initials name={r.authorName || resolveUserName(r.authorId)} size={16} tone="cream" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5">
                                <span className="truncate text-[11px] font-semibold text-neutral-900">
                                  {r.isAnonymous ? 'Anonym' : r.authorName || resolveUserName(r.authorId)}
                                </span>
                                <span className="ml-auto shrink-0 text-[9px] tabular-nums text-neutral-400">
                                  {formatIsoDateTime(r.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] leading-snug text-neutral-700">
                                {r.body}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {active && !c.resolved ? (
                      <div
                        className="mt-2 flex items-center gap-1.5 border-t border-neutral-100 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] outline-none focus:border-[#1a3d32] focus:bg-white"
                          placeholder="Svar…"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && replyBody.trim()) {
                              e.preventDefault()
                              const body = replyBody.trim()
                              setReplyBody('')
                              await onReply(c.id, body)
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="rounded-md bg-[#1a3d32] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#143028] disabled:opacity-50"
                          disabled={!replyBody.trim()}
                          onClick={async () => {
                            if (!replyBody.trim()) return
                            const body = replyBody.trim()
                            setReplyBody('')
                            await onReply(c.id, body)
                          }}
                        >
                          Svar
                        </button>
                        <button
                          type="button"
                          title="Lag oppgave fra kommentar"
                          className="rounded p-1 text-neutral-400 hover:bg-[#1a3d32]/10 hover:text-[#1a3d32]"
                          onClick={() => setTaskForComment(c)}
                        >
                          <CheckSquare className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title="Marker som løst"
                          className="rounded p-1 text-neutral-400 hover:bg-green-50 hover:text-green-700"
                          onClick={() => onResolve(c.id, true)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    ) : null}

                    {/* Always-visible quick-task button (works whether the
                        thread is expanded or resolved). */}
                    <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-neutral-100 pt-2">
                      <button
                        type="button"
                        title="Lag oppgave fra kommentar"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTaskForComment(c)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:border-[#1a3d32] hover:bg-[#1a3d32]/5 hover:text-[#1a3d32]"
                      >
                        <CheckSquare className="h-2.5 w-2.5" aria-hidden /> Lag oppgave
                      </button>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      <CreateTaskFromCommentPanel
        open={taskForComment != null}
        comment={taskForComment}
        page={page}
        assignableUsers={assignableUsers}
        onClose={() => setTaskForComment(null)}
        onCreate={async (input) => {
          const id = await taskApi.createItem(input)
          if (id) setTaskForComment(null)
          return id
        }}
      />
    </div>
  )
}

// ----------------------------------------------------------------------------
// CreateTaskFromCommentPanel — slide-out form that prefills a task with the
// comment body and a back-link to the document.
// ----------------------------------------------------------------------------
function CreateTaskFromCommentPanel({
  open,
  comment,
  page,
  assignableUsers,
  onClose,
  onCreate,
}: {
  open: boolean
  comment: WikiPageComment | null
  page: WikiPage
  assignableUsers: { id: string; display_name: string }[]
  onClose: () => void
  onCreate: (input: CreateTaskItemInput) => Promise<string | null>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskItemPriority>('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !comment) return
    const snippet = comment.body.length > 80 ? `${comment.body.slice(0, 78)}…` : comment.body
    setTitle(`Oppfølging: ${snippet}`)
    setDescription(
      [
        `Følger opp kommentar på dokument «${page.title}» (v${displayVersion(page.version)}).`,
        '',
        `> ${comment.body}`,
        '',
        `Forfatter: ${comment.authorName || comment.authorId}`,
      ].join('\n'),
    )
    setPriority('medium')
    setAssigneeId('')
    setDueDate('')
    setErr(null)
  }, [open, comment, page.title, page.version])

  if (!open || !comment) return null

  const assigneeOptions = [
    { value: '', label: 'Ingen valgt' },
    ...assignableUsers.map((u) => ({ value: u.id, label: u.display_name })),
  ]
  const priorityOptions: { value: TaskItemPriority; label: string }[] = [
    { value: 'low', label: 'Lav' },
    { value: 'medium', label: 'Middels' },
    { value: 'high', label: 'Høy' },
    { value: 'critical', label: 'Kritisk' },
  ]
  const assigneeName = assignableUsers.find((u) => u.id === assigneeId)?.display_name

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="create-task-from-comment"
      title="Ny oppgave fra kommentar"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            disabled={busy || !title.trim()}
            onClick={async () => {
              if (!title.trim()) return
              setBusy(true)
              setErr(null)
              try {
                await onCreate({
                  title: title.trim(),
                  description: description.trim() || undefined,
                  priority,
                  assigneeName: assigneeName || undefined,
                  ownerName: assigneeName || undefined,
                  dueDate: dueDate || undefined,
                  sourceType: 'document',
                  sourceId: page.id,
                })
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Kunne ikke opprette oppgave.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Opprett oppgave
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-neutral-500">
          Forankret til «{page.title}» (v{displayVersion(page.version)}).
        </p>
        {err ? <WarningBox>{err}</WarningBox> : null}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="task-title">
            Tittel
          </label>
          <StandardInput
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
            placeholder="Hva må gjøres?"
          />
        </div>
        <div>
          <label
            className="text-[10px] font-bold uppercase tracking-wider text-neutral-500"
            htmlFor="task-desc"
          >
            Beskrivelse
          </label>
          <StandardTextarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Prioritet
            </label>
            <SearchableSelect
              value={priority}
              onChange={(v) => setPriority(v as TaskItemPriority)}
              options={priorityOptions}
              placeholder="Velg prioritet"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Tildelt
            </label>
            <SearchableSelect
              value={assigneeId}
              onChange={setAssigneeId}
              options={assigneeOptions}
              placeholder="Velg ansvarlig"
              className="mt-1.5"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="task-due">
            Frist
          </label>
          <StandardInput
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="rounded-md border border-neutral-200/80 bg-neutral-50/50 p-3 text-xs text-neutral-600">
          <div className="font-semibold text-neutral-800">Kobling</div>
          <p className="mt-1">
            Oppgaven lenkes til dokument «{page.title}» (sourceType=document) slik at den synes i
            historikken og kan filtreres i tasks-modulen.
          </p>
        </div>
      </div>
    </SlidePanel>
  )
}

// ============================================================================
// HISTORIKK tab
// ============================================================================
function DdHistorikk({
  page,
  easy,
  auditEntries,
  versions,
  ownerName,
  resolveUserName,
}: {
  page: WikiPage
  easy: boolean
  auditEntries: AuditLedgerEntry[]
  versions: WikiPageVersionSnapshot[]
  ownerName: string
  resolveUserName: (uid: string) => string
}) {
  const filters = [
    { id: 'all', label: 'Alle', icon: History },
    { id: 'versjoner', label: 'Versjoner', icon: GitBranch },
    { id: 'godkjenninger', label: 'Godkjenninger', icon: CheckCircle2 },
    { id: 'kommentarer', label: 'Kommentarer', icon: MessageSquare },
  ] as const
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return auditEntries
    return auditEntries.filter((a) => {
      if (filter === 'versjoner')
        return ['created', 'updated', 'published', 'archived'].includes(a.action)
      if (filter === 'godkjenninger') return ['approved'].includes(a.action)
      if (filter === 'kommentarer') return false // no comment ledger entries today
      return true
    })
  }, [filter, auditEntries])

  const TONE: Record<string, { bg: string; fg: string }> = {
    success: { bg: 'bg-green-100', fg: 'text-green-700' },
    neutral: { bg: 'bg-neutral-100', fg: 'text-neutral-600' },
    warning: { bg: 'bg-amber-100', fg: 'text-amber-700' },
    danger: { bg: 'bg-red-100', fg: 'text-red-700' },
  }
  const actionTone: Record<AuditLedgerEntry['action'], keyof typeof TONE> = {
    created: 'neutral',
    updated: 'neutral',
    published: 'success',
    archived: 'warning',
    acknowledged: 'success',
    annual_review_completed: 'success',
    submitted_for_review: 'neutral',
    approved: 'success',
    changes_requested: 'warning',
  } as const

  const actionLabel: Record<AuditLedgerEntry['action'], string> = {
    created: 'opprettet',
    updated: 'redigert',
    published: 'publisert',
    archived: 'arkivert',
    acknowledged: 'bekreftet',
    annual_review_completed: 'fullført årsgjennomgang',
    submitted_for_review: 'sendt til godkjenning',
    approved: 'godkjent',
    changes_requested: 'ba om endringer',
  }

  const actionIcon: Record<AuditLedgerEntry['action'], typeof MessageSquare> = {
    created: GitBranch,
    updated: Pencil,
    published: Send,
    archived: History,
    acknowledged: BadgeCheck,
    annual_review_completed: CheckCircle2,
    submitted_for_review: Send,
    approved: CheckCircle2,
    changes_requested: AlertCircle,
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => {
            const FIcon = f.icon
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  filter === f.id
                    ? 'bg-[#1a3d32] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70',
                ].join(' ')}
              >
                <FIcon className="h-3 w-3" aria-hidden />
                {f.label}
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">Ingen historikkoppføringer å vise.</p>
        ) : (
          <ol className="mt-4 relative border-l-2 border-neutral-200 pl-6">
            {filtered.map((a) => {
              const tone = TONE[actionTone[a.action]]
              const ActionIcon = actionIcon[a.action] ?? History
              return (
                <li key={a.id} className="relative mb-4 last:mb-0">
                  <span
                    className={[
                      'absolute -left-[34px] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white',
                      tone.bg,
                      tone.fg,
                    ].join(' ')}
                  >
                    <ActionIcon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div
                    className="rounded-md border border-neutral-200/80 bg-white p-3"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-semibold text-neutral-900">
                          {resolveUserName(a.userId)}
                        </span>
                        <span className="text-neutral-500"> {actionLabel[a.action]}</span>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                        {formatIsoDateTime(a.at)}
                      </span>
                    </div>
                    {!easy && a.snapshot ? (
                      <p className="mt-1 text-[12px] text-neutral-700">{a.snapshot}</p>
                    ) : null}
                    {a.fromVersion != null ? (
                      <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                        v{displayVersion(a.fromVersion)} → v{displayVersion(a.toVersion)}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <aside className="space-y-3">
        <div
          className="rounded-xl border border-neutral-200/80 bg-white p-4"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <h3 className="text-sm font-semibold text-neutral-900">Versjoner</h3>
          <ul className="mt-3 space-y-2">
            <li className="rounded-md border border-[#1a3d32] bg-[#e7efe9]/40 p-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold tabular-nums text-neutral-900">
                  v{displayVersion(page.version)}
                </span>
                <span className="rounded bg-[#1a3d32] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Aktiv
                </span>
              </div>
              <div className="mt-0.5 text-[10px] tabular-nums text-neutral-500">
                {formatIsoDate(page.updatedAt)} · {ownerName}
              </div>
              {!easy ? (
                <div className="mt-1 text-[11px] text-neutral-600">Gjeldende versjon</div>
              ) : null}
            </li>
            {versions.map((v) => (
              <li key={v.id} className="rounded-md border border-neutral-200 p-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold tabular-nums text-neutral-900">
                    v{displayVersion(v.version)}
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-medium text-neutral-500 hover:text-neutral-800"
                  >
                    Sammenlign ›
                  </button>
                </div>
                <div className="mt-0.5 text-[10px] tabular-nums text-neutral-500">
                  {formatIsoDate(v.frozenAt)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {!easy ? (
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <h3 className="text-sm font-semibold text-neutral-900">Audit-eksport</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              For tilsyn fra Arbeidstilsynet. Inneholder hele endringsloggen og bekreftelseslisten.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileDown className="h-3 w-3" aria-hidden />}
              className="mt-2 w-full"
              onClick={() => window.print()}
            >
              Last ned audit-PDF
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

// ============================================================================
// INNSTILLINGER tab
// ============================================================================
function DdInnstillinger({
  page,
  ownerName,
  easy,
  canManage,
  onArchive,
  onDelete,
}: {
  page: WikiPage
  ownerName: string
  easy: boolean
  canManage: boolean
  onArchive: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">Metadata</h3>
        <div className="rounded-md border border-neutral-200/80 p-4">
          <FieldRow label="Tittel" value={page.title} />
          <FieldRow label="Eier" value={ownerName} />
          <FieldRow label="Mal" value={page.template} />
          <FieldRow label="Språk" value={page.lang ?? 'nb'} />
        </div>

        <h3 className="text-sm font-semibold text-neutral-900">Tilgang & bekreftelse</h3>
        <div className="rounded-md border border-neutral-200/80 p-4">
          <ToggleRowDoc
            label="Lovpålagt dokument"
            desc="Krever bekreftelse fra alle relevante ansatte. Endring krever signatur fra eier."
            value={page.requiresAcknowledgement}
          />
          <ToggleRowDoc
            label="Versjons-bekreftelse"
            desc="Ansatte må bekrefte på nytt ved hver større versjon (X.0)."
            value
          />
          <ToggleRowDoc
            label="Auto-påminnelse"
            desc="Send påminnelse til ansatte som ikke har bekreftet innen 14 dager."
            value
          />
          <ToggleRowDoc
            label="Krever verneombud-gjennomgang"
            desc="Publisering hard-blokkeres til en verneombud har kommentert (AML § 6-2)."
            value={Boolean(page.requiresVerneombudReview)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">Lovverk & revisjon</h3>
        <div className="rounded-md border border-neutral-200/80 p-4">
          {!easy && page.legalRefs.length > 0 ? (
            <div className="border-b border-neutral-100 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Lovverk
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {page.legalRefs.map((l) => (
                  <span
                    key={l}
                    className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Revisjonsfrekvens</dt>
              <dd className="text-neutral-900">
                {page.revisionIntervalMonths
                  ? `Hver ${page.revisionIntervalMonths}. måned`
                  : 'Ikke satt'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Lagringstid</dt>
              <dd className="text-neutral-900">
                {page.retainMinimumYears != null
                  ? `${page.retainMinimumYears}+ år`
                  : 'Ikke definert'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Eksport</dt>
              <dd className="text-neutral-900">PDF · API</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Behandlingsgrunnlag</dt>
              <dd className="text-neutral-900">
                {page.piiLegalBasis?.trim() || 'GDPR Art. 6 (1) c'}
              </dd>
            </div>
          </dl>
        </div>

        <h3 className="text-sm font-semibold text-neutral-900">Godkjenningsflyt</h3>
        <div className="rounded-md border border-neutral-200/80 p-4">
          <ol className="space-y-2 text-xs">
            {[
              { who: 'Eier', name: ownerName, role: 'Skriver + publiserer', done: true },
              {
                who: 'Verneombud',
                name: '—',
                role: 'Forhåndsgodkjenner',
                done: false,
              },
              {
                who: 'HMS-leder',
                name: '—',
                role: 'Endelig godkjenner',
                done: false,
              },
            ].map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    s.done ? 'bg-[#1a3d32] text-white' : 'bg-neutral-200 text-neutral-500',
                  ].join(' ')}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-neutral-900">
                      {s.who} · {s.name}
                    </span>
                    {s.done ? (
                      <span className="text-[10px] font-semibold text-green-700">Godkjent</span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-neutral-500">{s.role}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {canManage ? (
          <>
            <h3 className="text-sm font-semibold text-neutral-900">Faresone</h3>
            <div className="rounded-md border border-red-200 bg-red-50/50 p-4">
              <ul className="space-y-2 text-xs">
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-red-900">Arkiver dokument</div>
                    <div className="text-[11px] text-red-700">
                      Dokumentet markeres som utgått. Historikk bevares.
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void onArchive()
                    }}
                  >
                    Arkiver
                  </Button>
                </li>
                <li className="flex flex-wrap items-center justify-between gap-2 border-t border-red-100 pt-2">
                  <div>
                    <div className="font-medium text-red-900">Slett dokument</div>
                    <div className="text-[11px] text-red-700">
                      Krever bekreftelse fra eier + HMS-leder. Historikk slettes etter 5 år.
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!text-red-700"
                    onClick={() => {
                      void onDelete()
                    }}
                  >
                    Slett
                  </Button>
                </li>
              </ul>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-b-0">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-900">{value}</div>
    </div>
  )
}

function ToggleRowDoc({
  label,
  desc,
  value,
}: {
  label: string
  desc: string
  value: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{desc}</div>
      </div>
      <div
        className={[
          'relative mt-1 h-5 w-9 shrink-0 rounded-full',
          value ? 'bg-[#1a3d32]' : 'bg-neutral-300',
        ].join(' ')}
        aria-hidden
      >
        <span
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            value ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </div>
    </div>
  )
}

// Tree-shaking guard for icons referenced only in JSX strings above.
void Info
void X
void ChevronDown
void ModuleSectionCard
