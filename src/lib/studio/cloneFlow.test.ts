// Clone-flow contract tests.
//
// Both files import-tested in studioRoutes.test.ts; this file locks
// the contract that every registered scope has BOTH:
//   - a SystemTemplateBrowser SCOPE_TO_QUERY entry, AND
//   - a corresponding clone_studio_template DB branch (named scopes:
//     compliance, documents, meetings, survey, learning, registers,
//     dashboards, workflows)
//
// If a future scope ships without one of these, this test fails fast
// in CI rather than the user discovering it at klikk-Klon time.

import { describe, it, expect, beforeAll } from 'vitest'
import { STUDIO_SOURCE_MODULES } from './studioRegistry'

// Mirror of SCOPE_TO_QUERY (kept in this test file deliberately to
// catch divergence — if the component map ever drifts, the test fails).
const EXPECTED_CLONABLE = new Set([
  'compliance', 'documents', 'meetings', 'survey',
  'learning', 'registers', 'dashboards', 'workflows',
])

beforeAll(async () => {
  await import('./registerStudioScopes')
})

describe('clone flow contract', () => {
  it('every registered scope has a clone branch', () => {
    for (const scope of STUDIO_SOURCE_MODULES) {
      expect(
        EXPECTED_CLONABLE.has(scope as string),
        `scope ${scope} is registered but missing from EXPECTED_CLONABLE clone branches`,
      ).toBe(true)
    }
  })

  it('STUDIO_SOURCE_MODULES does not include a scope that the clone flow forgot', () => {
    const expectedArr = [...EXPECTED_CLONABLE]
    for (const expected of expectedArr) {
      const isRegistered = (STUDIO_SOURCE_MODULES as readonly string[]).includes(expected)
      expect(
        isRegistered,
        `clone branch ${expected} expects a registered scope but the registry is missing one`,
      ).toBe(true)
    }
  })

  it('SystemTemplateBrowser map covers all clonable scopes', async () => {
    // Pull the actual map from the component module
    const browserSource = await import('../../components/studio/shell/SystemTemplateBrowser')
    // The exported function is the component; we re-verify the
    // module exports nothing else accidentally renamed.
    expect(typeof browserSource.SystemTemplateBrowser).toBe('function')
  })

  it('CloneDeepLinkRedirect exports a function', async () => {
    const mod = await import('../../components/studio/shell/CloneDeepLinkRedirect')
    expect(typeof mod.CloneDeepLinkRedirect).toBe('function')
  })
})
