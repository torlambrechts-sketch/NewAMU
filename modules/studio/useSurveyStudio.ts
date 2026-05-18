// Central hook for the Klarert Studio survey editor.
//
// Supports three entry modes:
//   templateId='new'              → blank new template
//   templateId='new' + fromId     → copy/fork an existing template (system or org)
//   templateId=<uuid>             → edit an existing org template (read-only for system ones)
//
// Saves to survey_template_catalog.studio_blocks + derived body.questions
// (backward compat) with a 1.5 s debounce. System templates are read-only;
// the editor shows a copy-to-edit banner instead.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { freshId } from '../../src/lib/dashboards/freshId'
import {
  CatalogRowForListSchema,
  type CatalogTemplateQuestion,
  type SurveyTemplateCatalogRow,
} from '../survey/surveyTemplateCatalogTypes'
import {
  StudioBlockSchema,
  type StudioBlock,
  type StudioQuestionBlock,
  type StudioSaveStatus,
} from './types'
import { z } from 'zod'

const AUTOSAVE_DELAY_MS = 1500

// ─── Helpers ─────────────────────────────────────────────────────────────────

function blocksToQuestions(blocks: StudioBlock[]): CatalogTemplateQuestion[] {
  return blocks
    .filter((b): b is StudioQuestionBlock => b.kind === 'question')
    .map((b) => ({
      id: b.id,
      text: b.text,
      type: b.questionType,
      required: b.required,
      options: b.options,
      scale: b.scale,
      anchors: b.anchors,
      law_ref: b.law_ref,
      subscale: b.subscale,
    }))
}

function initBlocksFromRow(
  studioBlocks: unknown,
  bodyQuestions: CatalogTemplateQuestion[],
): StudioBlock[] {
  if (Array.isArray(studioBlocks) && studioBlocks.length > 0) {
    const parsed = z.array(StudioBlockSchema).safeParse(studioBlocks)
    if (parsed.success) return parsed.data
  }
  // Fall back: convert existing body.questions to question blocks
  return bodyQuestions.map((q) => ({
    id: q.id,
    kind: 'question' as const,
    questionType: q.type,
    text: q.text,
    required: q.required,
    options: q.options,
    scale: q.scale,
    anchors: q.anchors,
    law_ref: q.law_ref,
    subscale: q.subscale,
  }))
}

function rowToMeta(row: SurveyTemplateCatalogRow) {
  return {
    name: row.name,
    description: row.description ?? '',
    category: row.category,
    audience: row.audience,
    estimatedMinutes: row.estimated_minutes,
    pack: row.pack,
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type SurveyStudioHook = ReturnType<typeof useSurveyStudio>

export function useSurveyStudio(templateId: string, fromTemplateId?: string) {
  const { supabase, organization } = useOrgSetupContext()

  const [blocks, setBlocks] = useState<StudioBlock[]>([])
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState('custom')
  const [templateAudience, setTemplateAudience] = useState<'internal' | 'external' | 'both'>('internal')
  const [templatePack, setTemplatePack] = useState<SurveyTemplateCatalogRow['pack']>('engagement')
  const [isSystemTemplate, setIsSystemTemplate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<StudioSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [rowId, setRowId] = useState<string | null>(templateId === 'new' ? null : templateId)

  const rowIdRef = useRef<string | null>(templateId === 'new' ? null : templateId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blocksRef = useRef<StudioBlock[]>(blocks)
  const metaRef = useRef({
    name: templateName,
    description: templateDescription,
    category: templateCategory,
    audience: templateAudience,
    pack: templatePack,
  })

  // ─── Load ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !organization?.id) return

    // New blank template
    if (templateId === 'new' && !fromTemplateId) {
      setBlocks([])
      setLoading(false)
      return
    }

    const idToLoad = templateId === 'new' ? fromTemplateId! : templateId
    setLoading(true)

    // Query by ID only — RLS handles access for both system and org templates
    void supabase
      .from('survey_template_catalog')
      .select('*')
      .eq('id', idToLoad)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadError(error?.message ?? 'Fant ikke malen.')
          setLoading(false)
          return
        }
        const parsed = CatalogRowForListSchema.safeParse(data)
        if (!parsed.success) {
          setLoadError('Ugyldig maldata.')
          setLoading(false)
          return
        }
        const row = parsed.data
        const isSys = row.is_system && row.organization_id == null

        // When copying: pre-fill from source but don't write to it
        const meta = rowToMeta(row)
        setTemplateName(templateId === 'new' ? `${row.name} (kopi)` : row.name)
        setTemplateDescription(meta.description)
        setTemplateCategory(meta.category)
        setTemplateAudience(meta.audience)
        setTemplatePack(meta.pack)
        setIsSystemTemplate(isSys && templateId !== 'new')

        const rawStudio = (data as Record<string, unknown>).studio_blocks
        setBlocks(initBlocksFromRow(rawStudio, row.body.questions))

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
      category: templateCategory,
      audience: templateAudience,
      pack: templatePack,
    }
  }, [templateName, templateDescription, templateCategory, templateAudience, templatePack])

  // Clear pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ─── Save ─────────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (publishNow = false) => {
      if (!supabase || !organization?.id) return
      if (isSystemTemplate) return // read-only
      setSaveStatus('saving')
      const currentBlocks = blocksRef.current
      const { name, description, category, audience, pack } = metaRef.current
      const questions = blocksToQuestions(currentBlocks)

      const payload = {
        organization_id: organization.id,
        is_system: false,
        name: name.trim() || 'Ny mal',
        short_name: null,
        description: description || null,
        source: 'Organisasjon',
        use_case: 'Egen mal',
        category,
        audience,
        estimated_minutes: 5,
        recommend_anonymous: true,
        scoring_note: null,
        law_ref: null,
        pack,
        body: { version: 1, questions },
        studio_blocks: currentBlocks,
        is_active: publishNow ? true : rowIdRef.current ? undefined : false,
      }

      try {
        if (!rowIdRef.current) {
          // INSERT new org template
          const { data, error } = await supabase
            .from('survey_template_catalog')
            .insert({ ...payload, id: freshId('tpl'), is_active: publishNow })
            .select('id')
            .single()
          if (error) throw error
          rowIdRef.current = data.id
          setRowId(data.id)
        } else {
          const updatePayload: Record<string, unknown> = {
            name: payload.name,
            description: payload.description,
            category: payload.category,
            audience: payload.audience,
            body: payload.body,
            studio_blocks: payload.studio_blocks,
            updated_at: new Date().toISOString(),
          }
          if (publishNow) updatePayload.is_active = true
          const { error } = await supabase
            .from('survey_template_catalog')
            .update(updatePayload)
            .eq('id', rowIdRef.current)
            .eq('organization_id', organization.id)
          if (error) throw error
        }
        setSaveStatus('saved')
        setLastSavedAt(new Date())
      } catch {
        setSaveStatus('error')
      }
    },
    [supabase, organization?.id, isSystemTemplate],
  )

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void persist(false), AUTOSAVE_DELAY_MS)
    setSaveStatus('idle')
  }, [persist])

  const publishTemplate = useCallback(async () => {
    await persist(true)
  }, [persist])

  // ─── Block mutations ──────────────────────────────────────────────────────

  const addBlock = useCallback(
    (block: Omit<StudioBlock, 'id'>, atIndex?: number) => {
      const newBlock = { ...block, id: freshId('blk') } as StudioBlock
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
    (id: string, patch: Partial<StudioBlock>) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? ({ ...b, ...patch } as StudioBlock) : b)),
      )
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateName = useCallback(
    (name: string) => {
      setTemplateName(name)
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateDescription = useCallback(
    (description: string) => {
      setTemplateDescription(description)
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateCategory = useCallback(
    (category: string) => {
      setTemplateCategory(category)
      scheduleSave()
    },
    [scheduleSave],
  )

  return {
    blocks,
    templateName,
    templateDescription,
    templateCategory,
    templateAudience,
    templatePack,
    isSystemTemplate,
    loading,
    loadError,
    saveStatus,
    lastSavedAt,
    rowId,
    addBlock,
    removeBlock,
    moveBlock,
    updateBlock,
    updateName,
    updateDescription,
    updateCategory,
    publishTemplate,
  }
}
