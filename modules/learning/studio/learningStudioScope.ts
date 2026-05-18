// Learning scope — Studio Builder Phase 1.

import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

registerStudioScope({
  scopeId: 'learning',
  label: 'Læring og kurs',
  singular: 'Kurs',
  description: 'E-læring, sertifisering og opplæringsspor.',
  accent: '#0e7490',
  tint: '#cffafe',
  icon: 'GraduationCap',
  sample: 'AML Masterclass 2026',
  order: 40,
})

async function createDraftCourse(values: Record<string, string | boolean>): Promise<void> {
  const { supabase } = await import('../../../src/lib/supabaseClient')
  const { resolveActiveOrgId } = await import('../../../src/lib/studio/resolveActiveOrgId')
  const orgId = await resolveActiveOrgId(supabase)
  if (!supabase || !orgId) return
  await supabase.from('learning_courses').insert({
    organization_id: orgId,
    slug: String(values.slug ?? `kurs-${Date.now()}`),
    title: String(values.title ?? 'Nytt kurs'),
    status: 'draft',
  } as Record<string, unknown>)
}

const PRESETS: SimplePreset[] = [
  {
    id: 'awareness',
    title: 'Awareness-kurs (10 min)',
    description: 'Kort introduksjonskurs med tekst + 3 quiz-spørsmål — passer onboarding.',
    icon: '💡',
    badge: 'ANBEFALT',
    wizard: {
      title: 'Nytt awareness-kurs',
      colour: 'sky',
      steps: [
        {
          id: 'meta',
          title: 'Tittel',
          fields: [
            { id: 'title', label: 'Tittel', kind: 'text', required: true },
            { id: 'slug', label: 'Slug', kind: 'text', placeholder: 'kort-id-uten-mellomrom' },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter et kursutkast.' }],
          onAdvance: async (v) => {
            await createDraftCourse(v)
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'certification',
    title: 'Sertifiserings-kurs',
    description: 'Krever bestått eksamen + utløpsdato for sertifikat (årlig rotasjon).',
    icon: '🎓',
    wizard: {
      title: 'Nytt sertifiseringskurs',
      colour: 'emerald',
      steps: [
        {
          id: 'meta',
          title: 'Tittel + sertifikat',
          fields: [
            { id: 'title', label: 'Tittel', kind: 'text', required: true },
            { id: 'slug', label: 'Slug', kind: 'text' },
            {
              id: 'recertMonths',
              label: 'Re-sertifisering (måneder)',
              kind: 'number',
              min: 6,
              max: 36,
              required: true,
            },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter et kursutkast med sertifikat-konfig.' }],
          onAdvance: async (v) => {
            await createDraftCourse(v)
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'role_specific',
    title: 'Rollespesifikt kurs',
    description: 'Kurs tildelt en spesifikk rolle (verneombud, lederlinje, IT).',
    icon: '🧰',
    wizard: {
      title: 'Nytt rollekurs',
      colour: 'amber',
      steps: [
        {
          id: 'meta',
          title: 'Tittel + rolle',
          fields: [
            { id: 'title', label: 'Tittel', kind: 'text', required: true },
            { id: 'slug', label: 'Slug', kind: 'text' },
            {
              id: 'role',
              label: 'Målgruppe',
              kind: 'select',
              required: true,
              options: [
                { value: 'verneombud', label: 'Verneombud' },
                { value: 'leder', label: 'Leder' },
                { value: 'it', label: 'IT' },
                { value: 'hr', label: 'HR' },
              ],
            },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Kursutkast opprettes; målgruppe lagres i metadata.' }],
          onAdvance: async (v) => {
            await createDraftCourse(v)
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
]

registerStudioKind({
  scopeId: 'learning',
  kindId: 'course',
  label: 'Kurs',
  simplePresets: PRESETS,
  advancedSchema: {
    fields: [
      { id: 'title', label: 'Tittel', kind: 'text', required: true },
      { id: 'slug', label: 'Slug', kind: 'text' },
      { id: 'description', label: 'Beskrivelse', kind: 'textarea' },
      { id: 'lawRefs', label: 'Lovreferanser', kind: 'law-ref-picker' },
    ],
  },
  embedder: () => import('./learningEmbedder'),
  mutator: async () => ({ row: {}, rowTable: 'learning_courses' }),
  lawRefSlot: 'law_refs_jsonb',
  packAware: true,
})
