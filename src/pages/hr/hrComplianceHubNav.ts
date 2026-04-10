import { FileWarning, GitBranch, LayoutGrid, Scale } from 'lucide-react'
import type { HubMenu1Item } from '../../components/layout/HubMenu1Bar'

export function hrComplianceHubItems(pathname: string): HubMenu1Item[] {
  return [
    { key: 'hub', label: 'Oversikt', icon: LayoutGrid, active: pathname === '/hr', to: '/hr', end: true },
    {
      key: 'disc',
      label: '§ 15-1',
      icon: FileWarning,
      active: pathname === '/hr/discussion',
      to: '/hr/discussion',
    },
    {
      key: 'cons',
      label: 'Kap. 8',
      icon: Scale,
      active: pathname === '/hr/consultation',
      to: '/hr/consultation',
    },
    {
      key: 'oros',
      label: 'O-ROS',
      icon: GitBranch,
      active: pathname === '/hr/o-ros',
      to: '/hr/o-ros',
    },
  ]
}
