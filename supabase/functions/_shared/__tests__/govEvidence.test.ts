// Snapshot + property tests for the idempotency-key helper in
// `_shared/govEvidence.ts`. The key is sha256(org|rule|run|event) and
// every gov edge function uses it as the de-dup hash against
// gov_notifications_outbox / workflow_runs. A drift here would silently
// double-submit personvernbrudd-meldinger, so the snapshot pins it.

import { assert, assertEquals, assertMatch, assertNotEquals } from '@std/assert'
import { buildIdempotencyKey, type CommonRequestBody } from '../govEvidence.ts'

const base: CommonRequestBody = {
  organization_id: '00000000-0000-0000-0000-000000000001',
  rule_id: '00000000-0000-0000-0000-000000000002',
  run_id: '00000000-0000-0000-0000-000000000003',
  event_name: 'test_event',
  payload: {},
}

Deno.test('buildIdempotencyKey is stable across calls with identical input', async () => {
  const k1 = await buildIdempotencyKey(base)
  const k2 = await buildIdempotencyKey({ ...base })
  const k3 = await buildIdempotencyKey({ ...base, payload: { ignored: 'field' } })
  assertEquals(k1, k2)
  // payload is not part of the key — only the four identity fields are.
  assertEquals(k1, k3)
})

Deno.test('buildIdempotencyKey diverges when any identity field changes', async () => {
  const k0 = await buildIdempotencyKey(base)
  const variants: Array<[string, CommonRequestBody]> = [
    ['org_id', { ...base, organization_id: '00000000-0000-0000-0000-0000000000aa' }],
    ['rule_id', { ...base, rule_id: '00000000-0000-0000-0000-0000000000bb' }],
    ['run_id', { ...base, run_id: '00000000-0000-0000-0000-0000000000cc' }],
    ['event_name', { ...base, event_name: 'other_event' }],
  ]
  for (const [label, v] of variants) {
    const k = await buildIdempotencyKey(v)
    assertNotEquals(k0, k, `changing ${label} must change the key`)
  }
})

Deno.test('buildIdempotencyKey returns a 64-char lowercase hex sha256', async () => {
  const k = await buildIdempotencyKey(base)
  assertEquals(k.length, 64, 'sha256 hex is 64 chars')
  assertMatch(k, /^[0-9a-f]{64}$/, 'must be lowercase hex')
})

Deno.test('buildIdempotencyKey snapshot — fixed input', async () => {
  // Hardcoded so any change in the canonical-input format (delimiter, field
  // order, casing) breaks the test instead of silently producing dupes.
  const expected = '89366d0b0450b1d81b01f781350efad9042a6c867a31f5728da525d2eb1f79b0'
  const actual = await buildIdempotencyKey(base)
  assertEquals(actual, expected)
  assert(actual === expected)
})
