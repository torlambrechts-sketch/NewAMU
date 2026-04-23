import { useMemo } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Settings, ShieldCheck } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { Tabs } from '../../src/components/ui/Tabs'
import { Button } from '../../src/components/ui/Button'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { DOCUMENTS_MODULE_DESC, DOCUMENTS_MODULE_TITLE } from '../../src/data/documentsNav'
import { documentsModuleShellStyle } from '../../src/lib/documentsModuleShellStyle'
import { DocumentsHubActionsProvider, useDocumentsHubActions } from './DocumentsHubActionsContext'
import { DocumentsShellEmbeddedProvider } from './DocumentsShellContext'
import { DocumentsHubSecondaryNav } from '../../src/components/documents/DocumentsHubSecondaryNav'

type DocumentsRootTab = 'oversikt' | 'samsvar' | 'innstillinger'

function DocumentsShellHeaderActions({
  activeRootTab,
  canManage,
  onHomeHub,
}: {
  activeRootTab: DocumentsRootTab
  canManage: boolean
  onHomeHub: boolean
}) {
  const { requestOpenNewFolder } = useDocumentsHubActions()

  if (activeRootTab !== 'oversikt' || !canManage) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onHomeHub ? (
        <Button
          variant="primary"
          type="button"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => requestOpenNewFolder()}
        >
          Ny mappe
        </Button>
      ) : null}
    </div>
  )
}

function DocumentsModuleShellBody() {
  const location = useLocation()
  const navigate = useNavigate()
  const { can, isAdmin, profile } = useOrgSetupContext()
  const canManage = isAdmin || can('documents.manage')

  const rootTabFromPath = useMemo((): DocumentsRootTab => {
    const p = location.pathname
    if (p === '/documents/templates' || p.startsWith('/documents/templates/')) return 'innstillinger'
    if (p === '/documents/compliance' || p.startsWith('/documents/compliance/')) return 'samsvar'
    return 'oversikt'
  }, [location.pathname])

  const activeRootTab: DocumentsRootTab =
    rootTabFromPath === 'innstillinger' && !canManage ? 'oversikt' : rootTabFromPath

  const homeHubMatch = useMatch({ path: '/documents', end: true })

  const rootTabItems = useMemo(() => {
    const items: { id: DocumentsRootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
      { id: 'samsvar', label: 'Samsvar', icon: ShieldCheck },
    ]
    if (canManage) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManage])

  const rootTabsNode = (
    <Tabs
      items={rootTabItems}
      activeId={activeRootTab}
      overflow="scroll"
      onChange={(id) => {
        const next = id as DocumentsRootTab
        if (next === 'innstillinger') navigate('/documents/templates')
        else if (next === 'samsvar') navigate('/documents/compliance')
        else navigate('/documents')
      }}
    />
  )

  const description =
    activeRootTab === 'innstillinger' && canManage ? (
      <p className="max-w-3xl text-sm text-neutral-600">
        Aktiver systemmaler og opprett organisasjonsspesifikke maler for malbiblioteket (dokumentasjonskrav i
        internkontrollforskriften § 5).
      </p>
    ) : activeRootTab === 'samsvar' ? (
      <p className="max-w-3xl text-sm text-neutral-600">
        Oversikt over dokumentasjon mot krav i internkontrollforskriften og arbeidsmiljøloven — publiserte sider og
        mangler.
      </p>
    ) : (
      <p className="max-w-3xl text-sm text-neutral-600">{DOCUMENTS_MODULE_DESC}</p>
    )

  const oversiktSecondaryNav =
    activeRootTab === 'oversikt' ? <DocumentsHubSecondaryNav canManage={canManage} /> : null

  return (
    <div className="docs-module-shell" style={documentsModuleShellStyle(profile)}>
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE }]}
        title={DOCUMENTS_MODULE_TITLE}
        description={description}
        tabs={rootTabsNode}
        headerActions={
          <DocumentsShellHeaderActions
            activeRootTab={activeRootTab}
            canManage={canManage}
            onHomeHub={Boolean(homeHubMatch)}
          />
        }
      >
        {oversiktSecondaryNav}
        <Outlet />
      </ModulePageShell>
    </div>
  )
}

/**
 * Shared `ModulePageShell` for hub/admin documents routes (rule §1).
 * Wiki space / page / wiki block editor use {@link DocumentsWikiOutlet} (own shell). TipTap reference editor
 * (`/documents/page/:id/reference-edit`) lives here next to `editor-test` so it shares the same module chrome.
 */
export function DocumentsModuleShellLayout() {
  return (
    <DocumentsHubActionsProvider>
      <DocumentsShellEmbeddedProvider>
        <DocumentsModuleShellBody />
      </DocumentsShellEmbeddedProvider>
    </DocumentsHubActionsProvider>
  )
}
