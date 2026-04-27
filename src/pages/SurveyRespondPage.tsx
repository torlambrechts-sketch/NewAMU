import { useParams } from 'react-router-dom'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { SurveyRespondForm } from '../../modules/survey/SurveyRespondForm'

export function SurveyRespondPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const supabase = getSupabaseBrowserClient()

  if (!campaignId) return <div className="py-16 text-center text-sm text-red-500">Ugyldig lenke.</div>

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3d32]">Medarbeiderundersøkelse</h1>
        <p className="mt-1 text-sm text-neutral-500">Dine svar er anonyme og brukes til å forbedre arbeidsmiljøet.</p>
      </div>
      <SurveyRespondForm supabase={supabase} campaignId={campaignId} />
    </div>
  )
}
