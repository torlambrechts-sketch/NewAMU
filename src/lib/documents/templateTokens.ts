// Token resolution for document templates.
// Templates use {{token}} syntax in text/heading/alert/table/law_ref blocks.
// Special alert blocks with text "{{inject:X}}" are replaced with dynamically
// generated content blocks based on the TemplateContext.

import type { ContentBlock } from '../../types/documents'

// ─── Context ──────────────────────────────────────────────────────────────────

export type TemplateContext = {
  orgName: string
  orgNr: string
  address: string
  policyDate: string         // e.g. "10.05.2026"
  nextRevisionDate: string   // e.g. "10.05.2027"
  approverName: string
  approverTitle: string      // default "Daglig leder"
  amuDate: string            // date or "[Dato ikke registrert]"
  sykefraværMål: string      // e.g. "4"
  avvikFrist: string         // e.g. "14"
  naceBeskrivelse: string
  currentYear: string
  hasAmu: boolean
  hasBht: boolean
  hasCollectiveAgreement: boolean
  collectiveAgreementName: string
  sectorRisks: string[]      // display labels of user-selected risk items
}

// ─── String token replacement ─────────────────────────────────────────────────

function applyTokens(text: string, ctx: TemplateContext): string {
  return text
    .replace(/\{\{orgName\}\}/g, ctx.orgName || '[Virksomhetens navn]')
    .replace(/\{\{orgNr\}\}/g, ctx.orgNr || '[Org.nr]')
    .replace(/\{\{address\}\}/g, ctx.address || '[Adresse]')
    .replace(/\{\{policyDate\}\}/g, ctx.policyDate || '[Dato]')
    .replace(/\{\{nextRevisionDate\}\}/g, ctx.nextRevisionDate || '[Dato]')
    .replace(/\{\{approverName\}\}/g, ctx.approverName || '[Navn]')
    .replace(/\{\{approverTitle\}\}/g, ctx.approverTitle || 'Daglig leder')
    .replace(/\{\{amuDate\}\}/g, ctx.amuDate || '[Dato ikke registrert]')
    .replace(/\{\{sykefraværMål\}\}/g, ctx.sykefraværMål || '4')
    .replace(/\{\{avvikFrist\}\}/g, ctx.avvikFrist || '14')
    .replace(/\{\{naceBeskrivelse\}\}/g, ctx.naceBeskrivelse || '')
    .replace(/\{\{currentYear\}\}/g, ctx.currentYear || String(new Date().getFullYear()))
}

// ─── Injected content blocks ──────────────────────────────────────────────────

function makeSectorRisksBlock(risks: string[]): ContentBlock {
  const items = risks.map((r) => `<li>${r}</li>`).join('')
  return {
    kind: 'text',
    body: `<p>Basert på virksomhetens bransje og gjennomført risikokartlegging er følgende arbeidsmiljøutfordringer særlig relevante for ${risks.length > 0 ? 'oss' : 'vår virksomhet'}:</p><ul>${items}</ul><p>Detaljerte risikovurderinger for hvert punkt finnes i oppgavemodulen og oppdateres ved årsgjennomgangen.</p>`,
  }
}

function makeAmuBlock(amuDate: string): ContentBlock {
  return {
    kind: 'text',
    body: `<p>Arbeidsmiljøutvalget (AMU) er etablert etter AML §7-1 og behandlet denne HMS-policyen den ${amuDate}. AMU har en rådgivende og medbestemmende rolle i det systematiske HMS-arbeidet og skal informeres om vesentlige endringer i arbeidsmiljøet og ved revisjon av policyen.</p>`,
  }
}

function makeBhtBlock(): ContentBlock {
  return {
    kind: 'text',
    body: `<p>Virksomheten er tilknyttet godkjent bedriftshelsetjeneste (BHT) i henhold til AML §3-3. BHT bidrar med uavhengig faglig rådgivning i risikovurderinger, helseovervåkning, opplæring og tilrettelegging av arbeidsmiljøet.</p>`,
  }
}

function makeCollectiveAgreementBlock(name: string): ContentBlock {
  return {
    kind: 'text',
    body: `<p>Virksomheten er tariffbundet${name ? ` gjennom ${name}` : ''}. Tillitsvalgte involveres i HMS-arbeidet etter avtalens bestemmelser og har rett til å delta i AMUs arbeid på lik linje med verneombudet.</p>`,
  }
}

// ─── Main resolver ────────────────────────────────────────────────────────────

const SETUP_WARN_PREFIX = 'Tilpass dette dokumentet'

export function resolveTemplateTokens(
  blocks: ContentBlock[],
  ctx: TemplateContext,
): ContentBlock[] {
  const result: ContentBlock[] = []

  for (const block of blocks) {
    // Strip the wizard setup alert that is only meant for unresolved templates
    if (
      block.kind === 'alert' &&
      block.variant === 'warning' &&
      block.text.startsWith(SETUP_WARN_PREFIX)
    ) {
      continue
    }

    // Handle inject placeholder markers embedded in alert/warning blocks
    if (block.kind === 'alert' && block.variant === 'warning') {
      switch (block.text.trim()) {
        case '{{inject:sector_risks}}':
          if (ctx.sectorRisks.length > 0) {
            result.push(makeSectorRisksBlock(ctx.sectorRisks))
          }
          continue
        case '{{inject:amu_section}}':
          if (ctx.hasAmu) result.push(makeAmuBlock(ctx.amuDate))
          continue
        case '{{inject:bht_section}}':
          if (ctx.hasBht) result.push(makeBhtBlock())
          continue
        case '{{inject:collective_section}}':
          if (ctx.hasCollectiveAgreement) {
            result.push(makeCollectiveAgreementBlock(ctx.collectiveAgreementName))
          }
          continue
      }
    }

    // Resolve tokens in each block kind
    switch (block.kind) {
      case 'text':
        result.push({ ...block, body: applyTokens(block.body, ctx) })
        break
      case 'heading':
        result.push({ ...block, text: applyTokens(block.text, ctx) })
        break
      case 'alert':
        result.push({ ...block, text: applyTokens(block.text, ctx) })
        break
      case 'law_ref':
        result.push({
          ...block,
          ref: applyTokens(block.ref, ctx),
          description: applyTokens(block.description, ctx),
        })
        break
      case 'table':
        result.push({
          ...block,
          caption: block.caption ? applyTokens(block.caption, ctx) : block.caption,
          headers: block.headers.map((h) => applyTokens(h, ctx)),
          rows: block.rows.map((row) => row.map((cell) => applyTokens(cell, ctx))),
        })
        break
      default:
        result.push(block)
    }
  }

  return result
}
