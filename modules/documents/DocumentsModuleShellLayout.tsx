import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Settings, ShieldCheck } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { Tabs } from '../../src/components/ui/Tabs'
import { Button } from '../../src/components/ui/Button'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { DOCUMENTS_MODULE_DESC, DOCUMENTS_MODULE_TITLE } from '../../src/data/documentsNav'
import { documentsModuleShellStyle } from '../../src/lib/documentsModuleShellStyle'
import { DocumentsHubActionsProvider, useDocumentsHubActions } from './DocumentsHubActionsContext'
import { DocumentsShellEmbeddedProvider } from './DocumentsShellContext'

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

  const [rootTab, setRootTab] = useState<DocumentsRootTab>('oversikt')

  useEffect(() => {
    const p = location.pathname
    if (p === '/documents/templates' || p.startsWith('/documents/templates/')) {
      setRootTab('innstillinger')
    } else if (p === '/documents/compliance' || p.startsWith('/documents/compliance/')) {
      setRootTab('samsvar')
    } else {
      setRootTab('oversikt')
    }
  }, [location.pathname])

  const activeRootTab: DocumentsRootTab =
    rootTab === 'innstillinger' && !canManage ? 'oversikt' : rootTab

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
        setRootTab(next)
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

  const oversiktLinks =
    activeRootTab === 'oversikt' ? (
      <nav
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200/80 pb-4 text-sm"
        aria-label="Flere dokumentseksjoner"
      >
        <Link
          to="/documents/scorecard-browser"
          className="font-medium text-[#1a3d32] underline-offset-2 hover:underline"
        >
          Scorecard-visning (test)
        </Link>
        {canManage ? (
          <Link
            to="/documents/aarsgjennomgang"
            className="font-medium text-[#1a3d32] underline-offset-2 hover:underline"
          >
            Årsgjennomgang
          </Link>
        ) : null}
      </nav>
    ) : null

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
        {oversiktLinks}
        <Outlet />
      </ModulePageShell>
    </div>
  )
}

/**
 * Shared `ModulePageShell` for hub/admin documents routes (rule §1).
 * Wiki space / page / editor use {@link DocumentsWikiOutlet} so each view owns its own shell (no double chrome).
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
