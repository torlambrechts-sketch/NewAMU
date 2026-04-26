const INTERNAL_PAGE_HREF = /\/documents\/page\/([0-9a-f-]{36})/gi

export function extractWikiInternalPageIdsFromHtml(html: string): string[] {
  const ids = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(INTERNAL_PAGE_HREF.source, 'gi')
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1])
  }
  return [...ids]
}

export function extractWikiInternalPageIdsFromBlocks(
  blocks: { kind: string; body?: string }[],
): string[] {
  const ids = new Set<string>()
  for (const b of blocks) {
    if (b.kind === 'text' && typeof b.body === 'string') {
      for (const id of extractWikiInternalPageIdsFromHtml(b.body)) ids.add(id)
    }
  }
  return [...ids]
}

export function headingAnchorId(text: string, occurrenceIndex: number): string {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'overskrift'
  return occurrenceIndex === 0 ? `heading-${base}` : `heading-${base}-${occurrenceIndex}`
}
