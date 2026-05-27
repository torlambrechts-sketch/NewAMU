// CadenceActivePlansList — viser aktive og draft cadence-planer i org-en.
//
// Liste-view brukes som inngang for å gjenåpne en draft eller inspisere
// hvilke moduler en iverksatt plan har skapt task-rader for. Per dag
// rendres en enkel kort-liste; en mer detaljert "open plan"-side rulles
// ut i neste fase.

import { useEffect, useState } from 'react'
import { ArrowRight, CalendarClock, ClipboardList, FileText, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { REGELVERK_BY_ID, type CadenceRegelverkId } from './wizard/cadenceWizardData'

type CadencePlanRow = {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  wizard_step: number
  regelverk: string[]
  activated_at: string | null
  updated_at: string
  module_count: number
  task_count: number
}

export function CadenceActivePlansList() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const [rows, setRows] = useState<CadencePlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    void (async () => {
      const { data: plans, error: plansErr } = await supabase
        .from('cadence_plans')
        .select('id, name, description, status, wizard_step, regelverk, activated_at, updated_at')
        .eq('organization_id', organization.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (cancelled) return
      if (plansErr) {
        setError('Kunne ikke laste cadence-planer: ' + plansErr.message)
        setLoading(false)
        return
      }
      const planRows = (plans ?? []) as Array<{
        id: string
        name: string
        description: string | null
        status: 'draft' | 'active' | 'archived'
        wizard_step: number
        regelverk: string[]
        activated_at: string | null
        updated_at: string
      }>
      const ids = planRows.map((p) => p.id)

      // Telle moduler + tasks parallelt. Begge bruker RLS, så vi får
      // bare det vi har lov å se.
      const modCounts: Record<string, number> = {}
      const taskCounts: Record<string, number> = {}
      if (ids.length > 0) {
        const [{ data: modRows }, { data: taskRows }] = await Promise.all([
          supabase
            .from('cadence_plan_modules')
            .select('cadence_plan_id')
            .in('cadence_plan_id', ids),
          supabase
            .from('task_items')
            .select('source_id')
            .eq('source_type', 'cadence_plan')
            .in('source_id', ids)
            .is('deleted_at', null),
        ])
        if (modRows) {
          for (const r of modRows as { cadence_plan_id: string }[]) {
            modCounts[r.cadence_plan_id] = (modCounts[r.cadence_plan_id] ?? 0) + 1
          }
        }
        if (taskRows) {
          for (const r of taskRows as { source_id: string }[]) {
            taskCounts[r.source_id] = (taskCounts[r.source_id] ?? 0) + 1
          }
        }
      }

      if (cancelled) return
      setRows(
        planRows.map((p) => ({
          ...p,
          module_count: modCounts[p.id] ?? 0,
          task_count: taskCounts[p.id] ?? 0,
        })),
      )
      setError(null)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id])

  if (loading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#1a3d32]" aria-hidden />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <FileText className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
        <h3 className="mt-3 text-lg font-semibold text-neutral-900">Ingen cadence-planer ennå</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Start veiviseren for å bygge HMS-årshjulet med valgte lovverk og moduler.
        </p>
        <div className="mt-4">
          <Button variant="primary" onClick={() => navigate('/cadence?section=veiviser')}>
            Start veiviseren
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((p) => {
        const isDraft = p.status === 'draft'
        const isActive = p.status === 'active'
        const isArchived = p.status === 'archived'
        return (
          <div
            key={p.id}
            className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-neutral-900">{p.name}</h3>
                {isDraft && (
                  <span className="rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-900">
                    Utkast · steg {p.wizard_step}/8
                  </span>
                )}
                {isActive && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                    Aktiv
                  </span>
                )}
                {isArchived && (
                  <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                    Arkivert
                  </span>
                )}
              </div>
              {p.description ? (
                <p className="mt-1 text-sm text-neutral-600">{p.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-neutral-500">
                <span className="inline-flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  {p.module_count} moduler
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  {p.task_count} task-rader opprettet
                </span>
                {p.regelverk.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    Regelverk:{' '}
                    {p.regelverk
                      .map((id) => REGELVERK_BY_ID[id as CadenceRegelverkId]?.shortCode ?? id)
                      .join(', ')}
                  </span>
                )}
                {p.activated_at && (
                  <span>
                    Iverksatt{' '}
                    {new Date(p.activated_at).toLocaleDateString('nb-NO', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDraft && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/cadence?section=veiviser')}
                  icon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Fortsett
                </Button>
              )}
              {isActive && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/tasks/management')}
                >
                  Vis oppgaver
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
