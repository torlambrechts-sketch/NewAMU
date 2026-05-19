// Central hook for the Klarert Studio checklist template editor.
//
// Supports three entry modes:
//   templateId='new'              → blank new template (org-owned)
//   templateId='new' + fromId     → copy/fork an existing template
//   templateId=<uuid>             → edit an existing org template
//
// System templates (is_system=true, organization_id IS NULL) are read-only;
// the editor shows a copy-to-edit banner.
//
// Saves to compliance_checklist_templates.studio_blocks (visual block tree)
// + derived definition.items (execution payload) with a 1.5 s debounce.

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { freshId } from '../../../src/lib/dashboards/freshId'
import type { CompliancePackSlug, ComplianceTemplateRow, ChecklistItem } from '../../compliance/types'
import {
  ChecklistStudioBlockSchema,
  type ChecklistStudioBlock,
  type ChecklistItemBlock,
  type NewChecklistStudioBlock,
} from './checklistBlocks'

const AUTOSAVE_DELAY_MS = 1500

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blocksToItems(blocks: ChecklistStudioBlock[]): ChecklistItem[] {
  return blocks
    .filter((b): b is ChecklistItemBlock => b.kind === 'checklist_item')
    .map((b) => ({
      key: b.key,
      prompt: b.prompt,
      type: b.itemType,
      required: b.required,
      law_ref: b.law_ref,
      iso_clause: b.iso_clause,
      severity_default: b.severity_default,
      help: b.help,
    }))
}

function initBlocksFromRow(
  studioBlocks: unknown,
  items: ChecklistItem[],
): ChecklistStudioBlock[] {
  if (Array.isArray(studioBlocks) && studioBlocks.length > 0) {
    const parsed = z.array(ChecklistStudioBlockSchema).safeParse(studioBlocks)
    if (parsed.success) return parsed.data
  }
  // Fall back: convert existing definition.items to checklist_item blocks
  return items.map((item) => ({
    id: freshId('blk'),
    kind: 'checklist_item' as const,
    key: item.key,
    prompt: item.prompt,
    itemType: item.type,
    required: item.required ?? true,
    law_ref: item.law_ref,
    iso_clause: item.iso_clause,
    severity_default: item.severity_default,
    help: item.help,
  }))
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type ChecklistStudioHook = ReturnType<typeof useChecklistStudio>

export function useChecklistStudio(templateId: string, fromTemplateId?: string) {
  const { supabase, organization } = useOrgSetupContext()

  const [blocks, setBlocks] = useState<ChecklistStudioBlock[]>([])
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templatePack, setTemplatePack] = useState<CompliancePackSlug>('aml-amu')
  const [templateCadenceHint, setTemplateCadenceHint] = useState('')
  const [isSystemTemplate, setIsSystemTemplate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [rowId, setRowId] = useState<string | null>(templateId === 'new' ? null : templateId)

  const rowIdRef = useRef<string | null>(templateId === 'new' ? null : templateId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const blocksRef = useRef<ChecklistStudioBlock[]>(blocks)
  const metaRef = useRef({
    name: templateName,
    description: templateDescription,
    pack: templatePack,
    cadenceHint: templateCadenceHint,
  })

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !organization?.id) return

    if (templateId === 'new' && !fromTemplateId) {
      setBlocks([])
      setLoading(false)
      return
    }

    const idToLoad = templateId === 'new' ? fromTemplateId! : templateId
    setLoading(true)

    void supabase
      .from('compliance_checklist_templates')
      .select('*')
      .eq('id', idToLoad)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadError(error?.message ?? 'Fant ikke malen.')
          setLoading(false)
          return
        }

        const row = data as ComplianceTemplateRow & { studio_blocks?: unknown }
        const isSys = row.is_system && row.organization_id == null

        setTemplateName(templateId === 'new' ? `${row.name} (kopi)` : row.name)
        setTemplateDescription(row.description ?? '')
        setTemplatePack(row.pack)
        setTemplateCadenceHint(row.cadence_hint ?? '')
        setIsSystemTemplate(isSys && templateId !== 'new')

        const rawItems: ChecklistItem[] =
          row.definition != null &&
          typeof row.definition === 'object' &&
          'items' in (row.definition as object)
            ? ((row.definition as { items: ChecklistItem[] }).items ?? [])
            : []

        setBlocks(initBlocksFromRow(row.studio_blocks, rawItems))

        if (templateId !== 'new') {
          rowIdRef.current = row.id
          setRowId(row.id)
        }
        setLoading(false)
      })
  }, [supabase, organization?.id, templateId, fromTemplateId])

  // ─── Sync refs ────────────────────────────────────────────────────────────

  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  useEffect(() => {
    metaRef.current = {
      name: templateName,
      description: templateDescription,
      pack: templatePack,
      cadenceHint: templateCadenceHint,
    }
  }, [templateName, templateDescription, templatePack, templateCadenceHint])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ─── Save ─────────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (publishNow = false) => {
      if (!supabase || !organization?.id) return
      if (isSystemTemplate) return
      if (savingRef.current) return
      savingRef.current = true
      setSaveStatus('saving')
      setSaveError(null)

      const currentBlocks = blocksRef.current
      const { name, description, pack, cadenceHint } = metaRef.current
      const items = blocksToItems(currentBlocks)

      try {
        if (!rowIdRef.current) {
          const { data, error } = await supabase
            .from('compliance_checklist_templates')
            .insert({
              id: freshId('ckl'),
              organization_id: organization.id,
              is_system: false,
              pack,
              slug: freshId('ckl'),
              name: name.trim() || 'Ny sjekkliste',
              description: description || null,
              definition: { items },
              studio_blocks: currentBlocks,
              is_active: publishNow,
              nav_pinned: false,
              review_status: 'draft',
              cadence_hint: cadenceHint || null,
              metadata_schema: { fields: [] },
            })
            .select('id')
            .single()
          if (error) throw error
          rowIdRef.current = data.id
          setRowId(data.id)
        } else {
          const updatePayload: Record<string, unknown> = {
            name: name.trim() || 'Ny sjekkliste',
            description: description || null,
            pack,
            cadence_hint: cadenceHint || null,
            definition: { items },
            studio_blocks: currentBlocks,
            updated_at: new Date().toISOString(),
          }
          if (publishNow) updatePayload.is_active = true
          const { error } = await supabase
            .from('compliance_checklist_templates')
            .update(updatePayload)
            .eq('id', rowIdRef.current)
            .eq('organization_id', organization.id)
          if (error) throw error
        }
        setSaveStatus('saved')
        setLastSavedAt(new Date())
      } catch (err) {
        console.error('[useChecklistStudio] persist failed', err)
        const msg = err instanceof Error ? err.message : 'Ukjent feil ved lagring'
        setSaveStatus('error')
        setSaveError(msg)
      } finally {
        savingRef.current = false
      }
    },
    [supabase, organization?.id, isSystemTemplate],
  )

  const scheduleSave = useCallback(() => {
    if (savingRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void persist(false), AUTOSAVE_DELAY_MS)
    setSaveStatus('idle')
  }, [persist])

  const publishTemplate = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await persist(true)
  }, [persist])

  // ─── Block mutations ───────────────────────────────────────────────────────

  const addBlock = useCallback(
    (block: NewChecklistStudioBlock, atIndex?: number) => {
      const newBlock = { ...block, id: freshId('blk') } as ChecklistStudioBlock
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
    (id: string, patch: Partial<ChecklistStudioBlock>) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === id
            ? ({ ...b, ...patch, id: b.id, kind: b.kind } as ChecklistStudioBlock)
            : b,
        ),
      )
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateName = useCallback(
    (name: string) => { setTemplateName(name); scheduleSave() },
    [scheduleSave],
  )
  const updateDescription = useCallback(
    (description: string) => { setTemplateDescription(description); scheduleSave() },
    [scheduleSave],
  )
  const updatePack = useCallback(
    (pack: CompliancePackSlug) => { setTemplatePack(pack); scheduleSave() },
    [scheduleSave],
  )
  const updateCadenceHint = useCallback(
    (hint: string) => { setTemplateCadenceHint(hint); scheduleSave() },
    [scheduleSave],
  )

  return {
    blocks,
    templateName,
    templateDescription,
    templatePack,
    templateCadenceHint,
    isSystemTemplate,
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
    updatePack,
    updateCadenceHint,
    publishTemplate,
  }
}
