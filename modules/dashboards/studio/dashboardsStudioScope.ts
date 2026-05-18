// Dashboards scope — Studio Builder Phase 1.

import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

registerStudioScope({
  scopeId: 'dashboards',
  label: 'Dashboards',
  singular: 'Dashboard',
  description: 'Analyse-dashbord, KPI-tavler og publiserte rapporter.',
  accent: '#4338ca',
  tint: '#e0e7ff',
  icon: 'LayoutDashboard',
  sample: 'HMS-tavle for ledelsen',
  order: 70,
})

async function createDashboardLayout(values: Record<string, string | boolean>, kind: 'studio_preset_layout' | 'dashboard'): Promise<void> {
  const { supabase } = await import('../../../src/lib/supabaseClient')
  if (!supabase) return
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .single()
  const orgId = (profile as { organization_id?: string } | null)?.organization_id
  if (!orgId) return
  await supabase.from('dashboard_layouts').insert({
    organization_id: orgId,
    scope_id: String(values.scopeId ?? 'compliance_checklist'),
    name: String(values.name ?? 'Nytt dashboard'),
    kind,
    layout: [],
  } as Record<string, unknown>)
}

const PRESETS: SimplePreset[] = [
  {
    id: 'leder_kpi',
    title: 'Leder-KPI for ledelsens gjennomgang',
    description: 'KPI-tavle med avvik, sykefravær, opplæring og åpne pålegg — for AMU-årsrapport.',
    icon: '📊',
    badge: 'ANBEFALT',
    wizard: {
      title: 'Nytt leder-KPI-dashboard',
      colour: 'sky',
      steps: [
        {
          id: 'meta',
          title: 'Tittel',
          fields: [{ id: 'name', label: 'Navn', kind: 'text', required: true }],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter en preset-tavle med fire KPI-blokker.' }],
          onAdvance: async (v) => {
            await createDashboardLayout({ ...v, scopeId: 'hms_overview' }, 'studio_preset_layout')
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'gdpr_panel',
    title: 'GDPR-paneltavle',
    description: 'ROPA-status, subject-requests og databrudd — for personvernombudet.',
    icon: '🔒',
    wizard: {
      title: 'GDPR-paneltavle',
      colour: 'purple',
      steps: [
        {
          id: 'meta',
          title: 'Tittel',
          fields: [{ id: 'name', label: 'Navn', kind: 'text', required: true }],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter dashbord med GDPR-widgets.' }],
          onAdvance: async (v) => {
            await createDashboardLayout({ ...v, scopeId: 'compliance_checklist' }, 'studio_preset_layout')
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
  {
    id: 'blank',
    title: 'Tomt dashboard',
    description: 'Start fra blanke ark — du legger til widgets selv.',
    icon: '🧱',
    wizard: {
      title: 'Nytt dashboard',
      colour: 'neutral',
      steps: [
        {
          id: 'meta',
          title: 'Tittel + scope',
          fields: [
            { id: 'name', label: 'Navn', kind: 'text', required: true },
            {
              id: 'scopeId',
              label: 'Modul-scope',
              kind: 'select',
              required: true,
              options: [
                { value: 'compliance_checklist', label: 'Sjekklister' },
                { value: 'survey', label: 'Undersøkelser' },
                { value: 'tasks', label: 'Oppgaver' },
                { value: 'learning', label: 'Læring' },
                { value: 'documents', label: 'Dokumenter' },
                { value: 'meetings', label: 'Møter' },
                { value: 'hms_overview', label: 'HMS-oversikt' },
              ],
            },
          ],
        },
        {
          id: 'activate',
          title: 'Aktivere',
          fields: [{ id: '_a', label: '', kind: 'info', infoBody: 'Vi oppretter et tomt dashboard du kan utvide.' }],
          onAdvance: async (v) => {
            await createDashboardLayout(v, 'dashboard')
            return { ok: true }
          },
        },
      ],
      onSubmit: () => {},
    },
  },
]

registerStudioKind({
  scopeId: 'dashboards',
  kindId: 'layout',
  label: 'Dashboard-layout',
  simplePresets: PRESETS,
  advancedSchema: {
    fields: [
      { id: 'name', label: 'Navn', kind: 'text', required: true },
      { id: 'scopeId', label: 'Modul-scope', kind: 'select', options: [
        { value: 'compliance_checklist', label: 'Sjekklister' },
        { value: 'survey', label: 'Undersøkelser' },
        { value: 'tasks', label: 'Oppgaver' },
        { value: 'learning', label: 'Læring' },
        { value: 'hms_overview', label: 'HMS-oversikt' },
      ] },
      { id: 'layout', label: 'Layout', kind: 'layout-embed' },
    ],
  },
  embedder: () => import('./dashboardsEmbedder'),
  mutator: async () => ({ row: {}, rowTable: 'dashboard_layouts' }),
  lawRefSlot: 'none',
  packAware: false,
})
