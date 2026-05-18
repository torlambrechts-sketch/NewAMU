// Documents scope — Studio Builder Phase 1.

import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

registerStudioScope({
  scopeId: 'documents',
  label: 'Dokumenter',
  singular: 'Dokument',
  description: 'Policy, instrukser, prosedyrer og acknowledgement-flyter.',
  accent: '#0f766e',
  tint: '#ccfbf1',
  icon: 'FileText',
  sample: 'HMS-håndbok 2026',
  order: 30,
})

async function provisionDocumentsBaseline(): Promise<void> {
  const { supabase } = await import('../../../src/lib/supabaseClient')
  const { resolveActiveOrgId } = await import('../../../src/lib/studio/resolveActiveOrgId')
  const orgId = await resolveActiveOrgId(supabase)
  if (!supabase || !orgId) return
  await supabase.rpc('provision_documents_baseline_for_org', { p_org_id: orgId })
}

const PRESETS: SimplePreset[] = [
  {
    id: 'policy',
    title: 'Policy / instruks',
    description: 'Ny policy-mal med acknowledgement-footer og lovreferanser.',
    icon: '📜',
    badge: 'ANBEFALT',
    wizard: {
      title: 'Ny policy',
      colour: 'emerald',
      steps: [
        {
          id: 'meta',
          title: 'Tittel og scope',
          fields: [
            { id: 'title', label: 'Tittel', kind: 'text', required: true },
            {
              id: 'space',
              label: 'Plass',
              kind: 'select',
              required: true,
              options: [
                { value: 'hms', label: 'HMS' },
                { value: 'hr', label: 'HR / Personal' },
                { value: 'gdpr', label: 'Personvern' },
                { value: 'iso', label: 'ISO-styring' },
              ],
            },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi seeder baseline-pakken og åpner editor.' }],
          onAdvance: async () => {
            await provisionDocumentsBaseline()
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'prosedyre',
    title: 'Prosedyre med trinn-for-trinn',
    description: 'Stegvis prosedyre-dokument — fremgangsmåte + sjekkpunkter.',
    icon: '🪜',
    wizard: {
      title: 'Ny prosedyre',
      colour: 'sky',
      steps: [
        {
          id: 'meta',
          title: 'Tittel',
          fields: [{ id: 'title', label: 'Tittel', kind: 'text', required: true }],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter prosedyre-skjelett.' }],
          onAdvance: async () => {
            await provisionDocumentsBaseline()
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'haandbok',
    title: 'Håndbok-seksjon',
    description: 'Lang-form håndbok-side med innholdsfortegnelse og lovreferanser.',
    icon: '📘',
    wizard: {
      title: 'Ny håndbok-seksjon',
      colour: 'neutral',
      steps: [
        {
          id: 'meta',
          title: 'Tittel',
          fields: [{ id: 'title', label: 'Tittel', kind: 'text', required: true }],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter håndbok-skjelett.' }],
          onAdvance: async () => {
            await provisionDocumentsBaseline()
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
]

registerStudioKind({
  scopeId: 'documents',
  kindId: 'page',
  label: 'Dokument-side',
  simplePresets: PRESETS,
  advancedSchema: {
    fields: [
      { id: 'title', label: 'Tittel', kind: 'text', required: true },
      { id: 'space', label: 'Plass', kind: 'select', options: [
        { value: 'hms', label: 'HMS' },
        { value: 'hr', label: 'HR' },
        { value: 'gdpr', label: 'Personvern' },
      ] },
      { id: 'legalBasis', label: 'Hjemmel', kind: 'law-ref-picker' },
    ],
  },
  embedder: () => import('./documentsEmbedder'),
  mutator: async () => ({ row: {}, rowTable: 'wiki_pages' }),
  lawRefSlot: 'legal_basis',
  packAware: true,
})
