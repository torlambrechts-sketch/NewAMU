import { ClipboardList, Columns3, Gavel, ShieldCheck } from 'lucide-react'
import type { HubMenu1Item } from '../layout/HubMenu1Bar'

/**
 * Hub menu for the Samsvar (Compliance) section. Same shape as DocumentsHubSecondaryNav /
 * Survey hub menus — used by ComplianceModuleChrome and ComplianceDashboardPage.
 */
export function buildComplianceHubItems(activeKey: string): HubMenu1Item[] {
  return [
    {
      key: 'overview',
      label: 'Oversikt',
      icon: ClipboardList,
      active: activeKey === 'overview',
      to: '/compliance',
      end: true,
    },
    {
      key: 'kanban',
      label: 'Kanban',
      icon: Columns3,
      active: activeKey === 'kanban',
      to: '/compliance/kanban',
      end: true,
    },
    {
      key: 'aml',
      label: 'AML — kapitler',
      icon: Gavel,
      active: activeKey === 'aml',
      to: '/compliance/aml',
      end: true,
    },
    {
      key: 'internforskriften',
      label: 'Internforskriften',
      icon: ShieldCheck,
      active: activeKey === 'internforskriften',
      to: '/compliance/internforskriften',
      end: true,
    },
  ]
}
