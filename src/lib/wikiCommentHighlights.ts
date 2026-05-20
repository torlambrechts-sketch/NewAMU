/**
 * Inline comment highlights for the document viewer (Claude Design "Rec05").
 *
 * Wraps each anchored comment's quoted text in a `<mark>` carrying the
 * comment id + a numbered badge, so the reader shows the same colour-coded
 * markers as the thread rail. Matching is done on plain text via a DOM
 * walk, so it never corrupts the surrounding markup.
 */

/** Highlight palette — shared by the in-document markers and the thread rail. */
export const THREAD_COLORS = ['#fde68a', '#dbeafe', '#fecaca', '#ddd6fe', '#bbf7d0', '#fed7aa']

export interface CommentAnchorHighlight {
  commentId: string
  quotedText: string
  /** 1-based marker number shown in the badge and the rail. */
  index: number
  /** Highlight background colour. */
  color: string
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Returns `html` with each anchor's quoted text wrapped in a marker `<mark>`.
 * Anchors whose quote can't be located in a single text node are skipped
 * (the thread still shows in the rail). Browser-only — needs `DOMParser`.
 */
export function injectCommentHighlights(html: string, anchors: CommentAnchorHighlight[]): string {
  if (anchors.length === 0 || typeof window === 'undefined' || !('DOMParser' in window)) {
    return html
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')

  for (const anchor of anchors) {
    const needle = anchor.quotedText.trim()
    if (needle.length < 2) continue

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    let hit: Text | null = null
    let at = -1
    let node = walker.nextNode() as Text | null
    while (node) {
      // Skip text already inside a comment mark.
      if (node.parentElement?.closest('mark[data-comment-id]')) {
        node = walker.nextNode() as Text | null
        continue
      }
      const idx = node.textContent ? node.textContent.indexOf(needle) : -1
      if (idx >= 0) {
        hit = node
        at = idx
        break
      }
      node = walker.nextNode() as Text | null
    }
    if (!hit || at < 0) continue

    const text = hit.textContent ?? ''
    const before = text.slice(0, at)
    const match = text.slice(at, at + needle.length)
    const after = text.slice(at + needle.length)

    const mark = doc.createElement('mark')
    mark.setAttribute('data-comment-id', anchor.commentId)
    mark.className = 'wiki-cm-hl'
    mark.setAttribute('style', `background:${anchor.color};border-radius:2px;padding:0 1px;cursor:pointer`)
    mark.innerHTML = `${escapeHtml(match)}<sup class="wiki-cm-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:15px;height:15px;margin-left:2px;border-radius:9999px;background:#0f766e;color:#fff;font-size:9px;font-weight:700;vertical-align:text-bottom">${anchor.index}</sup>`

    const frag = doc.createDocumentFragment()
    if (before) frag.appendChild(doc.createTextNode(before))
    frag.appendChild(mark)
    if (after) frag.appendChild(doc.createTextNode(after))
    hit.parentNode?.replaceChild(frag, hit)
  }

  return doc.body.innerHTML
}
