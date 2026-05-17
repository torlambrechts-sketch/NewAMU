// TasksPakkerTab — pack configuration view for the tasks module.
// Queries task_template_catalog to show which templates belong to each
// compliance pack (aml-amu, iso-45001) and their activation status.

import { useCallback, useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import type { TaskPack } from '../../../src/types/task'

const PACK_LABEL: Record<TaskPack, string> = {
  'aml-amu': 'AML / AMU',
  'iso-45001': 'ISO 45001',
}

type PackRow = {
  pack: TaskPack
  templates: { id: string; name: string; kind: string; isSystem: boolean }[]
}

export function TasksPakkerTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [packs, setPacks] = useState<PackRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('task_template_catalog')
        .select('id, name, template_kind, is_system, pack')
        .not('pack', 'is', null)
        .order('name')

      if (qErr) { setError(qErr.message); return }

      const map = new Map<TaskPack, PackRow['templates']>()
      for (const row of data ?? []) {
        const p = row.pack as TaskPack
        if (!map.has(p)) map.set(p, [])
        map.get(p)!.push({ id: row.id, name: row.name, kind: row.template_kind, isSystem: row.is_system })
      }

      setPacks(
        (Object.keys(PACK_LABEL) as TaskPack[]).map((pack) => ({
          pack,
          templates: map.get(pack) ?? [],
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lasting feilet.')
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      {error && <WarningBox>{error}</WarningBox>}

      {packs.map(({ pack, templates }) => (
        <ModuleSectionCard key={pack} className="p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-5 w-5 text-[#c2410c]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">{PACK_LABEL[pack]}</h2>
            <Badge variant="info">{templates.length}</Badge>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Ingen maler i denne pakken ennå.</p>
          ) : (
            <ul className="space-y-1.5">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 px-4 py-2.5"
                >
                  <span className="text-sm font-medium text-neutral-900">{t.name}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="neutral">{t.kind}</Badge>
                    {t.isSystem && <Badge variant="info">System</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ModuleSectionCard>
      ))}
    </div>
  )
}
