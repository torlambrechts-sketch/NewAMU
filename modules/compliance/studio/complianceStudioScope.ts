// Compliance scope — Studio Builder Phase 1.
//
// Task 0.10: relocates the three existing compliance wizards (HMS-grunnmur,
// Varsling, AMU-etablering) from /compliance-studio into the unified
// /studio shell as the first content scope. Factories live alongside this
// file at ./wizards/factories.ts; the catalog at ./wizards/catalog.ts
// stays for the wizard-key-stability constraint
// (compliance_wizard_runs.wizard_key persists keys verbatim).
//
// Side-effect import: src/lib/studio/registerStudioScopes.ts re-exports
// this file so the studio shell sees the scope.

import { ClipboardList } from 'lucide-react'
import { registerStudioScope, registerStudioKind } from '../../../src/lib/studio/studioRegistry'
import {
  makeAmuEtableringWizard,
  makeHmsGrunnmurWizard,
  makeVarslingWizard,
} from './wizards/factories'
import type { SimplePreset } from '../../../src/lib/studio/studioTypes'

// ────────────────────────────────────────────────────────────────────
// Scope registration
// ────────────────────────────────────────────────────────────────────

registerStudioScope({
  scopeId: 'compliance',
  label: 'Sjekklister og samsvar',
  singular: 'Sjekkliste',
  description:
    'AML/AMU/ISO-pakker, sjekklister, internkontroll og periodiske gjennomganger.',
  accent: '#1a3d32',
  tint: '#e8f0eb',
  icon: 'ClipboardList',
  sample: 'HMS-grunnmur',
  order: 10,
  recommended: true,
})

// ────────────────────────────────────────────────────────────────────
// Preset → wizard adapter
// ────────────────────────────────────────────────────────────────────
// The existing factories expect StudioWizardDeps (supabase, organizationId,
// coverage, employeeCount, onCompleted). At preset-time we don't have any
// of those — they come from the studio shell's runtime context. We expose
// the wizard wrapped with placeholder deps and rely on the picker passing
// onSubmit through; the underlying mutation RPCs read auth.uid() / org
// from supabase JWT, so the placeholder values are only used for picker-
// options building (coverage) which gracefully falls back to "no
// pre-defined resources" when empty.

const PLACEHOLDER_DEPS = {
  supabase: null,
  organizationId: undefined,
  coverage: new Map(),
  employeeCount: 1,
  onCompleted: () => {
    /* overridden by PresetPicker wrap */
  },
} as const

function adaptPreset(
  id: string,
  title: string,
  description: string,
  icon: string,
  badge: string | undefined,
  factory: typeof makeHmsGrunnmurWizard,
): SimplePreset {
  const wizard = factory(PLACEHOLDER_DEPS)
  // Strip the factory's own id; PresetPicker re-stamps with a fresh run-id.
  // Drop onSubmit — picker wraps with telemetry + completion.
  const { onSubmit: _drop, ...rest } = wizard
  void _drop
  return {
    id,
    title,
    description,
    icon,
    badge,
    wizard: {
      ...rest,
      onSubmit: (values) => {
        // Bind the active org at submit-time via dynamic import to avoid a
        // boot-time circular dep with useOrgSetupContext.
        void (async () => {
          const { supabase } = await import('../../../src/lib/supabaseClient')
          if (!supabase) return
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .single()
          const orgId = (profile as { organization_id?: string } | null)?.organization_id
          if (!orgId) return
          const wizardDef = factory({
            supabase,
            organizationId: orgId,
            coverage: new Map(),
            employeeCount: Number(values.employeeCount ?? 1) || 1,
            onCompleted: () => {
              /* PresetPicker.onComplete fires telemetry */
            },
          })
          // Run the activate step's side-effect (provisioning RPCs).
          const activate = wizardDef.steps.find((s) => s.id === 'activate')
          if (activate?.onAdvance) await activate.onAdvance(values)
        })()
      },
    },
  }
}

// ────────────────────────────────────────────────────────────────────
// Kind registration — 1 kind ("baseline") with 3 presets
// ────────────────────────────────────────────────────────────────────
// The 3 wizards all produce the same shape of output (provisioned
// baseline content tagged with §-er), so they live as 3 presets under
// one kind. Adding more compliance kinds (e.g. "Per-template authoring")
// happens in Phase 2a when the Advanced inspector lands.

registerStudioKind({
  scopeId: 'compliance',
  kindId: 'baseline',
  label: 'Baseline-pakker (AML/IK-f/Forskrift)',
  icon: 'ClipboardList',
  simplePresets: [
    adaptPreset(
      'hms_grunnmur',
      'HMS-grunnmur',
      'Etabler systematisk HMS-arbeid, internkontroll, opplæring og BHT. Kjernen i AML.',
      '🏛️',
      'KRITISK',
      makeHmsGrunnmurWizard,
    ),
    adaptPreset(
      'varsling',
      'Varsling',
      'Skriftlig varslingsrutine, ekstern kanal, vern mot gjengjeldelse.',
      '📣',
      'KRITISK',
      makeVarslingWizard,
    ),
    adaptPreset(
      'amu_etablering',
      'AMU — etablering',
      'Arbeidsmiljøutvalg med årshjul, ansvarsfordeling og dokumenter.',
      '🤝',
      'KRITISK',
      makeAmuEtableringWizard,
    ),
  ],
  advancedSchema: {
    fields: [
      {
        id: 'pack',
        label: 'Pakke',
        kind: 'select',
        required: true,
        options: [
          { value: 'aml-amu', label: 'AML / AMU (kjerne)' },
          { value: 'iso-45001', label: 'ISO 45001 (HMS-styring)' },
        ],
      },
      {
        id: 'lawRefs',
        label: 'Lovreferanser',
        kind: 'law-ref-picker',
        hint: 'Velg paragrafene denne baseline-pakken dekker.',
      },
    ],
  },
  embedder: () => import('./complianceEmbedder'),
  mutator: async () => ({
    row: {},
    rowTable: 'compliance_checklist_templates',
  }),
  lawRefSlot: 'law_refs',
  packAware: true,
})

// ClipboardList icon import kept so tree-shaking doesn't drop the registry side effect.
void ClipboardList
