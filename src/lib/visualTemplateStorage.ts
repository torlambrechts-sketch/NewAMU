import type { VisualTemplate, VisualTemplatePack } from '../types/visualTemplate'
import { VISUAL_TEMPLATE_PACK_VERSION } from '../types/visualTemplate'

const KEY_PREFIX = 'klarert_visual_templates_v1'

function key(userId: string, source: 'pinpoint' | 'advanced'): string {
  return `${KEY_PREFIX}:${source}:${userId}`
}

function emptyPack(): VisualTemplatePack {
  return { version: VISUAL_TEMPLATE_PACK_VERSION, templates: [], activeTemplateId: null }
}

export function readVisualTemplatePack(userId: string, source: 'pinpoint' | 'advanced'): VisualTemplatePack {
  try {
    const raw = localStorage.getItem(key(userId, source))
    if (!raw) return emptyPack()
    const p = JSON.parse(raw) as Partial<VisualTemplatePack>
    if (!p || p.version !== VISUAL_TEMPLATE_PACK_VERSION || !Array.isArray(p.templates)) return emptyPack()
    return {
      version: VISUAL_TEMPLATE_PACK_VERSION,
      templates: p.templates as VisualTemplate[],
      activeTemplateId: typeof p.activeTemplateId === 'string' || p.activeTemplateId === null ? p.activeTemplateId : null,
    }
  } catch {
    return emptyPack()
  }
}

export function writeVisualTemplatePack(userId: string, source: 'pinpoint' | 'advanced', pack: VisualTemplatePack): void {
  try {
    localStorage.setItem(key(userId, source), JSON.stringify(pack))
  } catch {
    /* ignore */
  }
}

export function upsertTemplate(userId: string, source: 'pinpoint' | 'advanced', template: VisualTemplate): VisualTemplatePack {
  const pack = readVisualTemplatePack(userId, source)
  const idx = pack.templates.findIndex((t) => t.id === template.id)
  const next = [...pack.templates]
  if (idx >= 0) next[idx] = template
  else next.push(template)
  const out: VisualTemplatePack = {
    ...pack,
    templates: next,
    activeTemplateId: template.id,
  }
  writeVisualTemplatePack(userId, source, out)
  return out
}

export function deleteTemplate(userId: string, source: 'pinpoint' | 'advanced', id: string): VisualTemplatePack {
  const pack = readVisualTemplatePack(userId, source)
  const templates = pack.templates.filter((t) => t.id !== id)
  const activeTemplateId =
    pack.activeTemplateId === id ? (templates[0]?.id ?? null) : pack.activeTemplateId
  const out: VisualTemplatePack = { ...pack, templates, activeTemplateId }
  writeVisualTemplatePack(userId, source, out)
  return out
}

export function setActiveTemplate(userId: string, source: 'pinpoint' | 'advanced', id: string | null): VisualTemplatePack {
  const pack = readVisualTemplatePack(userId, source)
  const out = { ...pack, activeTemplateId: id }
  writeVisualTemplatePack(userId, source, out)
  return out
}
