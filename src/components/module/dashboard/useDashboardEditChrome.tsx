// useDashboardEditChrome — shared hook that wires the V1/V3 edit-mode
// chrome (Klarert dashboard kit · ui_kits/dashboard/) for any module
// analyse page. Replaces the repeated 25-line inline wiring across the
// six analyse pages with one call.
//
// Usage:
//
//   const editChrome = useDashboardEditChrome({
//     scopeId: CHECKLIST_DASHBOARD_SCOPE_ID,
//     layout: dashboard.layout,
//     saveLayout: dashboard.saveLayout,
//   })
//
//   <ModuleAnalyticsDashboard
//     headerActions={
//       <div className="flex items-center gap-2">
//         {editChrome.toggleButton}
//         <Link to="...">Tilbake</Link>
//       </div>
//     }
//     onEdit={undefined}
//     onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
//     {...editChrome.moduleProps}
//     // other props
//   />

import { useState, type ReactNode } from 'react'
import { Check, PenLine } from 'lucide-react'
import { Button } from '../../ui/Button'
import { DashboardWidgetLibraryRail } from './DashboardWidgetLibraryRail'
import {
  getDashboardScope,
  instantiateWidget,
} from '../../../lib/dashboards/dashboardRegistry'
import type { ReportModule, ReportModuleKind } from '../../../types/reportBuilder'

type Args = {
  scopeId: string
  /** Current widget layout (from useDashboardLayout). */
  layout: ReportModule[]
  /** Persists the new layout (typically `dashboard.saveLayout`). */
  saveLayout: (next: ReportModule[]) => Promise<boolean> | boolean | void
}

type EditChromeModuleProps = {
  editMode: boolean
  widgetLibrarySlot: ReactNode | undefined
  onRemoveWidget: (m: ReportModule) => void
  onDropFromLibrary: (payload: {
    catalogId: string
    kindOverride?: ReportModuleKind
  }) => void
}

export type UseDashboardEditChromeResult = {
  editMode: boolean
  setEditMode: (value: boolean) => void
  /** Pre-wired toggle button — render somewhere in headerActions. */
  toggleButton: ReactNode
  /** Spread onto <ModuleAnalyticsDashboard> to enable V3 edit mode. */
  moduleProps: EditChromeModuleProps
}

export function useDashboardEditChrome({
  scopeId,
  layout,
  saveLayout,
}: Args): UseDashboardEditChromeResult {
  const [editMode, setEditMode] = useState(false)

  const handleDropFromLibrary = ({
    catalogId,
    kindOverride,
  }: {
    catalogId: string
    kindOverride?: ReportModuleKind
  }) => {
    const scope = getDashboardScope(scopeId)
    const entry = scope?.widgetCatalog.find((c) => c.catalogId === catalogId)
    if (!entry) return
    const widget = instantiateWidget(entry)
    const final = (
      kindOverride && kindOverride !== entry.template.kind
        ? { ...(widget as Record<string, unknown>), kind: kindOverride }
        : widget
    ) as ReportModule
    void saveLayout([...layout, final])
  }

  const handleRemoveWidget = (w: ReportModule) => {
    if (!window.confirm(`Fjerne widgeten «${w.title}»?`)) return
    void saveLayout(layout.filter((x) => x.id !== w.id))
  }

  const toggleButton = (
    <Button
      type="button"
      variant={editMode ? 'primary' : 'secondary'}
      icon={editMode ? <Check className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
      onClick={() => setEditMode((v) => !v)}
    >
      {editMode ? 'Lagre oppsett' : 'Rediger oppsett'}
    </Button>
  )

  const widgetLibrarySlot = editMode ? (
    <DashboardWidgetLibraryRail
      scopeId={scopeId}
      onAdd={(widget) => saveLayout([...layout, widget])}
    />
  ) : undefined

  return {
    editMode,
    setEditMode,
    toggleButton,
    moduleProps: {
      editMode,
      widgetLibrarySlot,
      onRemoveWidget: handleRemoveWidget,
      onDropFromLibrary: handleDropFromLibrary,
    },
  }
}
