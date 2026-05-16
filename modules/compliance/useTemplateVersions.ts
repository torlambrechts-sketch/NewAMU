// useTemplateVersions — list + publish + diff for compliance walkthrough
// template versions. Wraps the two RPCs shipped in Phase 13.
//
//   list:    public.compliance_template_versions  (SELECT, RLS-protected)
//   publish: compliance_template_publish_version(slug, pack, major, minor, changelog) — admin only
//   diff:    compliance_template_version_diff(slug, pack, from_v, to_v) → { added, removed, modified }

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { CompliancePackSlug } from './types'

export type TemplateVersionRow = {
  id: string
  slug: string
  pack: CompliancePackSlug
  version_major: number
  version_minor: number
  name: string
  description: string | null
  changelog: string | null
  published_at: string
  published_by: string | null
}

export type TemplateVersionDiff = {
  added: Array<Record<string, unknown>>
  removed: Array<Record<string, unknown>>
  modified: Array<{ key: string; old: Record<string, unknown>; new: Record<string, unknown> }>
}

export function useTemplateVersions(slug: string | null, pack: CompliancePackSlug | null) {
  const { supabase } = useOrgSetupContext()
  const [versions, setVersions] = useState<TemplateVersionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !slug || !pack) {
      setVersions([])
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('compliance_template_versions')
      .select('id,slug,pack,version_major,version_minor,name,description,changelog,published_at,published_by')
      .eq('slug', slug)
      .eq('pack', pack)
      .order('version_major', { ascending: false })
      .order('version_minor', { ascending: false })
    setLoading(false)
    if (err) {
      setError(err.message)
      setVersions([])
      return
    }
    setVersions((data ?? []) as TemplateVersionRow[])
  }, [supabase, slug, pack])

  useEffect(() => {
    void load()
  }, [load])

  const publish = useCallback(
    async (versionMajor: number, versionMinor: number, changelog: string): Promise<string | null> => {
      if (!supabase || !slug || !pack) return null
      const { data, error: err } = await supabase.rpc(
        'compliance_template_publish_version',
        {
          p_slug: slug,
          p_pack_slug: pack,
          p_version_major: versionMajor,
          p_version_minor: versionMinor,
          p_changelog: changelog,
        },
      )
      if (err) {
        setError(err.message)
        return null
      }
      await load()
      return data as string
    },
    [supabase, slug, pack, load],
  )

  const diff = useCallback(
    async (
      fromMajor: number,
      fromMinor: number,
      toMajor: number,
      toMinor: number,
    ): Promise<TemplateVersionDiff | null> => {
      if (!supabase || !slug || !pack) return null
      const { data, error: err } = await supabase.rpc(
        'compliance_template_version_diff',
        {
          p_slug: slug,
          p_pack_slug: pack,
          p_from_major: fromMajor,
          p_from_minor: fromMinor,
          p_to_major: toMajor,
          p_to_minor: toMinor,
        },
      )
      if (err) {
        setError(err.message)
        return null
      }
      return data as TemplateVersionDiff
    },
    [supabase, slug, pack],
  )

  return { versions, loading, error, publish, diff, reload: load }
}
