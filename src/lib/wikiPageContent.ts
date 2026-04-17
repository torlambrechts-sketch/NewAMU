import type { Block } from '../types/documents'

const HTML_TAG_RE = /<[^>]+>/g

/** Strip HTML to plain text (single spaces). */
export function stripHtmlToText(html: string): string {
  if (!html) return ''
  const t = html.replace(HTML_TAG_RE, ' ').replace(/\s+/g, ' ').trim()
  return t
}

export function blockPlainText(block: Block): string {
  switch (block.kind) {
    case 'heading':
      return typeof block.text === 'string' ? block.text : ''
    case 'text':
      return stripHtmlToText(typeof block.body === 'string' ? block.body : '')
    case 'alert':
      return typeof block.text === 'string' ? block.text : ''
    case 'law_ref':
      return [block.ref, block.description].filter(Boolean).join(' — ')
    case 'divider':
      return '—'
    case 'image':
      return [block.caption, block.storagePath].filter(Boolean).join(' ')
    case 'module':
      return `module:${block.moduleName}`
    default:
      return ''
  }
}

/** Approximate word count from blocks (HTML stripped for text). */
export function countWordsFromBlocks(blocks: Block[]): number {
  let n = 0
  for (const b of blocks) {
    const t = blockPlainText(b)
    if (!t) continue
    n += t.split(/\s+/).filter(Boolean).length
  }
  return n
}

export function readingMinutesFromBlocks(blocks: Block[], wpm = 200): number {
  const w = countWordsFromBlocks(blocks)
  if (w <= 0) return blocks.length > 0 ? 1 : 0
  return Math.max(1, Math.ceil(w / wpm))
}

export type WikiTocItem = {
  id: string
  level: 1 | 2 | 3
  text: string
}

/** Stable DOM id for heading anchors (must match WikiBlockRenderer). */
export function wikiHeadingDomId(index: number, headingText: string): string {
  const slug =
    headingText
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9æøå\u00C0-\u024F\s-]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'overskrift'
  return `wiki-h-${index}-${slug}`
}

export function extractHeadingToc(blocks: Block[]): WikiTocItem[] {
  const out: WikiTocItem[] = []
  let hi = 0
  for (const b of blocks) {
    if (b.kind !== 'heading') continue
    const level = b.level === 1 || b.level === 2 || b.level === 3 ? b.level : 2
    const text = typeof b.text === 'string' ? b.text : ''
    const id = wikiHeadingDomId(hi, text)
    hi += 1
    out.push({ id, level, text })
  }
  return out
}

/** One-line summary per block for diff list */
export function blockSummaryLine(block: Block): string {
  const k = block.kind
  const t = blockPlainText(block).replace(/\n/g, ' ').slice(0, 200)
  return `[${k}] ${t}`
}

export type LineDiffOp = { type: 'same' | 'add' | 'remove'; text: string }

/** Myers-style line diff (O(nm)); fine for small wiki content. */
export function diffLines(aLines: string[], bLines: string[]): LineDiffOp[] {
  const a = aLines
  const b = bLines
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: LineDiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i]! })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'remove', text: a[i]! })
      i += 1
    } else {
      out.push({ type: 'add', text: b[j]! })
      j += 1
    }
  }
  while (i < n) {
    out.push({ type: 'remove', text: a[i]! })
    i += 1
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j]! })
    j += 1
  }
  return out
}

export function diffBlockSummaries(prevBlocks: Block[], nextBlocks: Block[]): LineDiffOp[] {
  const a = prevBlocks.map(blockSummaryLine)
  const b = nextBlocks.map(blockSummaryLine)
  return diffLines(a, b)
}

/** Token diff for one-line strings (words + spaces preserved crudely). */
export function diffWordsInline(oldStr: string, newStr: string): LineDiffOp[] {
  const tokenize = (s: string) => s.split(/(\s+)/).filter((x) => x.length > 0)
  return diffLines(tokenize(oldStr), tokenize(newStr))
}
