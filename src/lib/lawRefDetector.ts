// Heuristic detector for Norwegian + EU regulatory paragraph references
// in free text. Surfaces "did you mean" suggestions in the template
// preview / editor — admins keep typing prose; we extract the formal
// citations.
//
// Patterns detected:
//   - Arbeidsmiljøloven        AML § 4-3, AML §4-3, arbeidsmiljøloven § 4-3
//   - Internkontrollforskriften IK-f § 5 nr. 7, IK-forskriften §5
//   - GDPR / personvernforordningen  GDPR Art. 33, GDPR art. 35
//   - Likestillings- og diskrimineringsloven  LDL § 26
//   - ISO 45001                ISO 45001 8.1.2
//   - NS-EN ISO                NS-EN ISO 14001
//
// Returns deduplicated, normalised citation strings matching the format
// used throughout the seed migrations (CLAUDE.md "Law-ref string
// format").

const PATTERNS: { name: string; rx: RegExp; format: (m: RegExpMatchArray) => string }[] = [
  {
    name: 'AML',
    rx: /\b(?:AML|arbeidsmilj[øo]sloven|arbeidsmilj[øo]loven)\s*§\s*(\d+[a-zA-ZÅÄÖåäö]?-?\d+(?:\s*(?:nr|stk|ledd)\.?\s*\d+)?)/gi,
    format: (m) => `AML § ${m[1].replace(/\s+/g, ' ')}`,
  },
  {
    name: 'IK-f',
    rx: /\b(?:IK-?(?:forskriften|f))\s*§\s*(\d+(?:\s*(?:nr|stk|ledd)\.?\s*\d+)?)/gi,
    format: (m) => `IK-f § ${m[1].replace(/\s+/g, ' ')}`,
  },
  {
    name: 'GDPR',
    rx: /\bGDPR\s*(?:Art\.?|artikkel)?\s*(\d+)/gi,
    format: (m) => `GDPR Art. ${m[1]}`,
  },
  {
    name: 'LDL',
    rx: /\b(?:LDL|likestillings-?\s*og\s*diskrimineringsloven)\s*§\s*(\d+[a-zA-ZÅÄÖåäö]?)/gi,
    format: (m) => `Likestillings- og diskrimineringsloven § ${m[1]}`,
  },
  {
    name: 'ISO 45001',
    rx: /\bISO\s*45001\s+(\d+(?:\.\d+){0,3})/gi,
    format: (m) => `ISO 45001 ${m[1]}`,
  },
]

export type LawRefHit = {
  /** Normalised citation string. */
  ref: string
  /** Which pattern matched (for grouping / debugging). */
  source: string
}

export function detectLawRefs(text: string | null | undefined): LawRefHit[] {
  if (!text) return []
  const out = new Map<string, LawRefHit>()
  for (const p of PATTERNS) {
    p.rx.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = p.rx.exec(text)) !== null) {
      const ref = p.format(m)
      if (!out.has(ref)) out.set(ref, { ref, source: p.name })
    }
  }
  return [...out.values()]
}
