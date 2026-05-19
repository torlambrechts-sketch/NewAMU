// Central hook for the Studio register-type (catalogue) editor.
//
// Entry modes:
//   typeId='new'          → blank new register type
//   typeId='new' + fromId → copy/fork an existing org type
//   typeId=<id>           → edit an existing org-owned type
//
// System types (is_system=true, organization_id IS NULL) are read-only.
//
// Saves to register_types.metadata_schema (fields array) with a 1.5 s debounce.
// On first save it also inserts a register_org_settings row (enabled=true).

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { freshId } from '../../../src/lib/dashboards/freshId'
import {
  RegisterFieldBlockSchema,
  type RegisterFieldBlock,
  type NewRegisterFieldBlock,
} from './registerFieldBlocks'

const AUTOSAVE_DELAY_MS = 1500

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FieldRow = {
  key: string
  label: string
  kind: string
  required?: boolean
  hint?: string
  options?: { value: string; label: string }[]
}

function blocksToFields(blocks: RegisterFieldBlock[]): FieldRow[] {
  return blocks.map((b) => {
    const row: FieldRow = {
      key: b.key,
      label: b.label,
      kind: b.fieldKind,
      required: b.required,
    }
    if (b.hint) row.hint = b.hint
    if (b.options && b.options.length > 0) row.options = b.options
    return row
  })
}

function initBlocksFromFields(rawFields: unknown[]): RegisterFieldBlock[] {
  const FieldArraySchema = z.array(
    z.object({
      key: z.string(),
      label: z.string().default(''),
      kind: z.string(),
      required: z.boolean().optional(),
      hint: z.string().optional(),
      options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    }),
  )
  const parsed = FieldArraySchema.safeParse(rawFields)
  if (!parsed.success) return []
  return parsed.data.map((f) => {
    const block: RegisterFieldBlock = {
      id: freshId('fld'),
      kind: 'register_field',
      key: f.key,
      label: f.label ?? '',
      fieldKind: f.kind as RegisterFieldBlock['fieldKind'],
      required: f.required ?? false,
      hint: f.hint,
      options: f.options,
    }
    // Validate and drop malformed blocks
    const v = RegisterFieldBlockSchema.safeParse(block)
    return v.success ? v.data : null
  }).filter((b): b is RegisterFieldBlock => b !== null)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type RegisterTypeStudioHook = ReturnType<typeof useRegisterTypeStudio>

export function useRegisterTypeStudio(typeId: string, fromTypeId?: string) {
  const { supabase, organization } = useOrgSetupContext()

  const [blocks, setBlocks] = useState<RegisterFieldBlock[]>([])
  const [typeName, setTypeName] = useState('')
  const [typeDescription, setTypeDescription] = useState('')
  const [typeNavPinned, setTypeNavPinned] = useState(true)
  const [isSystemType, setIsSystemType] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [rowId, setRowId] = useState<string | null>(typeId === 'new' ? null : typeId)

  const rowIdRef = useRef<string | null>(typeId === 'new' ? null : typeId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const blocksRef = useRef<RegisterFieldBlock[]>(blocks)
  const metaRef = useRef({ name: typeName, description: typeDescription, navPinned: typeNavPinned })

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !organization?.id) return

    if (typeId === 'new' && !fromTypeId) {
      setBlocks([])
      setLoading(false)
      return
    }

    const idToLoad = typeId === 'new' ? fromTypeId! : typeId
    setLoading(true)

    // Load type + org settings in parallel so nav_pinned is read correctly.
    void Promise.all([
      supabase
        .from('register_types')
        .select('*')
        .eq('id', idToLoad)
        .maybeSingle(),
      typeId !== 'new'
        ? supabase
            .from('register_org_settings')
            .select('nav_pinned')
            .eq('organization_id', organization.id)
            .eq('register_type_id', idToLoad)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]).then(([typeRes, settingsRes]) => {
      if (typeRes.error || !typeRes.data) {
        setLoadError(typeRes.error?.message ?? 'Fant ikke registertypen.')
        setLoading(false)
        return
      }

      const row = typeRes.data as {
        id: string
        organization_id: string | null
        name: string
        description: string | null
        metadata_schema: unknown
        is_active: boolean
        is_system: boolean
      }
      const isSys = row.is_system && row.organization_id == null

      setTypeName(typeId === 'new' ? `${row.name} (kopi)` : row.name)
      setTypeDescription(row.description ?? '')
      // For a fork/copy, start pinned. For editing, use saved setting (default true if no settings row).
      const savedNavPinned =
        typeId !== 'new'
          ? ((settingsRes.data as { nav_pinned?: boolean } | null)?.nav_pinned ?? true)
          : true
      setTypeNavPinned(savedNavPinned)
      setIsSystemType(isSys && typeId !== 'new')

      const rawFields: unknown[] =
        row.metadata_schema != null &&
        typeof row.metadata_schema === 'object' &&
        'fields' in (row.metadata_schema as object)
          ? ((row.metadata_schema as { fields: unknown[] }).fields ?? [])
          : []

      setBlocks(initBlocksFromFields(rawFields))

      if (typeId !== 'new') {
        rowIdRef.current = row.id
        setRowId(row.id)
      }
      setLoading(false)
    })
  }, [supabase, organization?.id, typeId, fromTypeId])

  // ─── Sync refs ────────────────────────────────────────────────────────────

  useEffect(() => { blocksRef.current = blocks }, [blocks])
  useEffect(() => {
    metaRef.current = { name: typeName, description: typeDescription, navPinned: typeNavPinned }
  }, [typeName, typeDescription, typeNavPinned])
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // ─── Save ─────────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (publishNow = false) => {
      if (!supabase) return
      if (!organization?.id) {
        setSaveError('Organisasjonsdata mangler – prøv igjen.')
        setSaveStatus('error')
        return
      }
      if (isSystemType) return
      if (savingRef.current) return
      savingRef.current = true
      setSaveStatus('saving')
      setSaveError(null)

      const currentBlocks = blocksRef.current
      const { name, description, navPinned } = metaRef.current
      const fields = blocksToFields(currentBlocks)

      try {
        if (!rowIdRef.current) {
          // Slug derived from a fresh id; id = org-<prefix>-<slug> to match useRegisters convention.
          const slug = freshId('rgt')
          const newId = `org-${organization.id.slice(0, 8)}-${slug}`
          const { error } = await supabase
            .from('register_types')
            .insert({
              id: newId,
              organization_id: organization.id,
              name: name.trim() || 'Ny registertype',
              description: description || null,
              metadata_schema: { fields },
              regulation_ids: [],
              pack_slugs: [],
              is_active: publishNow,
              is_system: false,
            })
          if (error) throw error

          // Auto-enable for org (mirrors createOrgType in useRegisters)
          await supabase.from('register_org_settings').insert({
            organization_id: organization.id,
            register_type_id: newId,
            enabled: true,
            nav_pinned: navPinned,
          })

          rowIdRef.current = newId
          setRowId(newId)
        } else {
          const updatePayload: Record<string, unknown> = {
            name: name.trim() || 'Ny registertype',
            description: description || null,
            metadata_schema: { fields },
            updated_at: new Date().toISOString(),
          }
          if (publishNow) updatePayload.is_active = true
          const { error } = await supabase
            .from('register_types')
            .update(updatePayload)
            .eq('id', rowIdRef.current)
            .eq('organization_id', organization.id)
          if (error) throw error

          // Keep nav_pinned in sync via settings upsert
          await supabase
            .from('register_org_settings')
            .upsert(
              {
                organization_id: organization.id,
                register_type_id: rowIdRef.current,
                enabled: true,
                nav_pinned: navPinned,
              },
              { onConflict: 'organization_id,register_type_id' },
            )
        }

        setSaveStatus('saved')
        setLastSavedAt(new Date())
      } catch (err) {
        console.error('[useRegisterTypeStudio] persist failed', err)
        const msg = err instanceof Error ? err.message : 'Ukjent feil ved lagring'
        setSaveStatus('error')
        setSaveError(msg)
      } finally {
        savingRef.current = false
      }
    },
    [supabase, organization?.id, isSystemType],
  )

  const scheduleSave = useCallback(() => {
    if (savingRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void persist(false), AUTOSAVE_DELAY_MS)
    setSaveStatus('idle')
  }, [persist])

  const publishType = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await persist(true)
  }, [persist])

  // ─── Block mutations ───────────────────────────────────────────────────────

  const addBlock = useCallback(
    (block: NewRegisterFieldBlock, atIndex?: number) => {
      const newBlock: RegisterFieldBlock = { ...block, id: freshId('fld') }
      setBlocks((prev) => {
        const next = [...prev]
        if (atIndex !== undefined) next.splice(atIndex, 0, newBlock)
        else next.push(newBlock)
        return next
      })
      scheduleSave()
      return newBlock.id
    },
    [scheduleSave],
  )

  const removeBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== id))
      scheduleSave()
    },
    [scheduleSave],
  )

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      setBlocks((prev) => {
        const next = [...prev]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateBlock = useCallback(
    (id: string, patch: Partial<RegisterFieldBlock>) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b
          const merged = { ...b, ...patch, id: b.id, kind: b.kind }
          const parsed = RegisterFieldBlockSchema.safeParse(merged)
          if (!parsed.success) {
            console.error('[useRegisterTypeStudio] updateBlock invalid patch', parsed.error)
            return b
          }
          return parsed.data
        }),
      )
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateName = useCallback(
    (name: string) => { setTypeName(name); scheduleSave() },
    [scheduleSave],
  )
  const updateDescription = useCallback(
    (description: string) => { setTypeDescription(description); scheduleSave() },
    [scheduleSave],
  )
  const updateNavPinned = useCallback(
    (pinned: boolean) => { setTypeNavPinned(pinned); scheduleSave() },
    [scheduleSave],
  )

  return {
    blocks,
    typeName,
    typeDescription,
    typeNavPinned,
    isSystemType,
    loading,
    loadError,
    saveStatus,
    saveError,
    lastSavedAt,
    rowId,
    addBlock,
    removeBlock,
    moveBlock,
    updateBlock,
    updateName,
    updateDescription,
    updateNavPinned,
    publishType,
  }
}
