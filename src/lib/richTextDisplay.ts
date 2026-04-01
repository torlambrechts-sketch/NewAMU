/** Normalize legacy plain-text bodies to minimal HTML for Quill / display. */
export function normalizeModuleHtml(body: string): string {
  const t = body?.trim() ?? ''
  if (!t) return '<p><br></p>'
  if (/<[a-z][\s\S]*>/i.test(t)) return body
  const esc = t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${esc.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br />')}</p>`
}
