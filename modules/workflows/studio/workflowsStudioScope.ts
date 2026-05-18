// Workflows scope — Studio Builder Phase 1 partial.
//
// Phase 1.5 stub: registers the workflows scope so the studio shell
// surfaces it as a top-level card. The deep authoring surface
// (three-column graph canvas + inspector) ships when
// workflow-engine-review.md Phase A (registry refactor + law_refs) and
// Phase B (WorkflowBuilderPage v3) land. Until then the embedder
// deep-links to the existing /workflow page which already covers
// rule-level editing.
//
// Side-effect import wired via registerStudioScopes.ts.

import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

registerStudioScope({
  scopeId: 'workflows',
  label: 'Arbeidsflyter',
  singular: 'Arbeidsflyt',
  description: 'Automatiseringer, varslinger og hand-offs på tvers av modulene.',
  accent: '#7e22ce',
  tint: '#f3e8ff',
  icon: 'Workflow',
  sample: 'Avvik → tildel verneombud',
  order: 80,
})

async function navigateToWorkflowBuilder(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.location.href = '/workflow'
  }
}

const PRESETS: SimplePreset[] = [
  {
    id: 'avvik_til_verneombud',
    title: 'Avvik → tildel verneombud',
    description: 'Når et avvik opprettes, opprett oppgave til verneombud automatisk.',
    icon: '🛡️',
    badge: 'ANBEFALT',
    wizard: {
      title: 'Avvik → verneombud-arbeidsflyt',
      colour: 'purple',
      steps: [
        {
          id: 'intro',
          title: 'Hvorfor dette?',
          fields: [
            {
              id: '_intro',
              label: '',
              kind: 'info',
              infoBody:
                'AML § 6 (verneombud) krever at vesentlige avvik kommuniseres til verneombudet. Denne arbeidsflyten gjør det automatisk når et avvik opprettes.',
            },
          ],
        },
        {
          id: 'next',
          title: 'Åpne arbeidsflyt-bygger',
          fields: [
            {
              id: '_next',
              label: '',
              kind: 'info',
              infoBody:
                'Studio mounter den eksisterende arbeidsflyt-byggeren inline når workflow-engine-review.md Phase B lander. Klikk Neste for å åpne dagens bygger.',
            },
          ],
          onAdvance: async () => {
            await navigateToWorkflowBuilder()
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'gdpr_breach_72t',
    title: 'GDPR-databrudd — 72 t. melding',
    description: 'Trigger automatisk Datatilsynet-melding når et databrudd registreres.',
    icon: '⏱️',
    wizard: {
      title: 'GDPR 72-timers-arbeidsflyt',
      colour: 'amber',
      steps: [
        {
          id: 'intro',
          title: 'Hvorfor dette?',
          fields: [
            {
              id: '_intro',
              label: '',
              kind: 'info',
              infoBody:
                'GDPR Art. 33 krever melding til Datatilsynet innen 72 timer. Denne arbeidsflyten triggrer utkast-meldingen automatisk.',
            },
          ],
        },
        {
          id: 'next',
          title: 'Åpne arbeidsflyt-bygger',
          fields: [
            { id: '_next', label: '', kind: 'info', infoBody: 'Åpne dagens bygger for å konfigurere.' },
          ],
          onAdvance: async () => {
            await navigateToWorkflowBuilder()
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'sertifikat_rotasjon',
    title: 'Sertifikat-rotasjon — varsel 30 dager før',
    description: 'Send varsel + opprett oppgave 30 dager før et sertifikat utløper.',
    icon: '🔑',
    wizard: {
      title: 'Sertifikat-rotasjons-arbeidsflyt',
      colour: 'sky',
      steps: [
        {
          id: 'intro',
          title: 'Hvorfor dette?',
          fields: [
            {
              id: '_intro',
              label: '',
              kind: 'info',
              infoBody:
                'ISO 27001 A.8.24 krever sertifikatstyring. Denne arbeidsflyten varsler eier 30 dager før utløp og oppretter rotasjons-oppgave.',
            },
          ],
        },
        {
          id: 'next',
          title: 'Åpne arbeidsflyt-bygger',
          fields: [
            { id: '_next', label: '', kind: 'info', infoBody: 'Åpne dagens bygger for å konfigurere.' },
          ],
          onAdvance: async () => {
            await navigateToWorkflowBuilder()
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
]

registerStudioKind({
  scopeId: 'workflows',
  kindId: 'rule',
  label: 'Arbeidsflyt-regel',
  simplePresets: PRESETS,
  advancedSchema: {
    fields: [
      { id: 'name', label: 'Navn', kind: 'text', required: true },
      { id: 'trigger', label: 'Trigger-hendelse', kind: 'text' },
      { id: 'lawRefs', label: 'Lovreferanser', kind: 'law-ref-picker' },
    ],
  },
  embedder: () => import('./workflowsEmbedder'),
  mutator: async () => ({ row: {}, rowTable: 'workflow_rules' }),
  lawRefSlot: 'law_refs',
  packAware: false,
})
