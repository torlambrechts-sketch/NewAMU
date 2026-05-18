#!/usr/bin/env tsx
// Studio Builder — prebuild assertion for kind-registry parity.
//
// Run by `pnpm prebuild` (and explicitly in CI). Verifies that every
// kind registered via registerStudioKind() ships BOTH:
//   - simplePresets.length >= 1    (the Simple-mode entry point)
//   - advancedSchema.fields.length >= 1   (the Advanced inspector)
//
// A kind that's advanced-only or simple-only is a bug — Simple users
// would have no path to instantiate the kind, or Advanced users would
// have nothing to edit. The registry contract (specs/studio-builder.md §4)
// promises both, so the build should fail loudly when either is missing.
//
// The script imports the studio registry via the same side-effect
// pattern the app uses, walks _internalEnumerateKindsForAssertion(),
// and exits 1 on any violation. Output names the offending scope + kind
// id so the failure is debuggable from the CI log.
//
// Spec: specs/studio-builder.md §5 Phase 0 Task 0.7.

import { _internalEnumerateKindsForAssertion, listStudioScopes, STUDIO_SOURCE_MODULES } from '../src/lib/studio/studioRegistry'

// ────────────────────────────────────────────────────────────────────
// 1. Import every scope file so they register
// ────────────────────────────────────────────────────────────────────
// Scope files live at modules/<scope>/studio/<scope>StudioScope.ts.
// We try-import each one; missing files are logged but not fatal (Phase 1
// will ship the first scope; the rest land per-phase). Once all 8 modules
// have a scope file, this loop will fail-fast for any missing one.

const expectedScopes = [...STUDIO_SOURCE_MODULES]

async function importScopes(): Promise<{ imported: string[]; missing: string[] }> {
  const imported: string[] = []
  const missing: string[] = []
  for (const scopeId of expectedScopes) {
    const path = `../modules/${scopeId}/studio/${scopeId}StudioScope`
    try {
      await import(path)
      imported.push(scopeId)
    } catch {
      // Phase 1 ships compliance scope first; others land per spec phasing.
      // Treat as "not yet shipped" rather than a hard error.
      missing.push(scopeId)
    }
  }
  return { imported, missing }
}

// ────────────────────────────────────────────────────────────────────
// 2. Assert kind-registry parity invariants
// ────────────────────────────────────────────────────────────────────

type Violation = {
  scopeId: string
  kindId: string
  reason: string
}

function findViolations(): Violation[] {
  const violations: Violation[] = []
  const kinds = _internalEnumerateKindsForAssertion()
  for (const kind of kinds) {
    if (kind.simplePresets.length < 1) {
      violations.push({
        scopeId: kind.scopeId,
        kindId: kind.kindId,
        reason: 'simplePresets.length must be >= 1 (Simple-mode users need an entry point)',
      })
    }
    if (kind.advancedSchema.fields.length < 1) {
      violations.push({
        scopeId: kind.scopeId,
        kindId: kind.kindId,
        reason: 'advancedSchema.fields.length must be >= 1 (Advanced inspector needs at least one field)',
      })
    }
  }
  return violations
}

// ────────────────────────────────────────────────────────────────────
// 3. Run + report
// ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { imported, missing } = await importScopes()
  const scopes = listStudioScopes()
  const kinds = _internalEnumerateKindsForAssertion()
  const violations = findViolations()

  console.log(`[studio:assert] scopes imported: ${imported.length} / ${expectedScopes.length}`)
  console.log(`[studio:assert] scopes registered: ${scopes.length}`)
  console.log(`[studio:assert] kinds registered: ${kinds.length}`)
  if (missing.length > 0) {
    console.log(`[studio:assert] scopes not yet shipped (OK — per spec phasing):`)
    for (const m of missing) console.log(`  · ${m}  →  modules/${m}/studio/${m}StudioScope.ts`)
  }

  if (violations.length > 0) {
    console.error(`[studio:assert] ${violations.length} violation(s):`)
    for (const v of violations) {
      console.error(`  ✗ ${v.scopeId}::${v.kindId}`)
      console.error(`      ${v.reason}`)
    }
    process.exit(1)
  }

  console.log(`[studio:assert] OK — every registered kind has Simple preset + Advanced schema`)
}

main().catch((err) => {
  console.error('[studio:assert] failed:', err)
  process.exit(1)
})
