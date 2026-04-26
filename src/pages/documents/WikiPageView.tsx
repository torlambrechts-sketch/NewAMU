import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Eye, History, Pencil, Printer } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useWikiPageComments, fetchWikiMentionRecipientsFromHtml } from '../../hooks/useWikiPageComments'
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
import type { ContentBlock, HeadingBlock, PageStatus } from '../../types/documents'
import { headingAnchorId } from '../../lib/wikiPageLinks'
import { WikiBlockCommentsPanel } from '../../components/documents/WikiBlockCommentsPanel'
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

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
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

export function WikiPageView() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { can, user, profile, members, supabase, organization, isAdmin } = useOrgSetupContext()
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
    notifyWikiMentions,
  } = docs
  const { comments, addComment, setResolved, removeComment } = useWikiPageComments(pageId)
  const [backlinkIds, setBacklinkIds] = useState<string[]>([])
  const [viewRow, setViewRow] = useState<{ uniqueViewers: number; viewsLast30: number } | null>(null)
  const [ackFooterVisible, setAckFooterVisible] = useState(false)
  const [tocActiveId, setTocActiveId] = useState<string | null>(null)
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)
  const [accessReqBusy, setAccessReqBusy] = useState(false)
  const [accessReqErr, setAccessReqErr] = useState<string | null>(null)
  const [accessReqDone, setAccessReqDone] = useState(false)
  const [gateMetaLoading, setGateMetaLoading] = useState(false)
  const [blockedSpaceTitle, setBlockedSpaceTitle] = useState<string | null>(null)
  const [editAccessOpen, setEditAccessOpen] = useState(false)
  const [editAccessBusy, setEditAccessBusy] = useState(false)
  const [editAccessErr, setEditAccessErr] = useState<string | null>(null)
  const [editAccessDone, setEditAccessDone] = useState(false)

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

  const legalRefs = page && Array.isArray(page.legalRefs) ? page.legalRefs : []
  const templateKey: keyof typeof TEMPLATE_CLASS =
    page && (page.template === 'wide' || page.template === 'policy' || page.template === 'standard')
      ? page.template
      : 'standard'

  const alreadySigned = page ? docs.hasAcknowledged(page.id, page.version) : false
  const showSignBadge = page ? page.requiresAcknowledgement && docs.acknowledgementRequiredForMe(page) : false
  const versions = page ? docs.versionsForPage(page.id) : []
  const versionCount = versions.length
  const due = page?.nextRevisionDueAt ? new Date(page.nextRevisionDueAt) : null
  const daysToDue = due ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000)) : null
  const revisionSoon = due != null && daysToDue != null && daysToDue <= 60

  const showViewsTab = Boolean(isAdmin || can('documents.manage'))
  const [activeTabExt, setActiveTabExt] = useState<DetailTab>('informasjon')

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
    const needsAckSticky =
      Boolean(page?.requiresAcknowledgement && page.status === 'published' && showSignBadge && !alreadySigned)
    if (!needsAckSticky) {
      setAckFooterVisible(false)
      return
    }
    const el = document.getElementById('wiki-ack-footer')
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => setAckFooterVisible(Boolean(e?.isIntersecting)),
      { threshold: 0.35 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [page?.id, page?.requiresAcknowledgement, page?.status, showSignBadge, alreadySigned, activeTabExt])

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
          <button
            type="button"
            data-print-hide
            className="no-print inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50"
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden />
            Last ned PDF
          </button>
          <Badge variant={statusBadgeVariant(page.status)}>
            {STATUS_LABEL[page.status]}
          </Badge>
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
        title="Dokumentasjon og internkontroll"
        references={[
          {
            code: 'IK-forskriften § 5',
            text: (
              <>
                Virksomheten skal systematisk sikre at lover og forskrifter blir fulgt — dokumentert, tilgjengelig og
                revidert etter behov.
              </>
            ),
          },
          {
            code: 'AML § 3-1',
            text: <>Arbeidsmiljøloven krever skriftlig dokumentasjon av risikovurdering og tiltak der det er relevant.</>,
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
                        <button
                          type="button"
                          onClick={() => navigate(`/documents/page/${page.id}/reference-edit`)}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                        >
                          Start revisjon →
                        </button>
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
                module="hse"
                sourceType="manual"
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

      {activeTabExt === 'innhold' && (
        <ModuleSectionCard>
          <div
            data-print-hide
            className={`flex flex-col gap-6 lg:flex-row lg:items-start ${TEMPLATE_CLASS[templateKey]} mx-auto w-full`}
          >
            {headingToc.length >= 3 ? (
              <aside className="hidden w-52 shrink-0 md:sticky md:top-24 md:block">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Innhold</p>
                <nav>
                  <ul className="space-y-1">
                    {headingToc.map((h) => (
                      <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 10}px` }}>
                        <a
                          href={`#${h.id}`}
                          className={`block truncate text-xs leading-5 ${
                            tocActiveId === h.id ? 'font-semibold text-[#1a3d32]' : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                          onClick={(e) => {
                            e.preventDefault()
                            document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })
                          }}
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            ) : null}
            <div className="min-w-0 flex-1">
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
            <WikiBlockRenderer
              blocks={Array.isArray(page.blocks) ? page.blocks : []}
              pageId={page.id}
              pageVersion={page.version}
              lang={page.lang ?? 'nb'}
              blockFooter={(idx) =>
                page.status === 'published' ? (
                  <WikiBlockCommentsPanel
                    blockIndex={idx}
                    comments={comments}
                    currentUserId={user?.id}
                    canView={can('documents.view')}
                    canComment={Boolean(user?.id && can('documents.view'))}
                    onAdd={async (bi, body) => {
                      await addComment({ blockIndex: bi, body, authorName: profile?.display_name ?? '' })
                      const recipients = await fetchWikiMentionRecipientsFromHtml(supabase, `<p>${body}</p>`)
                      if (recipients.length > 0) {
                        const chips = recipients
                          .map((r) => `<span data-mention="true" data-user-id="${r.id}">@${r.label}</span>`)
                          .join(' ')
                        await notifyWikiMentions({
                          html: `<p>Kommentar på «${page.title}»: ${chips}</p>`,
                          pageId: page.id,
                          context: 'comment',
                          actorName: profile?.display_name ?? '',
                        })
                      }
                    }}
                    onResolve={(id, r) => setResolved(id, r)}
                    onDelete={(id) => removeComment(id)}
                  />
                ) : null
              }
            />
            </div>
          </div>
        </ModuleSectionCard>
      )}

      {activeTabExt === 'visninger' && showViewsTab ? (
        <ModuleSectionCard>
          <h2 className="text-sm font-semibold text-neutral-900">Visninger (aggregert)</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Unike brukere og visninger siste 30 dager (kun for administratorer og dokumentansvarlige).
          </p>
          {viewRow ? (
            <ul className="mt-4 space-y-2 text-sm text-neutral-800">
              <li>Unike brukere (totalt i DB for denne siden): {viewRow.uniqueViewers}</li>
              <li>Visninger siste 30 dager: {viewRow.viewsLast30}</li>
            </ul>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">Ingen visningsdata ennå.</p>
          )}
        </ModuleSectionCard>
      ) : null}

      {activeTabExt === 'versjoner' && (
        <ModuleSectionCard>
          {versions.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen arkiverte publiserte versjoner ennå.</p>
          ) : (
            <>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <History className="size-4 text-[#1a3d32]" aria-hidden />
                Publiserte versjoner (arkiv)
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Hver publisering fryser forrige versjon for revisjon og tilsyn.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0"
                  >
                    <span className="font-medium text-neutral-800">
                      v{v.version} — {v.title}
                    </span>
                    <span className="text-xs text-neutral-500">{new Date(v.frozenAt).toLocaleString('no-NO')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ModuleSectionCard>
      )}

      {showSignBadge && !alreadySigned && !ackFooterVisible ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-3 border-t border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium">Dette dokumentet krever din bekreftelse — scroll ned for å signere</span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="shrink-0 bg-amber-600 hover:bg-amber-700"
            onClick={() => {
              setActiveTabExt('innhold')
              queueMicrotask(() => {
                document.getElementById('wiki-ack-footer')?.scrollIntoView({ behavior: 'smooth' })
              })
            }}
          >
            Scroll ned ↓
          </Button>
        </div>
      ) : null}

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
