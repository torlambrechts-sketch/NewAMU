#!/usr/bin/env node
/**
 * i18n key-parity check (P3-#20).
 *
 * Loads every `*.json` file under src/lib/i18n/locales/ and verifies the
 * key tree is identical across all locales. Diverging keys mean a
 * translation is missing or a stray key sneaked in — either way, ship
 * blocker.
 *
 * Usage:  node scripts/i18n-key-parity.mjs
 * CI:     add to lint pipeline once more locales exist.
 *
 * Exits 0 on success, 1 on any divergence.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = join(here, '..', 'src', 'lib', 'i18n', 'locales')

/** Recursively flatten { a: { b: 'x' } } → ['a.b'] */
function flatten(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, path))
    } else {
      out.push(path)
    }
  }
  return out.sort()
}

const files = readdirSync(localesDir).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
  console.error('No locale files found in', localesDir)
  process.exit(1)
}

const bundles = {}
for (const f of files) {
  const code = f.replace(/\.json$/, '')
  const raw = readFileSync(join(localesDir, f), 'utf8')
  bundles[code] = flatten(JSON.parse(raw))
}

const locales = Object.keys(bundles)
const [base, ...others] = locales
const baseKeys = new Set(bundles[base])

let diverged = false
for (const other of others) {
  const otherKeys = new Set(bundles[other])
  const missing = [...baseKeys].filter((k) => !otherKeys.has(k))
  const extra = [...otherKeys].filter((k) => !baseKeys.has(k))
  if (missing.length || extra.length) {
    diverged = true
    console.error(`\n[${other}] vs [${base}]`)
    if (missing.length) {
      console.error('  missing keys:')
      for (const k of missing) console.error(`    - ${k}`)
    }
    if (extra.length) {
      console.error('  extra keys (not in base):')
      for (const k of extra) console.error(`    + ${k}`)
    }
  }
}

if (diverged) {
  console.error(`\ni18n key parity FAILED across locales: ${locales.join(', ')}`)
  process.exit(1)
}

console.log(`i18n key parity OK — ${baseKeys.size} keys across ${locales.length} locales (${locales.join(', ')})`)
