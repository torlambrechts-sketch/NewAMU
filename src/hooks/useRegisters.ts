// useRegisters — read + admin mutations for the registers engine.
// See specs/registers-engine.md.
//
// Two-layer surface:
//   - Catalogue level: register types + per-org settings + categories.
//     Returns the resolved list of types visible to the org (system +
//     org-authored + enable-flag from settings + name-override + category).
//   - Record level: a separate hook `useRegisterRecords(typeId)` that
//     reads + writes records of a single type. Kept separate so paginated
//     record lists don't re-render the catalogue.
//
// Mirrors the shape of useLearningCategories + useSurveyOrgTemplates.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  RegisterMetadataSchemaSchema,
  RegisterRecordStatusSchema,
  type RegisterCategory,
  type RegisterMetadataSchema,
  type RegisterOrgSettings,
  type RegisterRecord,
  type RegisterRecordStatus,
  type RegisterType,
} from '../types/registers'

// ── Resolved view consumers actually read ────────────────────────────────

/** Register type joined with per-org settings; what consumers render. */
export type ResolvedRegisterType = RegisterType & {
  /** Per-org settings; null when no row exists for this (org, type). */
  settings: RegisterOrgSettings | null
  /** Resolved name — settings.nameOverride or type.name. */
  resolvedName: string
  /** Resolved category id — settings.categoryId or null. */
  categoryId: string | null
  /** Convenience — !settings || settings.enabled */
  isEnabledForOrg: boolean
}

export type UseRegistersReturn = {
  loading: boolean
  error: string | null
  /** All system + org-visible types, with per-org settings overlaid. */
  types: ResolvedRegisterType[]
  /** Per-org categories, sorted by position. */
  categories: RegisterCategory[]
  refresh: () => Promise<void>

  // Admin mutations (require admin / owner role; supabase RLS enforces)
  createCategory: (payload: {
    slug: string
    name: string
    description?: string | null
    regulationId?: string | null
    position?: number
  }) => Promise<string | null>
  updateCategory: (input: {
    categoryId: string
    name?: string
    description?: string | null
    regulationId?: string | null
    position?: number
    is_active?: boolean
  }) => Promise<void>
  softDeleteCategory: (categoryId: string) => Promise<void>

  /** Author a per-org register type. Returns the new id, or null on error. */
  createOrgType: (payload: {
    slug: string
    name: string
    description?: string | null
    metadataSchema: RegisterMetadataSchema
    regulationIds?: string[]
    packSlugs?: string[]
    defaultReviewCadenceMonths?: number | null
  }) => Promise<string | null>

  setTypeEnabled: (typeId: string, enabled: boolean) => Promise<void>
  setTypeNavPinned: (typeId: string, pinned: boolean) => Promise<void>
  setTypeCategory: (typeId: string, categoryId: string | null) => Promise<void>
  setTypeNameOverride: (typeId: string, nameOverride: string | null) => Promise<void>
}

// ── Zod-light shape mappers (DB row → user-facing shape) ─────────────────

type DbRegisterTypeRow = {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  metadata_schema: unknown
  regulation_ids: string[] | null
  pack_slugs: string[] | null
  default_review_cadence_months: number | null
  is_active: boolean
  is_system: boolean
  position: number
  created_at: string
  updated_at: string
}

type DbCategoryRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  regulation_id: string | null
  position: number
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

type DbSettingsRow = {
  organization_id: string
  register_type_id: string
  enabled: boolean
  name_override: string | null
  category_id: string | null
  nav_pinned: boolean
  position: number
}

function mapType(row: DbRegisterTypeRow): RegisterType {
  // Defensive parse of metadata_schema — fall back to empty when malformed.
  const schemaParse = RegisterMetadataSchemaSchema.safeParse(row.metadata_schema)
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    metadataSchema: schemaParse.success ? schemaParse.data : { fields: [] },
    regulationIds: row.regulation_ids ?? [],
    packSlugs: row.pack_slugs ?? [],
    defaultReviewCadenceMonths: row.default_review_cadence_months,
    isActive: row.is_active,
    isSystem: row.is_system,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCategory(row: DbCategoryRow): RegisterCategory {
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    regulationId: row.regulation_id,
    position: row.position,
    isActive: row.is_active,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSettings(row: DbSettingsRow): RegisterOrgSettings {
  return {
    organizationId: row.organization_id,
    registerTypeId: row.register_type_id,
    enabled: row.enabled,
    nameOverride: row.name_override,
    categoryId: row.category_id,
    navPinned: row.nav_pinned,
    position: row.position,
  }
}

// ── Hook ────────────────────────────────────────────────────────────────

type Input = { supabase: SupabaseClient | null }

export function useRegisters(input: Input): UseRegistersReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [types, setTypes] = useState<RegisterType[]>([])
  const [categories, setCategories] = useState<RegisterCategory[]>([])
  const [settings, setSettings] = useState<RegisterOrgSettings[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [tRes, cRes, sRes] = await Promise.all([
        supabase
          .from('register_types')
          .select('*')
          .eq('is_active', true)
          .order('position', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('register_categories')
          .select('*')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('position', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('register_org_settings')
          .select('*')
          .eq('organization_id', orgId),
      ])
      if (tRes.error) throw tRes.error
      if (cRes.error) throw cRes.error
      if (sRes.error) throw sRes.error
      setTypes((tRes.data ?? []).map((r) => mapType(r as DbRegisterTypeRow)))
      setCategories((cRes.data ?? []).map((r) => mapCategory(r as DbCategoryRow)))
      setSettings((sRes.data ?? []).map((r) => mapSettings(r as DbSettingsRow)))
      setFetchedFor(orgId)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (orgId && fetchedFor !== orgId) void refresh()
  }, [orgId, fetchedFor, refresh])

  // Resolve — overlay per-org settings on each type. Hide types from
  // other orgs (the RLS already filters, but belt-and-braces).
  const resolved = useMemo<ResolvedRegisterType[]>(() => {
    const settingsByType = new Map<string, RegisterOrgSettings>()
    for (const s of settings) settingsByType.set(s.registerTypeId, s)
    return types
      .filter((t) => t.organizationId === null || t.organizationId === orgId)
      .map<ResolvedRegisterType>((t) => {
        const s = settingsByType.get(t.id) ?? null
        return {
          ...t,
          settings: s,
          resolvedName: s?.nameOverride ?? t.name,
          categoryId: s?.categoryId ?? null,
          isEnabledForOrg: !s || s.enabled,
        }
      })
      .sort((a, b) => a.position - b.position || a.resolvedName.localeCompare(b.resolvedName, 'nb'))
  }, [types, settings, orgId])

  // ── Mutations ─────────────────────────────────────────────────────────

  const createCategory: UseRegistersReturn['createCategory'] = useCallback(
    async (payload) => {
      if (!supabase || !orgId) return null
      const { data, error: insErr } = await supabase
        .from('register_categories')
        .insert({
          organization_id: orgId,
          slug: payload.slug,
          name: payload.name,
          description: payload.description ?? null,
          regulation_id: payload.regulationId ?? null,
          position: payload.position ?? 100,
        })
        .select('id')
        .single()
      if (insErr) {
        setError(getSupabaseErrorMessage(insErr))
        return null
      }
      await refresh()
      return (data as { id: string }).id
    },
    [supabase, orgId, refresh],
  )

  const updateCategory: UseRegistersReturn['updateCategory'] = useCallback(
    async ({ categoryId, ...patch }) => {
      if (!supabase || !orgId) return
      const row: Record<string, unknown> = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.description !== undefined) row.description = patch.description
      if (patch.regulationId !== undefined) row.regulation_id = patch.regulationId
      if (patch.position !== undefined) row.position = patch.position
      if (patch.is_active !== undefined) row.is_active = patch.is_active
      const { error: e } = await supabase
        .from('register_categories')
        .update(row)
        .eq('id', categoryId)
        .eq('organization_id', orgId)
      if (e) setError(getSupabaseErrorMessage(e))
      else await refresh()
    },
    [supabase, orgId, refresh],
  )

  const softDeleteCategory: UseRegistersReturn['softDeleteCategory'] = useCallback(
    async (categoryId) => {
      if (!supabase || !orgId) return
      const { error: e } = await supabase
        .from('register_categories')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', categoryId)
        .eq('organization_id', orgId)
      if (e) setError(getSupabaseErrorMessage(e))
      else await refresh()
    },
    [supabase, orgId, refresh],
  )

  const createOrgType: UseRegistersReturn['createOrgType'] = useCallback(
    async (payload) => {
      if (!supabase || !orgId) return null
      const id = `org-${orgId.slice(0, 8)}-${payload.slug}`
      const { error: insErr } = await supabase.from('register_types').insert({
        id,
        organization_id: orgId,
        name: payload.name,
        description: payload.description ?? null,
        metadata_schema: payload.metadataSchema,
        regulation_ids: payload.regulationIds ?? [],
        pack_slugs: payload.packSlugs ?? [],
        default_review_cadence_months: payload.defaultReviewCadenceMonths ?? null,
        is_active: true,
        is_system: false,
      })
      if (insErr) {
        setError(getSupabaseErrorMessage(insErr))
        return null
      }
      // Auto-enable for the org.
      await supabase.from('register_org_settings').insert({
        organization_id: orgId,
        register_type_id: id,
        enabled: true,
        nav_pinned: true,
      })
      await refresh()
      return id
    },
    [supabase, orgId, refresh],
  )

  const upsertSettings = useCallback(
    async (typeId: string, patch: Partial<DbSettingsRow>) => {
      if (!supabase || !orgId) return
      const { error: e } = await supabase
        .from('register_org_settings')
        .upsert(
          {
            organization_id: orgId,
            register_type_id: typeId,
            enabled: true,
            nav_pinned: true,
            ...patch,
          },
          { onConflict: 'organization_id,register_type_id' },
        )
      if (e) setError(getSupabaseErrorMessage(e))
      else await refresh()
    },
    [supabase, orgId, refresh],
  )

  const setTypeEnabled = useCallback(
    (typeId: string, enabled: boolean) => upsertSettings(typeId, { enabled }),
    [upsertSettings],
  )
  const setTypeNavPinned = useCallback(
    (typeId: string, pinned: boolean) => upsertSettings(typeId, { nav_pinned: pinned }),
    [upsertSettings],
  )
  const setTypeCategory = useCallback(
    (typeId: string, categoryId: string | null) =>
      upsertSettings(typeId, { category_id: categoryId }),
    [upsertSettings],
  )
  const setTypeNameOverride = useCallback(
    (typeId: string, nameOverride: string | null) =>
      upsertSettings(typeId, { name_override: nameOverride }),
    [upsertSettings],
  )

  return {
    loading,
    error,
    types: resolved,
    categories,
    refresh,
    createCategory,
    updateCategory,
    softDeleteCategory,
    createOrgType,
    setTypeEnabled,
    setTypeNavPinned,
    setTypeCategory,
    setTypeNameOverride,
  }
}

// ── Per-type record list hook ────────────────────────────────────────────

export type UseRegisterRecordsReturn = {
  loading: boolean
  error: string | null
  records: RegisterRecord[]
  refresh: () => Promise<void>
  createRecord: (values: Record<string, unknown>) => Promise<string | null>
  updateRecord: (
    id: string,
    patch: { values?: Record<string, unknown>; status?: RegisterRecordStatus; reviewDueAt?: string | null; ownerUserId?: string | null; evidenceDocRefs?: string[] },
  ) => Promise<void>
  softDeleteRecord: (id: string) => Promise<void>
}

type DbRecordRow = {
  id: string
  organization_id: string
  register_type_id: string
  values: Record<string, unknown>
  status: string
  review_due_at: string | null
  owner_user_id: string | null
  evidence_doc_refs: string[] | null
  created_at: string
  updated_at: string
}

function mapRecord(row: DbRecordRow): RegisterRecord {
  const statusParse = RegisterRecordStatusSchema.safeParse(row.status)
  return {
    id: row.id,
    organizationId: row.organization_id,
    registerTypeId: row.register_type_id,
    values: row.values ?? {},
    status: statusParse.success ? statusParse.data : 'active',
    reviewDueAt: row.review_due_at,
    ownerUserId: row.owner_user_id,
    evidenceDocRefs: row.evidence_doc_refs ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useRegisterRecords(
  input: Input & { typeId: string | null },
): UseRegisterRecordsReturn {
  const { supabase, typeId } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [records, setRecords] = useState<RegisterRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedKey, setFetchedKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !typeId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('register_records')
        .select('*')
        .eq('organization_id', orgId)
        .eq('register_type_id', typeId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setRecords((data ?? []).map((r) => mapRecord(r as DbRecordRow)))
      setFetchedKey(`${orgId}:${typeId}`)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, typeId])

  useEffect(() => {
    const key = orgId && typeId ? `${orgId}:${typeId}` : null
    if (key && fetchedKey !== key) void refresh()
  }, [orgId, typeId, fetchedKey, refresh])

  const createRecord: UseRegisterRecordsReturn['createRecord'] = useCallback(
    async (values) => {
      if (!supabase || !orgId || !typeId) return null
      const { data, error: e } = await supabase
        .from('register_records')
        .insert({
          organization_id: orgId,
          register_type_id: typeId,
          values,
          status: 'active',
        })
        .select('id')
        .single()
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return null
      }
      await refresh()
      return (data as { id: string }).id
    },
    [supabase, orgId, typeId, refresh],
  )

  const updateRecord: UseRegisterRecordsReturn['updateRecord'] = useCallback(
    async (id, patch) => {
      if (!supabase || !orgId) return
      const row: Record<string, unknown> = {}
      if (patch.values !== undefined) row.values = patch.values
      if (patch.status !== undefined) row.status = patch.status
      if (patch.reviewDueAt !== undefined) row.review_due_at = patch.reviewDueAt
      if (patch.ownerUserId !== undefined) row.owner_user_id = patch.ownerUserId
      if (patch.evidenceDocRefs !== undefined) row.evidence_doc_refs = patch.evidenceDocRefs
      const { error: e } = await supabase
        .from('register_records')
        .update(row)
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) setError(getSupabaseErrorMessage(e))
      else await refresh()
    },
    [supabase, orgId, refresh],
  )

  const softDeleteRecord: UseRegisterRecordsReturn['softDeleteRecord'] = useCallback(
    async (id) => {
      if (!supabase || !orgId) return
      const { error: e } = await supabase
        .from('register_records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) setError(getSupabaseErrorMessage(e))
      else await refresh()
    },
    [supabase, orgId, refresh],
  )

  return {
    loading,
    error,
    records,
    refresh,
    createRecord,
    updateRecord,
    softDeleteRecord,
  }
}
