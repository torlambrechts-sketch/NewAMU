// useComplianceLayerNav — supplies the AticsShell sidebar with
// dynamically-built pinned controls for the active org.
//
// Mirrors the shape of `useComplianceNav` but reads `internal_controls`
// with `nav_pinned = true`. The shell renders Analyse + Innstillinger
// as fixed children first, then the pinned items grouped by
// control_family.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { ControlFamily } from './types'

export type ComplianceLayerPinnedNavItem = {
  controlId: string
  controlSlug: string
  name: string
  controlFamily: ControlFamily
  /** Stable key shared with the matching family header in the sidebar. */
  headerKey: string
  to: string
}

export type ComplianceLayerNavFamily = {
  id: ControlFamily
  label: string
}

export type UseComplianceLayerNavReturn = {
  loading: boolean
  items: ComplianceLayerPinnedNavItem[]
  families: ComplianceLayerNavFamily[]
}

type PinnedControlRow = {
  id: string
  slug: string
  name: string
  control_family: ControlFamily
}

const FAMILY_LABELS: Record<ControlFamily, string> = {
  preventive: 'Forebyggende',
  detective: 'Avdekkende',
  corrective: 'Korrigerende',
  directive: 'Styrende',
}

export function useComplianceLayerNav(): UseComplianceLayerNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [pinned, setPinned] = useState<PinnedControlRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void supabase
      .from('internal_controls')
      .select('id, slug, name, control_family')
      .eq('organization_id', orgId)
      .eq('nav_pinned', true)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .then((res) => {
        if (cancelled) return
        setPinned(res.error ? [] : ((res.data ?? []) as PinnedControlRow[]))
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const items = useMemo<ComplianceLayerPinnedNavItem[]>(() => {
    return pinned.map((c) => ({
      controlId: c.id,
      controlSlug: c.slug,
      name: c.name,
      controlFamily: c.control_family,
      headerKey: `family:${c.control_family}`,
      to: `/controls/${encodeURIComponent(c.id)}`,
    }))
  }, [pinned])

  const families = useMemo<ComplianceLayerNavFamily[]>(() => {
    const present = new Set<ControlFamily>()
    for (const it of items) present.add(it.controlFamily)
    return Array.from(present).map((id) => ({ id, label: FAMILY_LABELS[id] }))
  }, [items])

  return { loading, items, families }
}
