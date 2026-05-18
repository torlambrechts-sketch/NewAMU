// Survey scope — Studio Builder Phase 1.
//
// 3 outcome-named presets for the most common survey-authoring jobs:
// medarbeiderundersøkelse, varslings-puls, ad-hoc beslutningsstøtte.
// The presets call provision_survey_baseline_for_org + survey_org_templates
// inserts; the underlying RPCs handle the heavy lifting.

import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

registerStudioScope({
  scopeId: 'survey',
  label: 'Undersøkelser',
  singular: 'Undersøkelse',
  description:
    'Medarbeiderundersøkelser, varslings-puls og ad-hoc spørreundersøkelser.',
  accent: '#7c3aed',
  tint: '#f3e8ff',
  icon: 'BarChart3',
  sample: 'Medarbeiderundersøkelse 2026',
  order: 20,
})

async function provisionSurveyBaseline(values: Record<string, string | boolean>): Promise<void> {
  const { supabase } = await import('../../../src/lib/supabaseClient')
  const { resolveActiveOrgId } = await import('../../../src/lib/studio/resolveActiveOrgId')
  const orgId = await resolveActiveOrgId(supabase)
  if (!supabase || !orgId) return
  await supabase.rpc('provision_survey_baseline_for_org', { p_org_id: orgId })
  // Optional: kick off a draft survey row keyed by the chosen template
  const slug = String(values.templateSlug ?? '')
  if (slug) {
    await supabase.from('surveys').insert({
      organization_id: orgId,
      title: `Utkast: ${slug}`,
      status: 'draft',
      catalog_slug: slug,
    } as Record<string, unknown>)
  }
}

const PRESETS: SimplePreset[] = [
  {
    id: 'medarbeider',
    title: 'Medarbeiderundersøkelse',
    description:
      'Årlig MAU med 7 standardspørsmål (trivsel, samarbeid, leder, læring, varsling).',
    icon: '🧑‍🤝‍🧑',
    badge: 'ANBEFALT',
    wizard: {
      title: 'Medarbeiderundersøkelse',
      description: 'Aktivér katalog-malen og send ut.',
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
                'Medarbeiderundersøkelse dekker AML § 3-1 (systematisk HMS) og gir AMU et faktum-grunnlag til årsrapport § 7-2 (2) e.',
            },
          ],
        },
        {
          id: 'period',
          title: 'Periode',
          fields: [
            { id: 'year', label: 'År', kind: 'number', min: 2024, required: true },
            {
              id: 'anonymous',
              label: 'Anonymt',
              kind: 'checkbox',
              hint: 'Slår av rapport-personnivå for små segmenter.',
            },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [
            {
              id: '_a',
              label: '',
              kind: 'info',
              infoBody: 'Vi aktiverer mal-katalogen og oppretter et utkast i utboksen.',
            },
          ],
          onAdvance: async (v) => {
            await provisionSurveyBaseline({ ...v, templateSlug: 'medarbeider-aml-amu' })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {
        /* mutation runs in activate.onAdvance */
      },
    },
  },
  {
    id: 'varslings_puls',
    title: 'Varslings-puls',
    description: '5-minutters kort puls etter alvorlige hendelser — tre spørsmål.',
    icon: '📣',
    wizard: {
      title: 'Varslings-puls',
      colour: 'amber',
      steps: [
        {
          id: 'intro',
          title: 'Når brukes denne?',
          fields: [
            {
              id: '_intro',
              label: '',
              kind: 'info',
              infoBody:
                'Etter alvorlige hendelser, omorganisering eller nye varslinger — fanger umiddelbare reaksjoner.',
            },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Klikk Neste for å opprette puls-malen.' }],
          onAdvance: async (v) => {
            await provisionSurveyBaseline({ ...v, templateSlug: 'varslings-puls' })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'ad_hoc',
    title: 'Ad-hoc beslutningsstøtte',
    description: 'Fri-form undersøkelse for en konkret beslutning — du skriver spørsmålene selv.',
    icon: '🧠',
    wizard: {
      title: 'Ad-hoc beslutningsstøtte',
      colour: 'sky',
      steps: [
        {
          id: 'intro',
          title: 'Tema',
          fields: [
            { id: 'topic', label: 'Hva skal undersøkes?', kind: 'text', required: true, placeholder: 'F.eks. ny lønnsmodell' },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter en blank survey du kan utvide.' }],
          onAdvance: async (v) => {
            await provisionSurveyBaseline({ ...v, templateSlug: 'ad-hoc-decision' })
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
]

registerStudioKind({
  scopeId: 'survey',
  kindId: 'campaign',
  label: 'Undersøkelses-kampanje',
  simplePresets: PRESETS,
  advancedSchema: {
    fields: [
      { id: 'title', label: 'Tittel', kind: 'text', required: true },
      { id: 'anonymous', label: 'Anonym', kind: 'toggle' },
      { id: 'lawRefs', label: 'Lovreferanser', kind: 'law-ref-picker' },
    ],
  },
  embedder: () => import('./surveyEmbedder'),
  mutator: async (_input, ctx) => ({ row: { organizationId: ctx.organizationId }, rowTable: 'surveys' }),
  lawRefSlot: 'law_refs',
  packAware: true,
})
