import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Eye, History, Maximize2, MessageSquare, Minimize2, Pencil, Printer } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useReaderWidth } from '../../hooks/useReaderWidth'
import { useWikiPageComments } from '../../hooks/useWikiPageComments'
import { WikiTocPanel } from '../../components/documents/WikiTocPanel'
import { WikiMetaPanel } from '../../components/documents/WikiMetaPanel'
import { WikiCommentsRail } from '../../components/documents/WikiCommentsRail'
import { THREAD_COLORS, type CommentAnchorHighlight } from '../../lib/wikiCommentHighlights'
import { RetentionBadge } from './RetentionBadge'
import { WikiBlockRenderer } from './WikiBlockRenderer'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'
import {
  ModuleLegalBanner,
  ModulePageShell,
  ModuleInformationCard,
  ModuleSectionCard,
} from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { DocumentAccessRequestForm } from '../../components/documents/DocumentAccessRequestForm'
import { DocumentAccessRequestDialog } from '../../components/documents/DocumentAccessRequestDialog'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import type { ContentBlock, HeadingBlock, PageStatus, WikiPage, WikiPageVersionSnapshot } from '../../types/documents'
import { headingAnchorId } from '../../lib/wikiPageLinks'
import { useTickingClock } from '../../lib/useTickingClock'
import { DocumentAvvikChip } from '../../components/documents/DocumentAvvikPanel'
import { DocumentAcknowledgementsPanel } from '../../components/documents/DocumentAcknowledgementsPanel'
import { WikiVersionDiff } from '../../components/documents/WikiVersionDiff'
import { useWikiPageAvvik } from '../../hooks/useWikiPageAvvik'
import {
  canViewWikiSpace,
  folderAllowsWritePageInSpace,
  wikiSpaceHasRestrictedAccess,
} from '../../lib/wikiSpaceAccessGrants'
import { canBypassWikiFolderGrants, canEditWikiDocuments } from '../../lib/documentsAccess'

const TEMPLATE_CLASS = {
  standard: 'max-w-3xl',
  wide: 'max-w-5xl',
  policy: 'max-w-2xl',
}

function statusBadgeVariant(status: PageStatus): 'success' | 'draft' | 'neutral' {
  if (status === 'published') return 'success'
  if (status === 'draft') return 'draft'
  return 'neutral'
}

const STATUS_LABEL: Record<PageStatus, string> = {
  published: 'Publisert',
  draft: 'Utkast',
  archived: 'Arkivert',
}

type DetailTab = 'informasjon' | 'innhold' | 'versjoner' | 'visninger'

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

export function WikiPageView() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const docs = useDocuments()
  const { can, user, profile, members, supabase, organization, isAdmin, orgProfiles } =
    useOrgSetupContext()
  const canEditDocs = canEditWikiDocuments(can, profile?.is_org_admin)
  const bypassFolderRbac = canBypassWikiFolderGrants(can, profile?.is_org_admin)
  const {
    ensurePageLoaded,
    pageHydrateLoading,
    pageHydrateError,
    resolvePageMetaForAccessRequest,
    createWikiAccessRequest,
    fetchPageBacklinks,
    fetchOrgPageViewCounts,
    wikiRetentionCategories,
    auditLedger,
  } = docs
  const { comments, addComment, setResolved, removeComment, logCommentEvent } =
    useWikiPageComments(pageId)
  const { isWide: readerWide, toggle: toggleReaderWide } = useReaderWidth()
  const { linked: linkedAvvik } = useWikiPageAvvik(pageId)
  const openAvvikCount = useMemo(() => linkedAvvik.filter((a) => !a.closedAt).length, [linkedAvvik])
  const resolveMemberName = useCallback(
    (uid: string) => orgProfiles.find((p) => p.id === uid)?.display_name ?? uid.slice(0, 8),
    [orgProfiles],
  )
  const [backlinkIds, setBacklinkIds] = useState<string[]>([])
  const [viewRow, setViewRow] = useState<{ uniqueViewers: number; viewsLast30: number } | null>(null)
  const [tocActiveId, setTocActiveId] = useState<string | null>(null)
  const timeNow = useTickingClock()
  const [accessReqBusy, setAccessReqBusy] = useState(false)
  const [accessReqErr, setAccessReqErr] = useState<string | null>(null)
  const [accessReqDone, setAccessReqDone] = useState(false)
  const [gateMetaLoading, setGateMetaLoading] = useState(false)
  const [blockedSpaceTitle, setBlockedSpaceTitle] = useState<string | null>(null)
  const [editAccessOpen, setEditAccessOpen] = useState(false)
  const [editAccessBusy, setEditAccessBusy] = useState(false)
  const [editAccessErr, setEditAccessErr] = useState<string | null>(null)
  const [editAccessDone, setEditAccessDone] = useState(false)
  const [diffVersion, setDiffVersion] = useState<WikiPageVersionSnapshot | null>(null)
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>(() => {
    try { return (localStorage.getItem('wiki-font-size') as 'sm' | 'base' | 'lg') || 'base' } catch { return 'base' }
  })
  /** Which panel fills the viewer's right column — page meta or the comment rail. */
  const [rightPanel, setRightPanel] = useState<'meta' | 'comments'>(() =>
    searchParams.get('comments') === '1' ? 'comments' : 'meta',
  )
  /** Text selected in the document, pending a new anchored comment thread. */
  const [pendingQuote, setPendingQuote] = useState<string | null>(null)

  /** Anchored-comment highlights — numbered to match the thread rail. */
  const commentAnchors = useMemo<CommentAnchorHighlight[]>(() => {
    const tops = comments.filter((c) => !c.deletedAt && !c.parentCommentId)
    const out = tops.flatMap((c, i) =>
      c.anchor?.quotedText
        ? [
            {
              commentId: c.id,
              quotedText: c.anchor.quotedText,
              index: i + 1,
              color: THREAD_COLORS[i % THREAD_COLORS.length],
            },
          ]
        : [],
    )
    // Keep the selected text highlighted while the new comment is being written.
    if (pendingQuote) {
      out.push({
        commentId: 'pending',
        quotedText: pendingQuote,
        index: tops.length + 1,
        color: THREAD_COLORS[tops.length % THREAD_COLORS.length],
      })
    }
    return out
  }, [comments, pendingQuote])

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

  useEffect(() => {
    setDiffVersion(null)
  }, [pageId])

  useEffect(() => {
    try { localStorage.setItem('wiki-font-size', fontSize) } catch { /* quota */ }
  }, [fontSize])

  const folderRestricted =
    page && space
      ? wikiSpaceHasRestrictedAccess(space.id, docs.wikiSpaceAccessGrants)
      : page
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
        setBlockedSpaceTitle(meta?.spaceId ? docs.spaces.find((s) => s.id === meta.spaceId)?.title ?? `Mappe ${meta.spaceId}` : null)
        setGateMetaLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showAccessRequestGate, page, space?.title, space?.id, resolvePageMetaForAccessRequest, docs.spaces])

  useEffect(() => {
    if (canEditThisDoc) {
      setEditAccessOpen(false)
      setEditAccessBusy(false)
      setEditAccessErr(null)
      setEditAccessDone(false)
    }
  }, [canEditThisDoc])

  const legalRefs = useMemo(
    () => (page && Array.isArray(page.legalRefs) ? page.legalRefs : []),
    [page],
  )
  const retentionCategoryRow = useMemo(
    () => (page?.retentionCategory ? wikiRetentionCategories.find((r) => r.slug === page.retentionCategory) ?? null : null),
    [page?.retentionCategory, wikiRetentionCategories],
  )
  const pageLegalBasis = useMemo(() => {
    const set = new Set<string>()
    for (const r of legalRefs) set.add(r)
    if (retentionCategoryRow) for (const r of retentionCategoryRow.legalRefs) set.add(r)
    return [...set]
  }, [legalRefs, retentionCategoryRow])
  const templateKey: keyof typeof TEMPLATE_CLASS =
    page && (page.template === 'wide' || page.template === 'policy' || page.template === 'standard')
      ? page.template
      : 'standard'

  const alreadySigned = page ? docs.hasAcknowledged(page.id, page.version) : false
  const showSignBadge = page ? page.requiresAcknowledgement && docs.acknowledgementRequiredForMe(page) : false
  const versions = page ? docs.versionsForPage(page.id) : []
  const versionCount = versions.length
  const currentPublishedSnapshot =
    page && page.status === 'published' ? publishedPageToSnapshot(page) : null
  const due = page?.nextRevisionDueAt ? new Date(page.nextRevisionDueAt) : null
  const daysToDue = due ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000)) : null
  const revisionSoon = due != null && daysToDue != null && daysToDue <= 60

  const showViewsTab = Boolean(isAdmin || can('documents.manage'))
  const [activeTabExt, setActiveTabExt] = useState<DetailTab>(() => {
    const t = searchParams.get('tab')
    if (t === 'informasjon' || t === 'innhold' || t === 'versjoner' || t === 'visninger') return t
    return 'innhold'
  })

  // Honour ?compare=<version> by jumping to Versjoner with the snapshot
  // selected. Runs once `versions` is loaded for the current page.
  useEffect(() => {
    const compareRaw = searchParams.get('compare')
    if (!compareRaw) return
    const compareVer = Number(compareRaw)
    if (!Number.isFinite(compareVer)) return
    if (!page) return
    const snap = docs.versionsForPage(page.id).find((v) => v.version === compareVer)
    if (snap) {
      setDiffVersion(snap)
      setActiveTabExt('versjoner')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep-link
  }, [page?.id, searchParams])

  const headingToc = useMemo(() => {
    if (!page?.blocks) return [] as { id: string; text: string; level: number }[]
    const counts = new Map<string, number>()
    const out: { id: string; text: string; level: number }[] = []
    for (const b of page.blocks) {
      if (!b || (b as ContentBlock).kind !== 'heading') continue
      const hb = b as HeadingBlock
      const text = typeof hb.text === 'string' ? hb.text : ''
      const base = text.toLowerCase().replace(/\s+/g, ' ').trim()
      const occ = counts.get(base) ?? 0
      counts.set(base, occ + 1)
      const id = headingAnchorId(text, occ)
      const level = hb.level === 1 || hb.level === 2 || hb.level === 3 ? hb.level : 2
      out.push({ id, text, level })
    }
    return out
  }, [page?.blocks])

  useEffect(() => {
    if (!page || page.status !== 'published' || !user?.id || !organization?.id || !supabase) return
    const key = `wiki_view_${page.id}`
    const last = sessionStorage.getItem(key)
    if (last && Date.now() - Number(last) < 3_600_000) return
    sessionStorage.setItem(key, String(Date.now()))
    void supabase
      .from('wiki_page_views')
      .insert({ organization_id: organization.id, page_id: page.id, user_id: user.id })
      .then(() => {})
  }, [page?.id, page?.status, user?.id, organization?.id, supabase])

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
  }, [page?.id, page?.status, fetchPageBacklinks])

  useEffect(() => {
    if (!showViewsTab || !organization?.id) {
      setViewRow(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchOrgPageViewCounts()
        if (cancelled) return
        const row = rows.find((r) => r.pageId === pageId)
        setViewRow(row ? { uniqueViewers: row.uniqueViewers, viewsLast30: row.viewsLast30 } : null)
      } catch {
        if (!cancelled) setViewRow(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showViewsTab, organization?.id, pageId, fetchOrgPageViewCounts])


  useEffect(() => {
    if (headingToc.length < 3 || activeTabExt !== 'innhold') {
      setTocActiveId(null)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setTocActiveId(visible[0]!.target.id)
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 },
    )
    for (const h of headingToc) {
      const el = document.getElementById(h.id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [headingToc, activeTabExt])

  const tabItems = useMemo((): TabItem[] => {
    const base: TabItem[] = [
      { id: 'informasjon', label: 'Informasjon' },
      { id: 'innhold', label: 'Innhold' },
      {
        id: 'versjoner',
        label: versionCount > 0 ? `Versjoner (${versionCount})` : 'Versjoner',
      },
    ]
    if (showViewsTab) {
      base.push({ id: 'visninger', label: 'Visninger' })
    }
    return base
  }, [versionCount, showViewsTab])

  if (!pageId) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
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
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Dokument"
      >
        <WarningBox>{pageHydrateError}</WarningBox>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => navigate('/documents')}>
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  if (pageHydrateLoading && !page) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
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
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Dokument"
      >
        <WarningBox>{docs.error}</WarningBox>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => navigate('/documents')}>
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  if (!page) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
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
    if (showAccessRequestGate && page) {
      const folderTitle =
        space?.title ?? blockedSpaceTitle ?? `Mappe (${page.spaceId})`
      const docLabel = page.title
      return (
        <ModulePageShell
          breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }, { label: page.title }]}
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
              documentLabel={docLabel}
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
          <Button type="button" variant="secondary" className="mt-4" onClick={() => navigate('/documents')}>
            Tilbake til bibliotek
          </Button>
        </ModulePageShell>
      )
    }
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Ingen tilgang"
        description={<p className="max-w-3xl text-sm text-neutral-600">Du har ikke tilgang til dokumenter i denne mappen.</p>}
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

  const descriptionText =
    page.summary?.trim() ||
    `Versjon ${page.version} · sist oppdatert ${new Date(page.updatedAt).toLocaleDateString('no-NO')}.`

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ...(space ? [{ label: space.title, to: `/documents/space/${space.id}` }] : []),
        { label: page.title },
      ]}
      title={page.title}
      description={<p className="max-w-3xl text-sm text-neutral-600">{descriptionText}</p>}
      headerActions={
        <div className="no-print flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
          <Button
            variant="secondary"
            data-print-hide
            className="no-print inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50"
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden />
            Last ned PDF
          </Button>
          <Badge variant={statusBadgeVariant(page.status)}>
            {STATUS_LABEL[page.status]}
          </Badge>
          <DocumentAvvikChip count={openAvvikCount} />
          {showSignBadge && alreadySigned ? (
            <Badge variant="success">
              Signert
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            title="Vis dokument"
            aria-label="Vis dokument"
            onClick={() => setActiveTabExt('innhold')}
            icon={<Eye className="h-4 w-4" aria-hidden />}
          />
          {canEditDocs ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-neutral-500 hover:text-neutral-800"
              title={canEditThisDoc ? 'Rediger' : folderRestricted ? 'Be om redigeringstilgang' : 'Ingen skrivetilgang'}
              aria-label={canEditThisDoc ? 'Rediger dokument' : 'Be om tilgang til redigering'}
              onClick={() => {
                if (canEditThisDoc) {
                  navigate(`/documents/page/${page.id}/reference-edit`)
                  return
                }
                if (folderRestricted && user?.id) {
                  setEditAccessErr(null)
                  setEditAccessDone(false)
                  setEditAccessOpen(true)
                }
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      }
      tabs={<Tabs items={tabItems} activeId={activeTabExt} onChange={(id) => setActiveTabExt(id as DetailTab)} />}
    >
      <div data-print-only className="mb-6 hidden border-b border-black pb-4">
        <h1 className="text-xl font-bold text-black">{page.title}</h1>
        <p className="mt-1 text-sm text-neutral-700">
          {space?.title ?? 'Mappe'} · Versjon {page.version} · Sist oppdatert{' '}
          {new Date(page.updatedAt).toLocaleDateString('no-NO')}
        </p>
      </div>

      <ModuleLegalBanner
        title="Dokumentasjon, medvirkning og varsling"
        intro={
          <>
            Dette dokumentet er en del av internkontrollen. Kommentarer, forslag og avvik skal være sporbare;
            varslinger er konfidensielle og kan ikke endres etter innsending.
          </>
        }
        references={[
          {
            code: 'IK-f § 5 nr. 7',
            text: (
              <>Virksomheten skal systematisk avdekke, dokumentere og lukke avvik fra lover, forskrifter og egne rutiner.</>
            ),
          },
          {
            code: 'AML § 3-1',
            text: <>Medvirkning: alle ansatte har rett til å si fra om risiko, forbedringer og avvik.</>,
          },
          {
            code: 'AML kap. 2A',
            text: (
              <>
                Varsling om kritikkverdige forhold er konfidensielt; arbeidsgiver skal ha en trygg, sporbar kanal og
                forbud mot gjengjeldelse.
              </>
            ),
          },
          {
            code: 'GDPR Art. 6 / 9',
            text: (
              <>
                Behandling av personopplysninger i kommentarer skal ha rettsgrunnlag, lagres ikke lenger enn nødvendig
                og særkategorier behandles bare når loven krever det.
              </>
            ),
          },
        ]}
      />

      {activeTabExt === 'informasjon' && (
        <ModuleSectionCard>
          <ModuleInformationCard
            withCard={false}
            hideHeader
            rows={[
              {
                id: 'summary',
                label: 'Sammendrag',
                value: page.summary?.trim() ? (
                  <p className="text-sm text-neutral-800">{page.summary}</p>
                ) : (
                  <span className="text-sm text-neutral-500">—</span>
                ),
              },
              {
                id: 'updated',
                label: 'Sist oppdatert',
                value: (
                  <span className="text-sm text-neutral-800">
                    {new Date(page.updatedAt).toLocaleDateString('no-NO')} · v{page.version}
                  </span>
                ),
              },
              {
                id: 'retention',
                label: 'Bevaring',
                value: (
                  <RetentionBadge
                    retentionCategory={page.retentionCategory}
                    retainMinimumYears={page.retainMinimumYears}
                    retainMaximumYears={page.retainMaximumYears}
                    archivedAt={page.archivedAt}
                    scheduledDeletionAt={page.scheduledDeletionAt}
                    canEditRetention={canEditDocs}
                    pageId={page.id}
                  />
                ),
              },
              {
                id: 'revision',
                label: 'Neste revisjon',
                value:
                  page.nextRevisionDueAt ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`text-sm font-medium ${
                          daysToDue != null && daysToDue < 0
                            ? 'text-red-800'
                            : daysToDue != null && daysToDue <= 60
                              ? 'text-amber-900'
                              : 'text-neutral-800'
                        }`}
                      >
                        {new Date(page.nextRevisionDueAt).toLocaleDateString('no-NO')}
                        {daysToDue != null && daysToDue < 0 ? ' (forfalt)' : daysToDue != null && daysToDue <= 60 ? ` (${daysToDue} dager)` : ''}
                      </span>
                      {revisionSoon && canEditDocs ? (
                        <Button
                          variant="ghost"
                          onClick={() => navigate(`/documents/page/${page.id}/reference-edit`)}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                        >
                          Start revisjon →
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-500">—</span>
                  ),
              },
              {
                id: 'legal',
                label: 'Hjemler',
                value:
                  legalRefs.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {legalRefs.map((r) => (
                        <span key={r} className="rounded-md bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a3d32]">
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-500">—</span>
                  ),
              },
            ]}
          />
          {page.status === 'published' && revisionSoon ? (
            <div className="border-t border-neutral-100 px-5 pb-5 pt-4 md:px-6">
              <AddTaskLink
                title={`Revider dokument: ${page.title}`}
                description={`Systematisk gjennomgang (IK-f §5). Frist: ${page.nextRevisionDueAt ? new Date(page.nextRevisionDueAt).toLocaleDateString('no-NO') : ''}.`}
                sourceId={page.id}
                sourceLabel={page.title}
              >
                Oppfølgingsoppgave (Kanban)
              </AddTaskLink>
            </div>
          ) : null}
          {backlinkIds.length > 0 ? (
            <div className="border-t border-neutral-100 px-5 pb-5 pt-4 md:px-6">
              <h3 className="text-sm font-semibold text-neutral-900">Referert av</h3>
              <ul className="mt-2 list-inside list-disc text-sm text-neutral-700">
                {backlinkIds.map((id) => {
                  const p = docs.pages.find((x) => x.id === id)
                  return (
                    <li key={id}>
                      <Link to={`/documents/page/${id}`} className="text-[#1a3d32] underline">
                        {p?.title ?? id}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </ModuleSectionCard>
      )}

      {activeTabExt === 'informasjon' && page.requiresAcknowledgement ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Lest og forstått</h2>
          <p className="mt-1.5 text-sm text-neutral-600">
            Hvem i målgruppen har signert «Lest og forstått» for nåværende versjon.
          </p>
          <div className="mt-5">
            <DocumentAcknowledgementsPanel page={page} receipts={docs.receipts} />
          </div>
        </ModuleSectionCard>
      ) : null}

      {activeTabExt === 'innhold' && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: readerWide
              ? '260px minmax(0,1fr)'
              : '260px minmax(0,1fr) 360px',
          }}
        >
          <div className="hidden lg:block">
            <WikiTocPanel toc={headingToc} activeId={tocActiveId} />
          </div>
          <ModuleSectionCard clip="visible" className="overflow-visible">
          {/* ── Reading toolbar ── */}
          <div
            data-print-hide
            className="no-print sticky top-0 z-20 flex items-center gap-1 rounded-t-xl border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur-sm"
          >
            {/* Font size controls */}
            <span className="hidden select-none text-[10px] font-semibold uppercase tracking-widest text-neutral-400 sm:inline">
              Størrelse
            </span>
            <div className="contents" role="radiogroup" aria-label="Tekststørrelse">
              {(['sm', 'base', 'lg'] as const).map((s, i) => (
                <Button
                  key={s}
                  variant="ghost"
                  size="icon"
                  onClick={() => setFontSize(s)}
                  title={s === 'sm' ? 'Liten tekst' : s === 'base' ? 'Normal tekst' : 'Stor tekst'}
                  role="radio"
                  aria-checked={fontSize === s}
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${
                    fontSize === s
                      ? 'bg-[#1a3d32]/10 font-semibold text-[#1a3d32]'
                      : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700'
                  }`}
                >
                  <span aria-hidden style={{ fontSize: ['11px', '13px', '15px'][i], lineHeight: 1 }}>
                    A
                  </span>
                </Button>
              ))}
            </div>

            <div className="mx-1.5 h-4 w-px shrink-0 bg-neutral-200" aria-hidden />

            {/* Width toggle — Full bredde expands the prose over the side panel,
                Lesemodus restores the constrained reading width + side panel. */}
            <Button
              variant="ghost"
              onClick={toggleReaderWide}
              title={readerWide ? 'Lesemodus — smal bredde med sidepanel' : 'Full bredde — utvid over sidepanelet'}
              aria-pressed={readerWide}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                readerWide ? 'bg-[#0f766e]/10 text-[#0f766e]' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              {readerWide ? (
                <Minimize2 className="size-3.5" aria-hidden />
              ) : (
                <Maximize2 className="size-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">{readerWide ? 'Lesemodus' : 'Full bredde'}</span>
            </Button>

            <div className="flex-1" />

            {/* Comments — toggles the right column to the inline thread rail */}
            <Button
              variant="ghost"
              onClick={() => setRightPanel((p) => (p === 'comments' ? 'meta' : 'comments'))}
              title={rightPanel === 'comments' ? 'Skjul kommentarer' : 'Vis kommentarer'}
              aria-pressed={rightPanel === 'comments'}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                rightPanel === 'comments' ? 'bg-[#0f766e]/10 text-[#0f766e]' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">
                Kommentarer
                {comments.filter((c) => !c.resolved && !c.deletedAt && !c.parentCommentId).length > 0
                  ? ` (${comments.filter((c) => !c.resolved && !c.deletedAt && !c.parentCommentId).length})`
                  : ''}
              </span>
            </Button>

            <div className="mx-1 h-4 w-px shrink-0 bg-neutral-200" aria-hidden />

            {/* Print */}
            <Button
              variant="ghost"
              onClick={() => window.print()}
              title="Skriv ut / Last ned PDF"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-normal text-neutral-500 hover:bg-neutral-100"
            >
              <Printer className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Skriv ut</span>
            </Button>

            {/* Edit */}
            {canEditDocs && (
              <Button
                variant="ghost"
                title={canEditThisDoc ? 'Rediger dokument' : folderRestricted ? 'Be om redigeringstilgang' : 'Ingen skrivetilgang'}
                onClick={() => {
                  if (canEditThisDoc) {
                    navigate(`/documents/page/${page.id}/reference-edit`)
                  } else if (folderRestricted && user?.id) {
                    setEditAccessErr(null)
                    setEditAccessDone(false)
                    setEditAccessOpen(true)
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-normal text-neutral-500 hover:bg-neutral-100"
              >
                <Pencil className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Rediger</span>
              </Button>
            )}
          </div>

          {/* ── Reader prose ── */}
          <div className="min-w-0 px-6 py-8 md:px-10">
              {page.containsPii ? (
                <div
                  className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
                  role="status"
                >
                  <p className="font-semibold text-sky-950">Dette dokumentet inneholder personopplysninger.</p>
                  {page.piiLegalBasis?.trim() ? (
                    <p className="mt-1 text-sm text-sky-900">
                      <span className="font-medium">Behandlingsgrunnlag:</span> {page.piiLegalBasis}
                    </p>
                  ) : null}
                  {page.piiRetentionNote?.trim() ? (
                    <p className="mt-1 text-sm text-sky-900">
                      <span className="font-medium">Lagringstid:</span> {page.piiRetentionNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div
                className={readerWide ? '' : `mx-auto ${TEMPLATE_CLASS[templateKey]}`}
                onMouseUp={
                  rightPanel === 'comments'
                    ? () => {
                        const text = window.getSelection()?.toString().trim() ?? ''
                        if (text.length >= 4 && text.length <= 300) setPendingQuote(text)
                      }
                    : undefined
                }
              >
                <WikiBlockRenderer
                  blocks={Array.isArray(page.blocks) ? page.blocks : []}
                  pageId={page.id}
                  pageVersion={page.version}
                  lang={page.lang ?? 'nb'}
                  fontSize={fontSize}
                  commentAnchors={rightPanel === 'comments' ? commentAnchors : undefined}
                  onAnchorClick={(id) => {
                    setRightPanel('comments')
                    queueMicrotask(() =>
                      document
                        .getElementById(`cm-thread-${id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                    )
                  }}
                />
              </div>
            </div>
          </ModuleSectionCard>
          {!readerWide ? (
            <div className="hidden lg:block">
              {rightPanel === 'comments' ? (
                <WikiCommentsRail
                  comments={comments}
                  canComment={Boolean(user?.id && can('documents.view') && page.status !== 'archived')}
                  pendingQuote={pendingQuote}
                  onClearQuote={() => setPendingQuote(null)}
                  onAddComment={async (body) => {
                    await addComment({
                      blockIndex: 0,
                      body,
                      authorName: profile?.display_name ?? '',
                      kind: 'comment',
                      legalBasis: pageLegalBasis,
                      anchor: pendingQuote
                        ? { blockIndex: 0, from: 0, to: 0, quotedText: pendingQuote }
                        : null,
                    })
                    setPendingQuote(null)
                  }}
                  onReply={async (parentId, blockIndex, body) => {
                    await addComment({
                      blockIndex,
                      body,
                      authorName: profile?.display_name ?? '',
                      parentCommentId: parentId,
                      kind: 'comment',
                      legalBasis: pageLegalBasis,
                    })
                  }}
                  onResolve={(id, r) => setResolved(id, r)}
                  onDelete={(id) => removeComment(id)}
                  onSuggestion={async (id, decision) => {
                    const c = comments.find((x) => x.id === id)
                    if (c) await logCommentEvent({ id: c.id, pageId: c.pageId }, decision)
                    await setResolved(id, true)
                  }}
                />
              ) : (
              <WikiMetaPanel
                page={page}
                space={space}
                ownerName={resolveMemberName(page.authorId)}
                auditLedger={auditLedger}
                resolveUserName={resolveMemberName}
                backlinkIds={backlinkIds}
                pageTitleById={(id) => docs.pages.find((p) => p.id === id)?.title ?? id}
              />
              )}
            </div>
          ) : null}
        </div>
      )}

      {activeTabExt === 'visninger' && showViewsTab ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Visninger (aggregert)</h2>
          <p className="mt-1.5 text-sm text-neutral-600">
            Unike brukere og visninger siste 30 dager (kun for administratorer og dokumentansvarlige).
          </p>
          {viewRow ? (
            <ul className="mt-5 space-y-3">
              <li className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                <span className="text-sm text-neutral-800">Unike brukere (totalt i DB for denne siden)</span>
                <span className="text-base font-semibold text-neutral-900">{viewRow.uniqueViewers}</span>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                <span className="text-sm text-neutral-800">Visninger siste 30 dager</span>
                <span className="text-base font-semibold text-neutral-900">{viewRow.viewsLast30}</span>
              </li>
            </ul>
          ) : (
            <p className="mt-5 text-sm text-neutral-500">Ingen visningsdata ennå.</p>
          )}
        </ModuleSectionCard>
      ) : null}

      {activeTabExt === 'versjoner' && (
        <ModuleSectionCard className="p-5 md:p-6">
          {versions.length === 0 ? (
            <>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                <History className="size-5 text-[#1a3d32]" aria-hidden />
                Publiserte versjoner (arkiv)
              </h2>
              <p className="mt-1.5 text-sm text-neutral-600">
                Ingen arkiverte publiserte versjoner ennå. Første publisering oppretter v1 i arkivet.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <History className="size-5 text-[#1a3d32]" aria-hidden />
                <h2 className="text-lg font-semibold text-neutral-900">Publiserte versjoner (arkiv)</h2>
              </div>
              <p className="mt-1.5 text-sm text-neutral-600">
                Hver publisering fryser forrige versjon for revisjon og tilsyn.
              </p>
              <ul className="mt-5 space-y-3">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-neutral-900">
                        v{v.version} — {v.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {new Date(v.frozenAt).toLocaleString('no-NO')}
                      </span>
                    </div>
                    {currentPublishedSnapshot && v.version < currentPublishedSnapshot.version ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setDiffVersion(v)}
                      >
                        Sammenlign
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {diffVersion && currentPublishedSnapshot ? (
                <div className="mt-6 border-t border-neutral-100 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-neutral-900">Endringer</h3>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setDiffVersion(null)}>
                      Lukk
                    </Button>
                  </div>
                  <WikiVersionDiff versionA={diffVersion} versionB={currentPublishedSnapshot} />
                </div>
              ) : null}
            </>
          )}
        </ModuleSectionCard>
      )}

      <div data-print-only className="mt-8 hidden border-t border-black pt-4 text-xs text-neutral-600">
        Eksportert fra Klarert · v{page.version} · {new Date().toLocaleDateString('no-NO')}
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
    </ModulePageShell>
  )
}
