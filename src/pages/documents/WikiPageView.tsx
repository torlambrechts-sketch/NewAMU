import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, History, Pencil, ShieldAlert } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
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
import { Tabs } from '../../components/ui/Tabs'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import type { PageStatus } from '../../types/documents'
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

type DetailTab = 'informasjon' | 'innhold' | 'versjoner'

export function WikiPageView() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { can, user, profile, members } = useOrgSetupContext()
  const canEditDocs = canEditWikiDocuments(can, profile?.is_org_admin)
  const bypassFolderRbac = canBypassWikiFolderGrants(can, profile?.is_org_admin)
  const {
    ensurePageLoaded,
    pageHydrateLoading,
    pageHydrateError,
    resolvePageMetaForAccessRequest,
    createWikiAccessRequest,
  } = docs
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)
  const [activeTab, setActiveTab] = useState<DetailTab>('informasjon')
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

  const tabItems = [
    { id: 'informasjon', label: 'Informasjon' },
    { id: 'innhold', label: 'Innhold' },
    {
      id: 'versjoner',
      label: versionCount > 0 ? `Versjoner (${versionCount})` : 'Versjoner',
    },
  ]

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

  if ((docs.loading || pageHydrateLoading) && !page) {
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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
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
            onClick={() => setActiveTab('innhold')}
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
      tabs={<Tabs items={tabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as DetailTab)} />}
    >
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

      {activeTab === 'informasjon' && (
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
        </ModuleSectionCard>
      )}

      {activeTab === 'innhold' && (
        <ModuleSectionCard>
          <div className={`${TEMPLATE_CLASS[templateKey]} mx-auto`}>
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
            />
          </div>
        </ModuleSectionCard>
      )}

      {activeTab === 'versjoner' && (
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

      {showSignBadge && !alreadySigned ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-[#1a3d32]/30 bg-[#1a3d32] px-4 py-3 text-sm text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            Dette dokumentet krever din bekreftelse
          </span>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 rounded-full border-white bg-white text-[#1a3d32] hover:bg-neutral-100"
            onClick={() => {
              setActiveTab('innhold')
              queueMicrotask(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
              })
            }}
          >
            Gå til signering ↓
          </Button>
        </div>
      ) : null}

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
