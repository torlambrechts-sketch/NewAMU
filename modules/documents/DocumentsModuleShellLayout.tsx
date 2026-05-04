import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { FolderPlus, Plus } from 'lucide-react'
import { ModuleLegalBanner, ModulePageShell } from '../../src/components/module'
import { Button } from '../../src/components/ui/Button'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { canEditWikiDocuments } from '../../src/lib/documentsAccess'
import { DOCUMENTS_MODULE_DESC, DOCUMENTS_MODULE_TITLE } from '../../src/data/documentsNav'
import { documentsModuleShellStyle } from '../../src/lib/documentsModuleShellStyle'
import { DocumentsHubActionsProvider, useDocumentsHubActions } from './DocumentsHubActionsContext'
import { DocumentsShellEmbeddedProvider } from './DocumentsShellContext'
import { DocumentsHubSecondaryNav } from '../../src/components/documents/DocumentsHubSecondaryNav'
import { DocumentsSearchHotkey } from '../../src/components/documents/DocumentsSearchHotkey'
import { apiFetchAnnualReview } from '../../src/api/wikiAnnualReview'
import { DOCUMENTS_MODULE_LEGAL_REFERENCES } from './documentsLegalReferences'
import { ModuleLegalFrameworkProvider } from '../../src/components/module/ModuleLegalFrameworkContext'

function DocumentsShellHeaderActions({
  canEditDocs,
  onDocumentsHub,
  onMalbibliotek,
}: {
  canEditDocs: boolean
  onDocumentsHub: boolean
  onMalbibliotek: boolean
}) {
  const { requestOpenNewFolder, requestNewDocument, requestNewTemplate } = useDocumentsHubActions()

  if (!canEditDocs) return null

  if (onDocumentsHub) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
        <Button variant="secondary" type="button" icon={<FolderPlus className="h-4 w-4" />} onClick={() => requestOpenNewFolder()}>
          Ny mappe
        </Button>
        <Button variant="primary" type="button" icon={<Plus className="h-4 w-4" />} onClick={() => requestNewDocument()}>
          Nytt dokument
        </Button>
      </div>
    )
  }

  if (onMalbibliotek) {
    return null
  }

  return null
}

function DocumentsModuleShellBody() {
  const location = useLocation()
  const { can, profile, supabase, organization } = useOrgSetupContext()
  const canManage = can('documents.manage') || profile?.is_org_admin === true
  const canEditDocs = canEditWikiDocuments(can, profile?.is_org_admin)
  const [annualReviewDot, setAnnualReviewDot] = useState(false)

  useEffect(() => {
    if (!can('documents.manage') || !supabase || !organization?.id) {
      queueMicrotask(() => setAnnualReviewDot(false))
      return
    }
    const y = new Date().getFullYear()
    const now = new Date()
    const afterFeb1 = now.getMonth() > 1 || (now.getMonth() === 1 && now.getDate() > 1)
    if (!afterFeb1) {
      queueMicrotask(() => setAnnualReviewDot(false))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { review } = await apiFetchAnnualReview(supabase, organization.id, y)
        if (!cancelled) queueMicrotask(() => setAnnualReviewDot(review == null || review.status !== 'completed'))
      } catch {
        if (!cancelled) queueMicrotask(() => setAnnualReviewDot(false))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [can, supabase, organization?.id])

  const onDocumentsHub = location.pathname === '/documents'
  const onMalbibliotek = location.pathname === '/documents/malbibliotek'

  const description = useMemo(() => {
    const p = location.pathname
    if (p.startsWith('/documents/templates')) {
      return (
        <p className="max-w-3xl text-sm text-neutral-600">
          Modulinnstillinger for Dokumenter: revisjon, kvitteringer, maler, tilgangsstyring og arbeidsflyt
          — tilpasset kravene i internkontrollforskriften §5 og arbeidsmiljøloven.
        </p>
      )
    }
    if (p.startsWith('/documents/compliance')) {
      return (
        <p className="max-w-3xl text-sm text-neutral-600">
          Oversikt over dokumentasjon mot krav i internkontrollforskriften og arbeidsmiljøloven — publiserte sider og
          mangler.
        </p>
      )
    }
    if (p.startsWith('/documents/malbibliotek')) {
      return (
        <p className="max-w-3xl text-sm text-neutral-600">
          Velg mappekategori til venstre, bruk maler til høyre. Nye sider åpnes i standard dokumentredaktør.
        </p>
      )
    }
    if (p.startsWith('/documents/aarsgjennomgang')) {
      return (
        <p className="max-w-3xl text-sm text-neutral-600">
          Systematisk gjennomgang etter internkontrollforskriften § 5 nr. 5 — status og punkter for året.
        </p>
      )
    }
    if (p === '/documents/editor-test' || p.includes('/reference-edit')) {
      return (
        <p className="max-w-3xl text-sm text-neutral-600">
          Standard dokumentredaktør (TipTap) — innhold og tittel lagres på wiki-siden der den er åpnet fra.
        </p>
      )
    }
    return <p className="max-w-3xl text-sm text-neutral-600">{DOCUMENTS_MODULE_DESC}</p>
  }, [location.pathname])

  const nav = <DocumentsHubSecondaryNav canManage={canManage} annualReviewBadgeDot={annualReviewDot} />

  return (
    <div className="docs-module-shell" style={documentsModuleShellStyle(profile)}>
      <DocumentsSearchHotkey />
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE }]}
        title={DOCUMENTS_MODULE_TITLE}
        description={description}
        tabs={nav}
        headerActions={<DocumentsShellHeaderActions canEditDocs={canEditDocs} onDocumentsHub={onDocumentsHub} onMalbibliotek={onMalbibliotek} />}
      >
        <ModuleLegalBanner
          title="Dokumenter"
          intro={
            <p>
              Regelverk for dokumenter.
            </p>
          }
          references={DOCUMENTS_MODULE_LEGAL_REFERENCES}
        />
        <Outlet />
      </ModulePageShell>
    </div>
  )
}

/**
 * Shared `ModulePageShell` for documents hub routes (rule §1).
 * Wiki space / page / wiki block editor use {@link DocumentsWikiOutlet} (own shell). TipTap reference editor
 * (`/documents/page/:id/reference-edit`) lives here next to `editor-test` so it shares the same module chrome.
 */
export function DocumentsModuleShellLayout() {
  return (
    <ModuleLegalFrameworkProvider>
      <DocumentsHubActionsProvider>
        <DocumentsShellEmbeddedProvider>
          <DocumentsModuleShellBody />
        </DocumentsShellEmbeddedProvider>
      </DocumentsHubActionsProvider>
    </ModuleLegalFrameworkProvider>
  )
}
