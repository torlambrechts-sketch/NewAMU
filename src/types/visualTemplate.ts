/** Editable visual mockup tree for layout-reference / advanced UI builders. */

export type VisualBlockType =
  | 'container'
  | 'text'
  | 'heading'
  | 'button'
  | 'link'
  | 'input'
  | 'image'
  | 'divider'
  | 'row'
  | 'column'
  | 'grid'

export type VisualBlock = {
  id: string
  type: VisualBlockType
  /** Content for text/heading/button/link */
  text?: string
  href?: string
  src?: string
  alt?: string
  placeholder?: string
  inputType?: 'text' | 'search' | 'email'
  headingLevel?: 1 | 2 | 3 | 4
  /** Optional Tailwind classes merged with defaults */
  className?: string
  /** Inline styles (serializable) */
  style?: Record<string, string | number | undefined>
  gridTemplateColumns?: string
  gridGap?: string
  flexGap?: string
  flexDirection?: 'row' | 'column'
  flexWrap?: boolean
  alignItems?: string
  justifyContent?: string
  children?: VisualBlock[]
}

export type VisualTemplateSource = 'pinpoint' | 'advanced'

export type VisualTemplate = {
  id: string
  name: string
  source: VisualTemplateSource
  /** Which built-in example this was seeded from, if any */
  presetKey?: string
  root: VisualBlock
  createdAt: string
  updatedAt: string
}

export type VisualTemplatePack = {
  version: 1
  templates: VisualTemplate[]
  activeTemplateId: string | null
}

export const VISUAL_TEMPLATE_PACK_VERSION = 1 as const

export function newBlockId(): string {
  return `vb-${crypto.randomUUID().slice(0, 10)}`
}

export function emptyRootBlock(): VisualBlock {
  return {
    id: newBlockId(),
    type: 'column',
    flexGap: '16px',
    style: { minHeight: '200px' },
    children: [],
  }
}

export function cloneBlock(b: VisualBlock): VisualBlock {
  return {
    ...b,
    id: newBlockId(),
    style: b.style ? { ...b.style } : undefined,
    children: b.children?.map(cloneBlock),
  }
}

export function cloneTemplate(t: VisualTemplate, name?: string): VisualTemplate {
  const now = new Date().toISOString()
  return {
    ...t,
    id: crypto.randomUUID(),
    name: name ?? `${t.name} (kopi)`,
    root: cloneBlock(t.root),
    presetKey: undefined,
    createdAt: now,
    updatedAt: now,
  }
}
