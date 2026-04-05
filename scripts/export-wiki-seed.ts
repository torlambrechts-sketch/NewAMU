/**
 * Generates supabase/seed-data/wiki-seed.json from src/data/documentTemplates.ts
 * Run: npx tsx scripts/export-wiki-seed.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { LEGAL_COVERAGE, PAGE_TEMPLATES, SEED_SPACES } from '../src/data/documentTemplates'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../supabase/seed-data')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'wiki-seed.json')
writeFileSync(
  outPath,
  JSON.stringify(
    {
      version: 1,
      seedSpaces: SEED_SPACES,
      pageTemplates: PAGE_TEMPLATES,
      legalCoverage: LEGAL_COVERAGE,
    },
    null,
    2,
  ),
  'utf8',
)
console.log('Wrote', outPath)
