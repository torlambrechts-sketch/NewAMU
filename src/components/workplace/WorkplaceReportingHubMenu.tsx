import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { HubMenu1Bar, type HubMenu1Item } from '../layout/HubMenu1Bar'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  WORKPLACE_REPORTING_NAV,
  canAccessWorkplaceReportingItem,
  workplaceReportingNavMatch,
} from '../../data/workplaceReportingNav'

type Props = {
  /** When set, shown on «Hendelser» (open incidents), like Ansatte-badge on Organisasjon. */
  incidentsBadgeCount?: number
}

export function WorkplaceReportingHubMenu({ incidentsBadgeCount }: Props) {
  const location = useLocation()
  const { can } = useOrgSetupContext()

  const items = useMemo((): HubMenu1Item[] => {
    return WORKPLACE_REPORTING_NAV.filter((item) => canAccessWorkplaceReportingItem(item, can)).map((item) => {
      const active = workplaceReportingNavMatch(item.to, item.end, location.pathname, location.search)
      const badge =
        item.to === '/workplace-reporting/incidents' && incidentsBadgeCount !== undefined
          ? incidentsBadgeCount
          : undefined
      return {
        key: item.to,
        label: item.label,
        icon: item.icon,
        active,
        to: item.to,
        end: item.end,
        badgeCount: badge,
      }
    })
  }, [can, location.pathname, location.search, incidentsBadgeCount])

  return <HubMenu1Bar ariaLabel="Arbeidsplassrapportering" items={items} />
}
