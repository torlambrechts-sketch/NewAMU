import type { ContentBlock, HeadingBlock } from '../types/documents'

/**
 * Block ⇄ editor-HTML serialiser for the Rec03 document editor.
 *
 * The editor edits `heading`, `text` and `divider` blocks as native TipTap
 * content. Blocks that can't round-trip through TipTap's schema (`alert`,
 * `law_ref`, `table`, `image`, `module`) are emitted as a placeholder
 * `<div data-wiki-block="N">` keyed by their index, and restored verbatim
 * from the original block list on the way back — so a multi-block document
 * (e.g. one created from a template) is fully editable without data loss.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Human label for a preserved (non-prose) block, shown on its placeholder. */
export function preservedBlockLabel(block: ContentBlock): string {
  switch (block.kind) {
    case 'alert':
      return `Varsel — ${(block.text ?? '').slice(0, 60)}`
    case 'law_ref':
      return `Lovhenvisning — ${block.ref}`
    case 'table':
      return block.caption?.trim() || 'Tabell'
    case 'image':
      return block.caption?.trim() || 'Bilde'
    case 'module':
      return `Modul — ${block.moduleName}`
    default:
      return 'Blokk'
  }
}

/** Serialises page blocks into one HTML string for the TipTap editor. */
export function blocksToEditorHtml(blocks: ContentBlock[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '<p></p>'
  const parts = blocks.map((block, i) => {
    if (block.kind === 'heading') {
      const level = block.level === 1 || block.level === 2 || block.level === 3 ? block.level : 2
      return `<h${level}>${esc(block.text ?? '')}</h${level}>`
    }
    if (block.kind === 'text') {
      return typeof block.body === 'string' && block.body.trim() ? block.body : ''
    }
    if (block.kind === 'divider') return '<hr>'
    const label = preservedBlockLabel(block)
    return `<div data-wiki-block="${i}" data-wiki-label="${esc(label)}">${esc(label)}</div>`
  })
  const html = parts.filter(Boolean).join('')
  return html || '<p></p>'
}

/**
 * Parses edited HTML back into page blocks. `original` is the block list the
 * HTML was serialised from — preserved placeholders are restored from it by
 * index, so module / alert / law-ref / table / image blocks survive intact.
 */
export function editorHtmlToBlocks(html: string, original: ContentBlock[]): ContentBlock[] {
  if (typeof window === 'undefined' || !('DOMParser' in window)) {
    return original
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: ContentBlock[] = []
  let buffer = ''
  const flush = () => {
    if (buffer.trim()) out.push({ kind: 'text', body: buffer })
    buffer = ''
  }

  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      flush()
      const heading: HeadingBlock = {
        kind: 'heading',
        level: Number(tag[1]) as 1 | 2 | 3,
        text: el.textContent ?? '',
      }
      out.push(heading)
    } else if (tag === 'hr') {
      flush()
      out.push({ kind: 'divider' })
    } else if (tag === 'div' && el.hasAttribute('data-wiki-block')) {
      flush()
      const idx = Number(el.getAttribute('data-wiki-block'))
      if (Number.isInteger(idx) && idx >= 0 && original[idx]) out.push(original[idx])
    } else {
      buffer += el.outerHTML
    }
  }
  flush()
  return out.length > 0 ? out : [{ kind: 'text', body: '<p></p>' }]
}
