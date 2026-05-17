// Tests for workflow-dispatch surfaces that are testable without touching
// Supabase. Right now the only pure helper that fans out across every
// gov edge function is `buildIdempotencyKey` (covered separately in
// govEvidence.test.ts). The Datatilsynet breach handler in
// `gov-datatilsynet-breach/index.ts` builds its canonical payload inline
// inside `Deno.serve`, so there's no extractable sanitization function
// to import in isolation — anonymous-alert filtering will become testable
// once that logic moves into a helper (tracked below).
//
// What we DO test here:
//   1. The sha256 composition that the dispatcher uses for de-dup is
//      compatible with the `buildIdempotencyKey` format consumed by the
//      outbox worker (regression guard against the two drifting apart).
//   2. A skipped marker test pinning the anonymous-alert sanitization
//      requirement so the next refactor can flip it on.

import { assert, assertEquals, assertMatch } from '@std/assert'
import { buildIdempotencyKey } from '../govEvidence.ts'
import { sha256Hex } from '../maskinporten.ts'

Deno.test('dispatcher idempotency composition matches govEvidence helper', async () => {
  const parts = {
    organization_id: 'org-aaa',
    rule_id: 'rule-bbb',
    run_id: 'run-ccc',
    event_name: 'meld_personvernbrudd_datatilsynet',
  }
  const direct = await sha256Hex(
    `${parts.organization_id}|${parts.rule_id}|${parts.run_id}|${parts.event_name}`,
  )
  const viaHelper = await buildIdempotencyKey({ ...parts, payload: {} })
  assertEquals(direct, viaHelper, 'dispatcher and helper must agree on canonical input')
  assertMatch(viaHelper, /^[0-9a-f]{64}$/)
})

Deno.test('idempotency key composition is order-sensitive', async () => {
  // The format is pipe-delimited, so a transposition must produce a
  // different hash — otherwise dispatch could collide across rules/runs.
  const swapped = await sha256Hex('org-aaa|run-ccc|rule-bbb|meld_personvernbrudd_datatilsynet')
  const correct = await buildIdempotencyKey({
    organization_id: 'org-aaa',
    rule_id: 'rule-bbb',
    run_id: 'run-ccc',
    event_name: 'meld_personvernbrudd_datatilsynet',
    payload: {},
  })
  assert(swapped !== correct, 'transposed input must produce a different key')
})

Deno.test.ignore(
  'TODO: anonymous-alert payloads must omit submitter_id (extract helper from gov-datatilsynet-breach)',
  () => {
    // Currently the canonical-payload construction lives inline inside the
    // `Deno.serve` handler in `gov-datatilsynet-breach/index.ts` (see lines
    // ~100-113, the `canonical` object built with JSON.stringify). To test
    // the sanitization rule "anonymous breach reports must not include
    // submitter_id" the relevant block needs to be extracted into a pure
    // `buildBreachPayload(input): Canonical` helper, then re-imported here.
    // Tracked as part of the P2-E payload-builder refactor.
  },
)
