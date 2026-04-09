import type { WorkflowCondition } from '../types/workflow'

export function summarizeCondition(c: WorkflowCondition): string {
  switch (c.match) {
    case 'always':
      return 'Alltid'
    case 'field_equals':
      return `Felt «${c.path}» = «${c.value}»`
    case 'array_any': {
      const keys = Object.keys(c.where ?? {})
      if (keys.length === 0) return `Liste «${c.path}»: nytt element`
      const parts = keys.map((k) => {
        const v = (c.where as Record<string, unknown>)[k]
        return `${k}=${JSON.stringify(v)}`
      })
      return `Liste «${c.path}» matcher: ${parts.join(', ')}`
    }
    case 'and':
      return c.conditions.map(summarizeCondition).join(' OG ')
    case 'or':
      return c.conditions.map(summarizeCondition).join(' ELLER ')
    case 'xor':
      return `Eksakt én av: ${c.conditions.map(summarizeCondition).join(' | ')}`
    default:
      return 'Betingelse'
  }
}
