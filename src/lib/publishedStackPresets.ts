import type { LayoutComposerPreset } from './platformLayoutComposerStorage'
import type { ComposerTemplateRow, StackTemplatePayload } from './platformComposerTemplatesApi'

/** Map published DB rows to composer presets (stack kind only — ignore grid rows in the same fetch). */
export function publishedStackRowsToPresets(rows: ComposerTemplateRow[]): LayoutComposerPreset[] {
  return rows
    .filter((r) => r.kind === 'stack')
    .map((row) => {
      const p = row.payload as StackTemplatePayload
      return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        visible: p.visible as Record<string, boolean>,
        order: p.order as string[],
      }
    })
}
