// Central hook for the Klarert Studio survey editor.
//
// Loads a survey_template_catalog row, manages the in-memory StudioBlock[]
// state, and debounce-saves changes back to the DB (studio_blocks column +
// derived body.questions for backward compat with existing consumers).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { freshId } from '../../src/lib/dashboards/freshId'
import {
  CatalogRowForListSchema,
  type CatalogTemplateQuestion,
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type SurveyStudioHook = ReturnType<typeof useSurveyStudio>

export function useSurveyStudio(templateId: string) {
  const { supabase, organization } = useOrgSetupContext()

  const [blocks, setBlocks] = useState<StudioBlock[]>([])
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<StudioSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // Tracks the current DB row id (may differ from templateId when templateId==='new')
  const [rowId, setRowId] = useState<string | null>(templateId === 'new' ? null : templateId)
  const rowIdRef = useRef<string | null>(templateId === 'new' ? null : templateId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Holds latest blocks so the debounced save always sees the newest state
  const blocksRef = useRef<StudioBlock[]>(blocks)
  const metaRef = useRef({ name: templateName, description: templateDescription })

  // ─── Load ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !organization?.id) return

    if (templateId === 'new') {
      setBlocks([])
      setTemplateName('')
      setTemplateDescription('')
      setLoading(false)
      return
    }

    setLoading(true)
    void supabase
      .from('survey_template_catalog')
      .select('*')
      .eq('id', templateId)
      .eq('organization_id', organization.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadError(error?.message ?? 'Fant ikke malen.')
          setLoading(false)
          return
        }
        const parsed = CatalogRowForListSchema.safeParse(data)
        const bodyQuestions = parsed.success ? parsed.data.body.questions : []
        setBlocks(initBlocksFromRow((data as Record<string, unknown>).studio_blocks, bodyQuestions))
        setTemplateName(data.name ?? '')
        setTemplateDescription(data.description ?? '')
        rowIdRef.current = data.id
        setRowId(data.id)
        setLoading(false)
      })
  }, [supabase, organization?.id, templateId])

  // ─── Sync refs ───────────────────────────────────────────────────────────

  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  useEffect(() => {
    metaRef.current = { name: templateName, description: templateDescription }
  }, [templateName, templateDescription])

  // Clear pending debounce on unmount to avoid saving to an unmounted component
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ─── Save ─────────────────────────────────────────────────────────────────

  const persist = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setSaveStatus('saving')
    const currentBlocks = blocksRef.current
    const { name, description } = metaRef.current
    const questions = blocksToQuestions(currentBlocks)

    try {
      if (!rowIdRef.current) {
        // Create new row
        const { data, error } = await supabase
          .from('survey_template_catalog')
          .insert({
            organization_id: organization.id,
            is_system: false,
            name: name || 'Ny mal',
            description,
            category: 'custom',
            audience: 'internal',
            estimated_minutes: 5,
            recommend_anonymous: true,
            pack: 'engagement',
            body: { version: 1, questions },
            studio_blocks: currentBlocks,
            is_active: false,
          })
          .select('id')
          .single()
        if (error) throw error
        rowIdRef.current = data.id
        setRowId(data.id)
      } else {
        const { error } = await supabase
          .from('survey_template_catalog')
          .update({
            name: name || 'Ny mal',
            description,
            body: { version: 1, questions },
            studio_blocks: currentBlocks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rowIdRef.current)
          .eq('organization_id', organization.id)
        if (error) throw error
      }
      setSaveStatus('saved')
      setLastSavedAt(new Date())
    } catch {
      setSaveStatus('error')
    }
  }, [supabase, organization?.id])

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS)
    setSaveStatus('idle')
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

  return {
    blocks,
    templateName,
    templateDescription,
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
  }
}
