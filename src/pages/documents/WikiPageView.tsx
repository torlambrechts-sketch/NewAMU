import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, History, Pencil } from 'lucide-react'
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
import { WarningBox } from '../../components/ui/AlertBox'
import { Tabs } from '../../components/ui/Tabs'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import type { PageStatus } from '../../types/documents'
import { canViewWikiSpace } from '../../lib/wikiSpaceAccessGrants'

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
  const { isAdmin, can, user, profile, members } = useOrgSetupContext()
  const canManage = isAdmin || can('documents.manage')
  const bypassFolderRbac = canManage
  const { ensurePageLoaded, pageHydrateLoading, pageHydrateError } = docs
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)
  const [activeTab, setActiveTab] = useState<DetailTab>('informasjon')

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
            variant="primary"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => setActiveTab('innhold')}
          >
            Vis dokument
          </Button>
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-neutral-500 hover:text-neutral-800"
              title="Rediger"
              aria-label="Rediger dokument"
              onClick={() => navigate(`/documents/page/${page.id}/reference-edit`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      }
      tabs={<Tabs items={tabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as DetailTab)} />}
    >
      <ModuleLegalBanner
        collapsible
        defaultCollapsed
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
                    isAdmin={isAdmin}
                    pageId={page.id}
                  />
                ),
              },
              {
                id: 'revision',
                label: 'Neste revisjon',
                value:
                  page.nextRevisionDueAt ? (
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
                    </span>
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
    </ModulePageShell>
  )
}
