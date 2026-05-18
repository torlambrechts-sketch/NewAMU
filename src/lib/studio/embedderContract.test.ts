// Embedder-contract conformance test.
//
// Loads every registered scope, resolves the kind's embedder via the
// declared dynamic-import factory, and asserts that:
//   1. The factory resolves to a module with a default export.
//   2. The default export is a function (a React component constructor).
//
// Catches the canonical bug where a scope file forgets to wire its
// embedder or returns a wrong-shape module. Doesn't render the
// components (jsdom not wired into this baseline), only the contract.

import { describe, it, expect, beforeAll } from 'vitest'
import {
  listStudioKinds,
  listStudioScopes,
  STUDIO_SOURCE_MODULES,
} from './studioRegistry'

beforeAll(async () => {
  // Side-effect import the aggregator so all scope files have registered.
  await import('./registerStudioScopes')
})

describe('embedder contract', () => {
  it('every expected scope is registered', () => {
    const scopeIds = listStudioScopes().map((s) => s.scopeId)
    for (const expected of STUDIO_SOURCE_MODULES) {
      expect(scopeIds).toContain(expected)
    }
  })

  it.each(STUDIO_SOURCE_MODULES as readonly string[])(
    'scope %s loads at least one kind with a valid embedder factory',
    async (scopeId) => {
      const kinds = listStudioKinds(scopeId)
      expect(kinds.length, `${scopeId} has no kinds`).toBeGreaterThanOrEqual(1)

      for (const kind of kinds) {
        const mod = await kind.embedder()
        expect(mod).toBeTruthy()
        expect(typeof mod.default).toBe('function')
      }
    },
  )

  it('every kind ships a mutator that returns { row, rowTable }', async () => {
    for (const kind of listStudioKinds()) {
      const ctx = {
        organizationId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      }
      const result = await kind.mutator({}, ctx)
      expect(result).toHaveProperty('row')
      expect(result).toHaveProperty('rowTable')
      expect(typeof result.rowTable).toBe('string')
    }
  })

  it('every kind declares a valid lawRefSlot', () => {
    const valid = new Set(['law_refs', 'legal_basis', 'regulation_ids', 'law_refs_jsonb', 'none'])
    for (const kind of listStudioKinds()) {
      expect(valid.has(kind.lawRefSlot), `${kind.scopeId}::${kind.kindId} has invalid lawRefSlot=${kind.lawRefSlot}`).toBe(true)
    }
  })
})
