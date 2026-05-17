// TasksKravTab — legal-requirement coverage for the tasks module.
// Groups law_refs from task_template_catalog by template kind so admins can
// see which statutory obligations are covered by the current template set.

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { WarningBox } from '../../../src/components/ui/AlertBox'

type RefGroup = { kind: string; refs: string[]; templateCount: number }

export function TasksKravTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [groups, setGroups] = useState<RefGroup[]>([])
  const [totalRefs, setTotalRefs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('task_template_catalog')
        .select('template_kind, law_refs')
        .order('template_kind')

      if (qErr) { setError(qErr.message); return }

      const map = new Map<string, RefGroup>()
      for (const row of data ?? []) {
        const kind = row.template_kind as string
        if (!map.has(kind)) map.set(kind, { kind, refs: [], templateCount: 0 })
        const g = map.get(kind)!
        g.templateCount++
        for (const ref of (row.law_refs as string[]) ?? []) {
          if (!g.refs.includes(ref)) g.refs.push(ref)
        }
      }

      const sorted = Array.from(map.values()).sort((a, b) => a.kind.localeCompare(b.kind))
      setGroups(sorted)
      setTotalRefs(sorted.reduce((n, g) => n + g.refs.length, 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lasting feilet.')
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      {error && <WarningBox>{error}</WarningBox>}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-[#c2410c]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Lovkrav</h2>
          {totalRefs > 0 && (
            <span className="ml-auto text-xs text-neutral-500">
              {totalRefs} referanse{totalRefs !== 1 ? 'r' : ''} totalt
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-600 mb-5">
          Lovhenvisninger hentet fra malkatalogenes <code className="text-xs bg-neutral-100 px-1 rounded">law_refs</code>-felt,
          gruppert etter oppgavetype.
        </p>

        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
            Ingen maler med lovhenvisninger funnet.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div
                key={g.kind}
                className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-neutral-900 capitalize">{g.kind}</span>
                  <span className="text-xs text-neutral-500">({g.templateCount} maler)</span>
                </div>
                {g.refs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {g.refs.sort().map((ref) => (
                      <Badge key={ref} variant="info">{ref}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">Ingen lovhenvisninger.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
