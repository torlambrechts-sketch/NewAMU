// Studio Builder — registry round-trip test.
//
// First Vitest baseline test. Locks the side-effect-import + register-by-id
// contract that every scope file relies on, so a future refactor that
// changes the registry shape fails fast in CI rather than silently
// dropping kinds at runtime.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerStudioScope,
  registerStudioKind,
  getStudioScope,
  getStudioKind,
  listStudioScopes,
  listStudioKinds,
  _internalEnumerateKindsForAssertion,
} from './studioRegistry'
import type { StudioScope, StudioKindRegistration } from './studioTypes'

const FIXTURE_SCOPE: StudioScope = {
  scopeId: 'test_scope',
  label: 'Test scope',
  singular: 'Test',
  description: 'Fixture for round-trip tests',
  accent: '#000000',
  tint: '#ffffff',
  icon: 'TestIcon',
  sample: 'Sample',
  order: 999,
}

const FIXTURE_KIND: StudioKindRegistration = {
  scopeId: 'test_scope',
  kindId: 'test_kind',
  label: 'Test kind',
  simplePresets: [
    {
      id: 'preset_a',
      title: 'Preset A',
      description: 'Fixture preset',
      icon: '🧪',
      wizard: {
        title: 'Test wizard',
        steps: [
          { id: 'step1', title: 'Step', fields: [{ id: 'a', label: 'A', kind: 'text' }] },
        ],
        onSubmit: () => {},
      },
    },
  ],
  advancedSchema: {
    fields: [{ id: 'a', label: 'A', kind: 'text' }],
  },
  embedder: () => Promise.resolve({ default: () => null }) as ReturnType<StudioKindRegistration['embedder']>,
  mutator: async () => ({ row: {}, rowTable: 'test_table' }),
  lawRefSlot: 'none',
  packAware: false,
}

describe('studioRegistry', () => {
  beforeEach(() => {
    // Re-register the fixture on each test so prior tests don't pollute.
    registerStudioScope(FIXTURE_SCOPE)
    registerStudioKind(FIXTURE_KIND)
  })

  it('registers and reads back a scope', () => {
    const scope = getStudioScope('test_scope')
    expect(scope).not.toBeNull()
    expect(scope?.label).toBe('Test scope')
    expect(scope?.accent).toBe('#000000')
  })

  it('registers and reads back a kind', () => {
    const kind = getStudioKind('test_scope', 'test_kind')
    expect(kind).not.toBeNull()
    expect(kind?.simplePresets).toHaveLength(1)
    expect(kind?.advancedSchema.fields).toHaveLength(1)
  })

  it('lists scopes sorted by order', () => {
    const scopes = listStudioScopes()
    expect(scopes.length).toBeGreaterThan(0)
    // Sort property: ascending order
    for (let i = 1; i < scopes.length; i++) {
      expect(scopes[i].order).toBeGreaterThanOrEqual(scopes[i - 1].order)
    }
  })

  it('filters kinds by scope', () => {
    const all = listStudioKinds()
    const filtered = listStudioKinds('test_scope')
    expect(filtered.length).toBeLessThanOrEqual(all.length)
    for (const kind of filtered) {
      expect(kind.scopeId).toBe('test_scope')
    }
  })

  it('the prebuild invariant holds for the fixture (Simple+Advanced)', () => {
    const kinds = _internalEnumerateKindsForAssertion()
    const ours = kinds.find((k) => k.scopeId === 'test_scope' && k.kindId === 'test_kind')
    expect(ours).toBeDefined()
    expect(ours!.simplePresets.length).toBeGreaterThanOrEqual(1)
    expect(ours!.advancedSchema.fields.length).toBeGreaterThanOrEqual(1)
  })

  it('returns null for an unregistered scope', () => {
    expect(getStudioScope('does_not_exist')).toBeNull()
    expect(getStudioKind('does_not_exist', 'whatever')).toBeNull()
  })
})
