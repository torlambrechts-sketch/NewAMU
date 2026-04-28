import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

type PendingRow = { survey_id: string; title: string }

export function SurveyPendingInvitesBanner() {
  const { supabase, user, organization } = useOrgSetupContext()
  const [rows, setRows] = useState<PendingRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase || !user?.id || !organization?.id) {
      setRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data: invs, error } = await supabase
          .from('survey_invitations')
          .select('survey_id')
          .eq('organization_id', organization.id)
          .eq('profile_id', user.id)
          .eq('status', 'pending')
        if (error || cancelled) return
        const ids = [...new Set((invs ?? []).map((r: { survey_id: string }) => r.survey_id))]
        if (ids.length === 0) {
          setRows([])
          return
        }
        const { data: survs, error: se } = await supabase
          .from('surveys')
          .select('id, title, status')
          .eq('organization_id', organization.id)
          .eq('status', 'active')
          .in('id', ids)
        if (se || cancelled) return
        const list = (survs ?? []) as Array<{ id: string; title: string }>
        setRows(list.map((s) => ({ survey_id: s.id, title: s.title })))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, user?.id, organization?.id])

  const content = useMemo(() => {
    if (!rows.length || loading) return null
    return (
      <div className="flex flex-wrap items-start gap-3 border-b border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950 md:px-5">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Ventende undersøkelser</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-900/90">
            {rows.map((r) => (
              <li key={r.survey_id}>
                <Link
                  to={`/survey-respond/${r.survey_id}`}
                  className="font-medium underline decoration-amber-600/50 underline-offset-2 hover:decoration-amber-800"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }, [rows, loading])

  return content
}
