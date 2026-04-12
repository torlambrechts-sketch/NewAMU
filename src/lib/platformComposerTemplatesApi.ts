import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseErrorMessage } from './supabaseError'
import type { LayoutComposerPreset } from './platformLayoutComposerStorage'
import type { GridRowPersist, SavedGridLayout } from './layoutGridComposerStorage'

export type ComposerTemplateKind = 'stack' | 'grid'

export type ComposerTemplateRow = {
  id: string
  user_id: string
  name: string
  kind: ComposerTemplateKind
  payload: Record<string, unknown>
  published: boolean
  created_at: string
  updated_at: string
}

const TABLE = 'platform_composer_templates'

export async function fetchMyComposerTemplates(
  supabase: SupabaseClient,
): Promise<{ data: ComposerTemplateRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id,user_id,name,kind,payload,published,created_at,updated_at')
      .order('updated_at', { ascending: false })
    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as ComposerTemplateRow[], error: null }
  } catch (e) {
    return { data: [], error: getSupabaseErrorMessage(e) }
  }
}

export async function fetchPublishedComposerTemplates(
  supabase: SupabaseClient,
): Promise<{ data: ComposerTemplateRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id,user_id,name,kind,payload,published,created_at,updated_at')
      .eq('published', true)
      .order('updated_at', { ascending: false })
    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as ComposerTemplateRow[], error: null }
  } catch (e) {
    return { data: [], error: getSupabaseErrorMessage(e) }
  }
}

export async function upsertComposerTemplate(
  supabase: SupabaseClient,
  userId: string,
  input: {
    id?: string
    name: string
    kind: ComposerTemplateKind
    payload: Record<string, unknown>
    published?: boolean
  },
): Promise<{ id: string | null; error: string | null }> {
  const name = input.name.trim()
  if (!name) return { id: null, error: 'Navn mangler' }
  try {
    if (input.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update({
          name,
          kind: input.kind,
          payload: input.payload,
          published: input.published ?? false,
        })
        .eq('id', input.id)
        .eq('user_id', userId)
        .select('id')
        .single()
      if (error) return { id: null, error: error.message }
      return { id: (data as { id: string })?.id ?? null, error: null }
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: userId,
        name,
        kind: input.kind,
        payload: input.payload,
        published: input.published ?? false,
      })
      .select('id')
      .single()
    if (error) return { id: null, error: error.message }
    return { id: (data as { id: string })?.id ?? null, error: null }
  } catch (e) {
    return { id: null, error: getSupabaseErrorMessage(e) }
  }
}

export async function deleteComposerTemplate(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', userId)
    if (error) return { error: error.message }
    return { error: null }
  } catch (e) {
    return { error: getSupabaseErrorMessage(e) }
  }
}

/** Payload shape for kind=stack — matches LayoutComposerPreset without id/createdAt */
export type StackTemplatePayload = {
  visible: Record<string, boolean>
  order: string[]
}

/** Payload shape for kind=grid */
export type GridTemplatePayload = {
  rows: GridRowPersist[]
}

export function stackPayloadFromPreset(p: LayoutComposerPreset): StackTemplatePayload {
  return { visible: { ...p.visible }, order: [...p.order] }
}

export function presetFromStackPayload(name: string, id: string, payload: StackTemplatePayload): LayoutComposerPreset {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    visible: { ...payload.visible },
    order: [...payload.order],
  }
}

export function gridPayloadFromSaved(layout: SavedGridLayout): GridTemplatePayload {
  return { rows: layout.rows.map((r) => ({ id: r.id, columns: r.columns.map((c) => ({ ...c })) })) }
}
