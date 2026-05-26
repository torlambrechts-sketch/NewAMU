import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { PageContainer } from '../components/layout/PageContainer'
import { SurveyDetailView } from '../../modules/survey/SurveyDetailView'

export function SurveyDetailPage() {
  const { supabase } = useOrgSetupContext()
  return (
    <PageContainer py="py-6">
      <SurveyDetailView supabase={supabase} />
    </PageContainer>
  )
}
