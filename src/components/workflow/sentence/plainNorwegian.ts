// SentenceModel → readable Norwegian paragraph.
//
// Pure TS, no React. Used by the <details> preview below the sentence
// builder so AMU-leder Kari can verify a rule reads like she expects
// before saving. Action labels come from `summarizeAction`; we add
// connectives ("når … vil … umiddelbart …, og deretter …") to glue.

import type { WorkflowAction, WorkflowCondition } from '../../../types/workflow'
import { findActionDescriptor } from '../../../lib/workflows/workflowRegistry'
import { listWorkflowEvents } from '../../../lib/workflows/workflowRegistry'
import { summarizeAction } from '../workflowActionDefaults'
import type { SentenceDelay, SentenceModel, SentenceScopeFilter } from './sentenceModel'

function eventLabel(sourceModule: string, eventName: string): string {
  for (const { scope, event } of listWorkflowEvents(sourceModule)) {
    if (event.name === eventName) return `${event.label.toLowerCase()} i ${scope.label.toLowerCase()}`
  }
  return eventName ? `hendelsen «${eventName}»` : 'en hendelse i modulen'
}

function scopeFilterPhrase(sf: SentenceScopeFilter): string {
  // P1 #9 (path 1): drop raw UUIDs from preview prose. Users only see this
  // when expanding the "Forhåndsvis på vanlig norsk" details, and a 36-char
  // hex string mid-sentence is useless to them. TODO(v1): resolve to a
  // friendly name via a React Context provided by CanvasPanel.
  if (!sf) return 'i hele organisasjonen'
  if (sf.kind === 'location') return 'på valgt lokasjon'
  if (sf.kind === 'enhet') return 'i valgt enhet'
  if (sf.kind === 'avdeling') return 'i valgt avdeling'
  return 'i hele organisasjonen'
}

function conditionPhrase(c: WorkflowCondition | null): string | null {
  if (!c) return null
  if (c.match === 'always') return null
  if (c.match === 'field_equals') return `og ${c.path} = «${c.value}»`
  if (c.match === 'array_any') {
    const where = Object.entries(c.where ?? {})
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(', ')
    return where ? `og minst ett element i ${c.path} har ${where}` : `og minst ett element i ${c.path}`
  }
  if (c.match === 'and') return 'og flere betingelser er oppfylt'
  return null
}

function delayPhrase(d: SentenceDelay): string {
  if (!d || d.value <= 0) return 'umiddelbart'
  const unitLabel: Record<NonNullable<SentenceDelay>['unit'], string> = {
    minutes: d.value === 1 ? 'minutt' : 'minutter',
    hours: d.value === 1 ? 'time' : 'timer',
    days: d.value === 1 ? 'dag' : 'dager',
  }
  return `etter ${d.value} ${unitLabel[d.unit]}`
}

function actionPhrase(a: WorkflowAction): string {
  // Prefer the registered descriptor label when one exists; fall back to
  // `summarizeAction` which already covers every concrete action shape.
  const desc = findActionDescriptor(a.type)
  if (desc?.label) {
    // For task / notification actions, the title is more informative than
    // just the descriptor label, so keep `summarizeAction`'s output.
    if (a.type === 'create_task' || a.type === 'send_notification') return summarizeAction(a)
    if (a.type === 'rapporter_alvorlig_skade_arbeidstilsynet')
      return 'rapporterer alvorlig skade til Arbeidstilsynet (24t-frist)'
    if (a.type === 'meld_personvernbrudd_datatilsynet')
      return 'melder personvernbrudd til Datatilsynet (72t-frist)'
    return desc.label.toLowerCase()
  }
  return summarizeAction(a).toLowerCase()
}

export function sentenceToPlainNorwegian(s: SentenceModel): string {
  const parts: string[] = []
  const lead = `Når ${eventLabel(s.trigger.sourceModule, s.trigger.eventName)} ${scopeFilterPhrase(s.scopeFilter)}`
  const cond = conditionPhrase(s.condition)
  parts.push(cond ? `${lead} ${cond}` : lead)

  if (s.steps.length === 0) {
    parts.push(', skjer ingenting (ingen handlinger lagt til ennå)')
  } else {
    const stepPhrases = s.steps.map((step, i) => {
      const phrase = `${actionPhrase(step.action)} ${delayPhrase(step.delay)}`
      if (s.steps.length === 1) return `, vil systemet ${phrase}`
      if (i === 0) return `, vil systemet først ${phrase}`
      if (i === s.steps.length - 1) return `, og til slutt ${phrase}`
      return `, deretter ${phrase}`
    })
    parts.push(stepPhrases.join(''))
  }

  if (s.onError && s.onError.length > 0) {
    const escPhrases = s.onError.map((a) => actionPhrase(a)).join(', og ')
    parts.push(`. Hvis en av disse handlingene feiler, vil systemet ${escPhrases}`)
  }

  return parts.join('') + '.'
}
