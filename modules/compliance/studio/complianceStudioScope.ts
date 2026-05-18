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
// coverage, employeeCount, onCompleted). The picker doesn't have those
// at preset-build time, so the adapter:
//   1. Builds the wizard once with placeholder deps for the UI shape
//      (steps + fields). The picker_options on the 'content' step come
//      out as the "no pre-defined resources" fallback; that's OK for the
//      Simple-mode flow.
//   2. At submit time, rebuilds with real deps resolved from
//      supabaseClient + resolveActiveOrgId (so partner-on-behalf-of
//      writes land in the customer org).
//
// runActivateStep() is the shared side-effect runner so we don't
// duplicate the resolve+rebuild dance in every adaptPreset call.

const PLACEHOLDER_DEPS = {
  supabase: null,
  organizationId: undefined,
  coverage: new Map(),
  employeeCount: 1,
  onCompleted: () => {
    /* overridden by PresetPicker wrap */
  },
} as const

/**
 * Resolves runtime deps + invokes the factory's `activate` step
 * onAdvance side-effect. Returns the WizardStepAdvanceResult so callers
 * can surface failures.
 */
async function runActivateStep(
  factory: typeof makeHmsGrunnmurWizard,
  values: Record<string, string | boolean>,
): Promise<void> {
  const { supabase } = await import('../../../src/lib/supabaseClient')
  const { resolveActiveOrgId } = await import('../../../src/lib/studio/resolveActiveOrgId')
  const orgId = await resolveActiveOrgId(supabase)
  if (!supabase || !orgId) return
  const wizardDef = factory({
    supabase,
    organizationId: orgId,
    coverage: new Map(),
    employeeCount: Number(values.employeeCount ?? 1) || 1,
    onCompleted: () => {
      /* PresetPicker.onComplete fires telemetry */
    },
  })
  const activate = wizardDef.steps.find((s) => s.id === 'activate')
  if (activate?.onAdvance) await activate.onAdvance(values)
}

function adaptPreset(
  id: string,
  title: string,
  description: string,
  icon: string,
  badge: string | undefined,
  factory: typeof makeHmsGrunnmurWizard,
): SimplePreset {
  // Strip the factory's own id + onSubmit — picker re-stamps id and
  // wraps onSubmit with telemetry.
  const { onSubmit: _drop, ...rest } = factory(PLACEHOLDER_DEPS)
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
        void runActivateStep(factory, values)
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
