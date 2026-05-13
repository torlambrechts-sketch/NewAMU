// Self-fetching wrapper around useDocumentsDatasets for the cross-scope
// reporting host. Calls the DocumentsProvider's context hook to get the
// org's pages/spaces/templates/access-requests, then hands them to the
// existing dataset hook. The regulation cross-filter used by the Analyse
// page is intentionally skipped here — reports compose their own scope
// selection and shouldn't be filtered behind the user's back.

import { useMemo } from 'react'
import { useDocuments } from '../../../hooks/useDocuments'
import type { DatasetsHookDeps } from '../../../lib/dashboards/dashboardRegistry'
import { useDocumentsDatasets } from './useDocumentsDatasets'

export function useDocumentsDatasetsForReports(deps: DatasetsHookDeps): Record<string, unknown> {
  const docs = useDocuments()
  const accessRequestsOpen = useMemo(
    () => docs.wikiAccessRequests.filter((r) => r.status === 'pending').length,
    [docs.wikiAccessRequests],
  )
  return useDocumentsDatasets({
    filters: deps.filters,
    pages: docs.pages,
    spaces: docs.spaces,
    orgCustomTemplates: docs.orgCustomTemplates,
    accessRequestsOpen,
  })
}
