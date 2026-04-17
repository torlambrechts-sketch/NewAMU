import type { ContentBlock } from '../types/documents'

const VAGUE_LINK = /^(klikk her|trykk her|les mer|her|link|click here|read more)\.?$/i

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Collect link issues from HTML (client-side heuristic). */
function scanHtmlLinks(html: string, blockLabel: string, out: string[]) {
  const re = /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const inner = stripTags(m[2] ?? '')
    if (!inner || VAGUE_LINK.test(inner)) {
      out.push(`${blockLabel}: Lenketeksten «${inner || '(tom)'}» er lite beskrivende for skjermlesere.`)
    }
  }
  const imgRe = /<img\b[^>]*>/gi
  let im: RegExpExecArray | null
  while ((im = imgRe.exec(html)) !== null) {
    const tag = im[0]
    const altM = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)
    const alt = altM ? altM[1].trim() : null
    if (alt == null || alt === '') {
      out.push(`${blockLabel}: Bilde i tekstblokk mangler alt-tekst (tom alt).`)
    }
  }
}

/**
 * Basic WCAG-oriented checks for wiki content (editor pre-publish).
 * Not a substitute for full audit tooling.
 */
export function runWikiWcagHeuristics(blocks: ContentBlock[]): string[] {
  const warnings: string[] = []
  let lastHeadingLevel = 0

  blocks.forEach((block, i) => {
    const label = `Blokk ${i + 1}`
    if (!block || typeof block !== 'object' || !('kind' in block)) {
      warnings.push(`${label}: Ukjent eller ugyldig blokk.`)
      return
    }
    switch (block.kind) {
      case 'heading': {
        const lvl = block.level === 1 || block.level === 2 || block.level === 3 ? block.level : 2
        if (lastHeadingLevel > 0 && lvl > lastHeadingLevel + 1) {
          warnings.push(
            `${label} (Overskrift H${lvl}): Overskriftsnivå hopper over nivå (forrige var H${lastHeadingLevel}). Vurder sekvensiell struktur (H1 → H2 → H3).`,
          )
        }
        lastHeadingLevel = lvl
        break
      }
      case 'text':
        scanHtmlLinks(typeof block.body === 'string' ? block.body : '', `${label} (Tekst)`, warnings)
        break
      case 'alert': {
        const v = block.variant
        if (v === 'danger' || v === 'warning') {
          // Heuristic: light backgrounds on colored borders may fail 4.5:1 for small text in some themes
          warnings.push(
            `${label} (Varsel ${v}): Kontroller kontrast mellom tekst og bakgrunn (målet er WCAG 2.1 AA, minst 4.5:1 for brødtekst).`,
          )
        }
        break
      }
      case 'law_ref':
        if (block.url && !stripTags(block.description)) {
          warnings.push(`${label} (Lovhenvisning): Mangler beskrivelse ved siden av ekstern lenke.`)
        }
        break
      case 'image': {
        const alt = typeof block.alt === 'string' ? block.alt.trim() : ''
        if (!alt) warnings.push(`${label} (Bilde): Mangler alt-tekst.`)
        break
      }
      default:
        break
    }
  })

  const h1Count = blocks.filter((b) => b && typeof b === 'object' && 'kind' in b && b.kind === 'heading' && b.level === 1)
    .length
  if (h1Count > 1) {
    warnings.push(`Dokumentet har ${h1Count} H1-overskrifter. Vanligvis bør siden ha én H1 (sidetittel er allerede H1 i visning).`)
  }

  return warnings
}
