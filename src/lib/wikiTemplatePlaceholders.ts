import type { ContentBlock } from '../types/documents'

export type VarslingOrgContext = {
  orgName: string
  varslingContactEmail: string | null
  varslingChannelDescription: string | null
  /** Display name for varsling_contact_id when known */
  varslingContactDisplayName: string | null
}

function replaceInString(s: string, ctx: VarslingOrgContext): string {
  let out = s
  out = out.split('{orgName}').join(ctx.orgName || 'Organisasjonen')

  const contactLines: string[] = []
  if (ctx.varslingContactDisplayName?.trim()) {
    contactLines.push(`<strong>Varslingsmottaker:</strong> ${escapeHtml(ctx.varslingContactDisplayName.trim())}`)
  }
  if (ctx.varslingContactEmail?.trim()) {
    contactLines.push(`<strong>E-post:</strong> ${escapeHtml(ctx.varslingContactEmail.trim())}`)
  }
  if (!contactLines.length) {
    contactLines.push('<em>[FYLL INN: Navn og kontaktinfo til varslingsmottaker]</em>')
  }
  const contactBlock = `<p>${contactLines.join('<br/>')}</p>`

  out = out.split('{varslingContactBlock}').join(contactBlock)
  out = out
    .split('{varslingChannelDescription}')
    .join(
      ctx.varslingChannelDescription?.trim()
        ? escapeHtml(ctx.varslingChannelDescription.trim())
        : '<em>[FYLL INN: Beskrivelse av varslingskanal og mulighet for anonym varsling]</em>',
    )
  return out
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Deep-clone blocks and replace known placeholders in text fields. */
export function applyVarslingTemplatePlaceholders(blocks: ContentBlock[], ctx: VarslingOrgContext): ContentBlock[] {
  const copy = JSON.parse(JSON.stringify(blocks)) as ContentBlock[]
  for (const b of copy) {
    if (b.kind === 'text' && typeof b.body === 'string') {
      b.body = replaceInString(b.body, ctx)
    }
    if (b.kind === 'heading' && typeof b.text === 'string') {
      b.text = replaceInString(b.text, ctx)
    }
    if (b.kind === 'alert' && typeof b.text === 'string') {
      b.text = replaceInString(b.text, ctx)
    }
    if (b.kind === 'law_ref') {
      if (typeof b.ref === 'string') b.ref = replaceInString(b.ref, ctx)
      if (typeof b.description === 'string') b.description = replaceInString(b.description, ctx)
    }
  }
  return copy
}

export function applyVarslingPlaceholdersToText(title: string, summary: string, ctx: VarslingOrgContext) {
  return {
    title: replaceInString(title, ctx),
    summary: replaceInString(summary, ctx),
  }
}
