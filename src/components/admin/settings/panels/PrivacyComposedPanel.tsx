// Personvern & GDPR composite panel.
//
// Hosts both the GDPR breach reporting and GDPR subject-rights surfaces
// under one settings section so admins find every personvern-relatert
// ops surface in one tab. The two existing panels are reused verbatim;
// only the tab switch is new. The query param `?gdpr=` lets external
// links deep-link to a specific sub-tab.

import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldAlert, UserSearch } from 'lucide-react'
import { Tabs, type TabItem } from '../../../ui/Tabs'
import { GdprBreachAdminPanel } from '../../../../pages/admin/GdprBreachAdminPanel'
import { GdprSubjectRequestsAdminPanel } from '../../../../pages/admin/GdprSubjectRequestsAdminPanel'

type SubTab = 'breach' | 'subject'

function readTab(search: string): SubTab {
  const value = new URLSearchParams(search).get('gdpr')
  return value === 'subject' ? 'subject' : 'breach'
}

export default function PrivacyComposedPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const active: SubTab = readTab(location.search)

  const items: TabItem[] = useMemo(
    () => [
      { id: 'breach', label: 'GDPR brudd', icon: ShieldAlert },
      { id: 'subject', label: 'Individrettigheter', icon: UserSearch },
    ],
    [],
  )

  const handleChange = (id: string) => {
    const next = id === 'subject' ? 'subject' : 'breach'
    const params = new URLSearchParams(location.search)
    params.set('gdpr', next)
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs items={items} activeId={active} onChange={handleChange} overflow="scroll" />
      {active === 'breach' ? <GdprBreachAdminPanel /> : <GdprSubjectRequestsAdminPanel />}
    </div>
  )
}
