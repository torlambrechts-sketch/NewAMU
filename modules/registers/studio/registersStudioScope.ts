// Registers scope — Studio Builder Phase 1.

import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

registerStudioScope({
  scopeId: 'registers',
  label: 'Register',
  singular: 'Registertype',
  description: 'AML-, GDPR- og ISO-register med strukturerte feltdefinisjoner.',
  accent: '#9333ea',
  tint: '#f3e8ff',
  icon: 'Database',
  sample: 'Behandlingsprotokoll (ROPA)',
  order: 60,
})

async function createRegisterType(values: Record<string, string | boolean>): Promise<void> {
  const { supabase } = await import('../../../src/lib/supabaseClient')
  if (!supabase) return
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .single()
  const orgId = (profile as { organization_id?: string } | null)?.organization_id
  if (!orgId) return
  await supabase.from('register_types').insert({
    organization_id: orgId,
    slug: String(values.slug ?? `register-${Date.now()}`),
    name: String(values.name ?? 'Nytt register'),
    schema: {},
  } as Record<string, unknown>)
}

const PRESETS: SimplePreset[] = [
  {
    id: 'gdpr_ropa',
    title: 'GDPR ROPA — behandlingsprotokoll',
    description: 'Art. 30 — register over behandlingsaktiviteter med formål, kategorier, mottakere.',
    icon: '🛡️',
    badge: 'PLIKTIG',
    wizard: {
      title: 'GDPR ROPA',
      colour: 'purple',
      steps: [
        {
          id: 'meta',
          title: 'Navn',
          fields: [
            { id: 'name', label: 'Navn', kind: 'text', required: true },
            { id: 'slug', label: 'Slug', kind: 'text' },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter register-type med ROPA-skjelett.' }],
          onAdvance: async (v) => {
            await createRegisterType({ ...v, slug: String(v.slug ?? 'ropa') })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'aml_register',
    title: 'AML hvitvasking-register',
    description: 'Pliktig kundekontroll-register for finanssektor + fast eiendom.',
    icon: '🏦',
    wizard: {
      title: 'AML kundekontroll-register',
      colour: 'amber',
      steps: [
        {
          id: 'meta',
          title: 'Navn',
          fields: [{ id: 'name', label: 'Navn', kind: 'text', required: true }],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter register med AML §§ 17-21 skjelett.' }],
          onAdvance: async (v) => {
            await createRegisterType({ ...v, slug: 'aml-kundekontroll' })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'iso_asset',
    title: 'ISO 27001 asset inventory (A.5.9)',
    description: 'Asset-register for informasjonssikkerhet — eier, klassifisering, lokasjon.',
    icon: '🗂️',
    wizard: {
      title: 'ISO 27001 asset inventory',
      colour: 'sky',
      steps: [
        {
          id: 'meta',
          title: 'Navn',
          fields: [{ id: 'name', label: 'Navn', kind: 'text', required: true }],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter register med A.5.9-felter (eier, klassifisering, lokasjon).' }],
          onAdvance: async (v) => {
            await createRegisterType({ ...v, slug: 'iso-asset-inventory' })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
]

registerStudioKind({
  scopeId: 'registers',
  kindId: 'type',
  label: 'Registertype',
  simplePresets: PRESETS,
  advancedSchema: {
    fields: [
      { id: 'name', label: 'Navn', kind: 'text', required: true },
      { id: 'slug', label: 'Slug', kind: 'text', required: true },
      { id: 'regulationIds', label: 'Rammeverk', kind: 'law-ref-picker' },
    ],
  },
  embedder: () => import('./registersEmbedder'),
  mutator: async () => ({ row: {}, rowTable: 'register_types' }),
  lawRefSlot: 'regulation_ids',
  packAware: false,
})
