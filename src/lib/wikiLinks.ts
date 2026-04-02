/** Replace {{key}} in HTML with values from map (missing keys left as-is). */
export function applyTemplateVariables(html: string, vars: Record<string, string> | undefined): string {
  if (!vars || Object.keys(vars).length === 0) return html
  let out = html
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${escapeRegExp(k)}\\s*\\}\\}`, 'g')
    out = out.replace(re, v)
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type WikiDocRef = { id: string; title: string; wikiSlug: string }

/**
 * Turn [[Document Title]] into internal links. Unresolved titles get data-wiki-unresolved.
 */
export function resolveWikiLinks(html: string, docs: WikiDocRef[]): string {
  const byTitle = new Map(docs.map((d) => [d.title.toLowerCase().trim(), d]))
  const bySlug = new Map(docs.map((d) => [d.wikiSlug.toLowerCase(), d]))

  return html.replace(/\[\[([^\]]+)\]\]/g, (_, raw: string) => {
    const key = raw.trim()
    const lower = key.toLowerCase()
    let target = byTitle.get(lower) ?? bySlug.get(lower)
    if (!target) {
      target = docs.find((d) => d.title.toLowerCase().includes(lower) || lower.includes(d.wikiSlug))
    }
    if (!target) {
      return `<span class="wiki-unresolved" title="Ingen dokument funnet">[[${escapeHtml(key)}]]</span>`
    }
    return `<a href="/documents/${target.id}" class="wiki-internal-link">${escapeHtml(target.title)}</a>`
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Strip HTML for full-text search indexing. */
export function stripHtmlForSearch(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
