// Meetings scope — Studio Builder Phase 1.

import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

registerStudioScope({
  scopeId: 'meetings',
  label: 'Møter',
  singular: 'Møte',
  description: 'AMU-årshjul, drøftingsmøter, ledersjekk og protokoll-flyter.',
  accent: '#0891b2',
  tint: '#cffafe',
  icon: 'CalendarCheck',
  sample: 'AMU årsrapport Q4',
  order: 50,
})

async function createMeetingFromTemplate(values: Record<string, string | boolean>): Promise<void> {
  const { supabase } = await import('../../../src/lib/supabaseClient')
  if (!supabase) return
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .single()
  const orgId = (profile as { organization_id?: string } | null)?.organization_id
  if (!orgId) return
  await supabase.from('meetings').insert({
    organization_id: orgId,
    title: String(values.title ?? 'Nytt møte'),
    template_slug: String(values.templateSlug ?? ''),
    status: 'planned',
  } as Record<string, unknown>)
}

const PRESETS: SimplePreset[] = [
  {
    id: 'amu_kvartal',
    title: 'AMU kvartalsmøte',
    description: 'Standardisert AMU-agenda for kvartalsvis gjennomgang.',
    icon: '🤝',
    badge: 'ANBEFALT',
    wizard: {
      title: 'Nytt AMU kvartalsmøte',
      colour: 'sky',
      steps: [
        {
          id: 'meta',
          title: 'Detaljer',
          fields: [
            { id: 'title', label: 'Tittel', kind: 'text', required: true, placeholder: 'AMU Q1 2026' },
            { id: 'date', label: 'Dato', kind: 'date', required: true },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter møte fra AMU-mal med dataforberedelser.' }],
          onAdvance: async (v) => {
            await createMeetingFromTemplate({ ...v, templateSlug: 'amu-kvartal' })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'drofting',
    title: 'Drøftingsmøte (§ 18-9)',
    description: 'Drøftingsmøte før beslutning — fortrolig agenda, AML § 18-9.',
    icon: '🗣️',
    wizard: {
      title: 'Nytt drøftingsmøte',
      colour: 'amber',
      steps: [
        {
          id: 'meta',
          title: 'Sak',
          fields: [
            { id: 'title', label: 'Sak', kind: 'text', required: true },
            { id: 'date', label: 'Dato', kind: 'date', required: true },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter konfidensielt møte fra drøftings-mal.' }],
          onAdvance: async (v) => {
            await createMeetingFromTemplate({ ...v, templateSlug: 'drofting-18-9' })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'ledelsens_gjennomgang',
    title: 'Ledelsens gjennomgang (ISO 9.3)',
    description: 'Årlig ledelsens gjennomgang for ISO 9001/45001/27001.',
    icon: '🧭',
    wizard: {
      title: 'Ledelsens gjennomgang',
      colour: 'emerald',
      steps: [
        {
          id: 'meta',
          title: 'Rammeverk',
          fields: [
            { id: 'title', label: 'Tittel', kind: 'text', required: true },
            {
              id: 'framework',
              label: 'Rammeverk',
              kind: 'select',
              required: true,
              options: [
                { value: 'iso-9001', label: 'ISO 9001 (kvalitet)' },
                { value: 'iso-45001', label: 'ISO 45001 (HMS)' },
                { value: 'iso-27001', label: 'ISO 27001 (sikkerhet)' },
                { value: 'iso-14001', label: 'ISO 14001 (miljø)' },
              ],
            },
            { id: 'date', label: 'Dato', kind: 'date', required: true },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter møte fra ISO-mal med 9.3-bokstavene.' }],
          onAdvance: async (v) => {
            await createMeetingFromTemplate({ ...v, templateSlug: `${v.framework ?? 'iso-9001'}-gjennomgang` })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
]

registerStudioKind({
  scopeId: 'meetings',
  kindId: 'meeting',
  label: 'Møte',
  simplePresets: PRESETS,
  advancedSchema: {
    fields: [
      { id: 'title', label: 'Tittel', kind: 'text', required: true },
      { id: 'framework', label: 'Rammeverk', kind: 'select', options: [
        { value: 'aml', label: 'AML' },
        { value: 'iso-9001', label: 'ISO 9001' },
        { value: 'iso-45001', label: 'ISO 45001' },
        { value: 'iso-27001', label: 'ISO 27001' },
      ] },
      { id: 'lawRefs', label: 'Lovreferanser', kind: 'law-ref-picker' },
    ],
  },
  embedder: () => import('./meetingsEmbedder'),
  mutator: async () => ({ row: {}, rowTable: 'meetings' }),
  lawRefSlot: 'law_refs',
  packAware: true,
})
