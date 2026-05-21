import { Node, mergeAttributes } from '@tiptap/core'

/**
 * TipTap node for a non-prose wiki block (module / alert / law-ref / table /
 * image) shown inside the document editor as a non-editable placeholder.
 *
 * The document editor edits headings + prose as native TipTap content; blocks
 * that can't round-trip through TipTap's schema are serialised as
 * `<div data-wiki-block="N">` and parsed back here, so they survive editing
 * with their original content intact (keyed by index into the page blocks).
 */
export const WikiPreservedBlock = Node.create({
  name: 'wikiPreservedBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      index: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-wiki-block')) || 0,
        renderHTML: (attrs) => ({ 'data-wiki-block': String(attrs.index) }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-wiki-label') || el.textContent || '',
        renderHTML: (attrs) => ({ 'data-wiki-label': String(attrs.label ?? '') }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-wiki-block]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        contenteditable: 'false',
        class: 'wiki-preserved-block',
      }),
      `⛭ ${String(node.attrs.label ?? 'Blokk')}`,
    ]
  },
})
