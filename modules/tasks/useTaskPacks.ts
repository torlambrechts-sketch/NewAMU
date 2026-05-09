// Fetches per-org task pack rows from public.task_packs.
// Mirrors usePacks.ts from the compliance module.
import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { TaskPack, TaskPackConfig } from '../../src/types/task'

type Row = {
  id: string
  organization_id: string
  slug: string
  short_name: string
  plural_label: string
  cta_label: string
  description: string
  legal_references: unknown
  kpi_labels: unknown
  severity_labels: unknown
  position: number
  is_active: boolean
}

function mapRow(r: Row): TaskPackConfig {
  return {
    id: r.id,
    organizationId: r.organization_id,
    slug: r.slug as TaskPack,
    shortName: r.short_name,
    pluralLabel: r.plural_label,
    ctaLabel: r.cta_label,
    description: r.description,
    legalReferences: (r.legal_references as TaskPackConfig['legalReferences']) ?? [],
    kpiLabels: (r.kpi_labels as TaskPackConfig['kpiLabels']) ?? { open: 'Åpne', critical: 'Kritiske', ytd: 'I år' },
    severityLabels: (r.severity_labels as TaskPackConfig['severityLabels']) ?? {
      critical: 'Kritisk', high: 'Høy', medium: 'Medium', low: 'Lav',
    },
    position: r.position,
    isActive: r.is_active,
  }
}

export function useTaskPacks() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const [packs, setPacks] = useState<TaskPackConfig[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) { setPacks([]); return }
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('task_packs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
      if (e) {
        if (String(e.message).toLowerCase().includes('does not exist')) { setPacks([]); return }
        throw e
      }
      setPacks((data ?? []).map((r) => mapRow(r as Row)))
    } catch { setPacks([]) }
    finally { setLoading(false) }
  }, [supabase, orgId])

  useEffect(() => { void refresh() }, [refresh])

  const getPack = (slug: string | null | undefined): TaskPackConfig | null => {
    if (!slug) return null
    return packs.find((p) => p.slug === slug) ?? null
  }

  return { packs, loading, refresh, getPack }
}
