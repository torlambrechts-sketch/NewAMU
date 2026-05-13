// Self-fetching wrapper around useLearningDatasets for the cross-scope
// reporting host. The Analyse page-level hook (useLearningDatasets) takes
// pre-fetched source data as args because the page wires its own filter
// logic (regulation, categories); reports skip those pre-filters and
// snapshot the full org dataset, then let the dataset hook's own chip
// matcher apply the report's filters.

import { useLearning } from '../../../hooks/useLearning'
import { useLearningCategories } from '../../../hooks/useLearningCategories'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { DatasetsHookDeps } from '../../../lib/dashboards/dashboardRegistry'
import { useLearningDatasets } from './useLearningDatasets'

export function useLearningDatasetsForReports(deps: DatasetsHookDeps): Record<string, unknown> {
  const orgSetup = useOrgSetupContext()
  const learning = useLearning()
  const cats = useLearningCategories({ supabase: deps.supabase })
  return useLearningDatasets({
    filters: deps.filters,
    courses: learning.courses,
    progress: learning.progress,
    certificates: learning.certificates,
    categories: cats.categories,
    members: orgSetup.members,
    departments: orgSetup.departments,
  })
}
