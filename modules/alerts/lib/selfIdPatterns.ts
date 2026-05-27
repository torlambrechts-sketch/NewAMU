// Self-identification regex patterns — fires inline warnings on the public
// intake form. All matching happens client-side; nothing is transmitted.
//
// Patterns are ordered by specificity (most specific first). Add new
// patterns as observed: report a heuristic with the false-positive impact
// next to it.

export type SelfIdPattern = {
  id: string
  pattern: RegExp
  warning: { nb: string; en: string }
  severity: 'low' | 'medium' | 'high'
}

export const SELF_ID_PATTERNS: SelfIdPattern[] = [
  {
    id: 'sole_role',
    pattern: /(jeg|eg)\s+(er|var)\s+den\s+eneste/i,
    warning: {
      nb: 'Setningen kan identifisere deg. Vurder om du kan beskrive forholdet uten å peke ut hvor mange du var.',
      en: 'This sentence may identify you. Consider whether you can describe the matter without specifying numbers.',
    },
    severity: 'high',
  },
  {
    id: 'only_role_on_team',
    pattern: /(eneste|alene)\s+(på|i)\s+(avdelingen|teamet|kontoret|gruppen|gruppa)/i,
    warning: {
      nb: 'Du nevner at du er alene i en bestemt gruppe — dette kan identifisere deg overfor leder.',
      en: 'You mention being alone in a specific group — this may identify you to management.',
    },
    severity: 'high',
  },
  {
    id: 'my_position',
    pattern: /(min\s+stilling|min\s+rolle|jobben\s+min)\s+(som|innebærer|krever)/i,
    warning: {
      nb: 'Setningen beskriver din spesifikke stilling og kan dermed identifisere deg.',
      en: 'This describes your specific role and may identify you.',
    },
    severity: 'medium',
  },
  {
    id: 'specific_dates',
    pattern: /\b(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{1,2}\.\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember))/i,
    warning: {
      nb: 'Datoen kan kobles tilbake til en spesifikk hendelse og dermed identifisere deg.',
      en: 'The date may be traceable to a specific event and identify you.',
    },
    severity: 'low',
  },
  {
    id: 'recent_hire',
    pattern: /(nyansatt|nylig\s+ansatt|begynte\s+i\s+(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember))/i,
    warning: {
      nb: 'Setningen kan brukes til å snevre inn hvem du er via ansettelsesdato.',
      en: 'This could be used to narrow down who you are via hire date.',
    },
    severity: 'medium',
  },
  {
    id: 'first_person_unique',
    pattern: /(bare\s+jeg|kun\s+jeg)\s+(visste|gjorde|hadde|så)/i,
    warning: {
      nb: 'Du sier at bare du visste / så noe — det vil ofte identifisere deg.',
      en: 'You state that only you knew / saw something — this often identifies you.',
    },
    severity: 'high',
  },
  {
    id: 'specific_location',
    pattern: /(mitt\s+kontor|min\s+pult|min\s+arbeidsplass)/i,
    warning: {
      nb: 'Du peker på din spesifikke arbeidsplass.',
      en: 'You refer to your specific workplace.',
    },
    severity: 'low',
  },
]

export type SelfIdMatch = {
  patternId: string
  severity: SelfIdPattern['severity']
  warning: string
  matchedText: string
  index: number
}

export function scanForSelfIdentification(
  text: string,
  lang: 'nb' | 'en' = 'nb',
): SelfIdMatch[] {
  const matches: SelfIdMatch[] = []
  for (const p of SELF_ID_PATTERNS) {
    p.pattern.lastIndex = 0
    const m = p.pattern.exec(text)
    if (m) {
      matches.push({
        patternId: p.id,
        severity: p.severity,
        warning: p.warning[lang],
        matchedText: m[0],
        index: m.index,
      })
    }
  }
  return matches.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
}
