import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

/* Strategy v2 smoke sweep: log in as the seeded demo admin, visit every Strategy
   surface, and assert each renders (the scoped `.stratools` root mounts, no route
   error-boundary, no uncaught page error). A screenshot of each is written to
   e2e/__screens__ for visual review. */

const EMAIL = process.env.E2E_EMAIL || 'demo@klarert.app'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoStrategy!2026'
const SHOTS = 'e2e/__screens__'

type Surface = { name: string; path: string }
const SURFACES: Surface[] = [
  { name: 'my-work', path: '/planlegging/mitt-arbeid' },
  { name: 'foundation', path: '/planlegging/foundation' },
  { name: 'objectives', path: '/planlegging/maal?view=tree' },
  { name: 'strategy-map', path: '/planlegging/maal?view=map' },
  { name: 'dashboard', path: '/planlegging/strategi-dashbord' },
  { name: 'alignment', path: '/planlegging/justering' },
  { name: 'frameworks', path: '/planlegging/frameworks' },
  { name: 'whiteboard', path: '/planlegging/whiteboard' },
  { name: 'assessments', path: '/planlegging/assessments' },
  { name: 'initiatives', path: '/planlegging/initiativer?view=overview' },
  { name: 'projects', path: '/planlegging/initiativer?view=projects' },
  { name: 'timeline', path: '/planlegging/initiativer?view=gantt' },
  { name: 'roadmap', path: '/planlegging/initiativer?view=roadmap' },
  { name: 'kanban', path: '/planlegging/initiativer?view=kanban' },
  { name: 'tasks', path: '/planlegging/initiativer?view=tasks' },
  { name: 'health', path: '/planlegging/initiativer?view=health' },
  { name: 'dependencies', path: '/planlegging/initiativer?view=deps' },
  { name: 'raci', path: '/planlegging/initiativer?view=raci' },
  { name: 'data-sources', path: '/planlegging/datakilder' },
  { name: 'checkins', path: '/planlegging/kadens-strategi?view=checkins' },
  { name: 'reviews', path: '/planlegging/kadens-strategi?view=reviews' },
  { name: 'decision-log', path: '/planlegging/kadens-strategi?view=history' },
  { name: 'reports', path: '/planlegging/rapporter' },
  { name: 'accountability', path: '/planlegging/ansvarlighet' },
  { name: 'settings', path: '/planlegging/strategi-innstillinger' },
]

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Logg inn' }).click()
  // Wait until we've left the login page (auth + org context settled).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
  await page.waitForLoadState('networkidle').catch(() => {})
}

test('Strategy v2 — every surface renders for the demo admin', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true })

  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await login(page)

  const failures: string[] = []
  for (const s of SURFACES) {
    const before = pageErrors.length
    await page.goto(s.path, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    // give hooks a beat to resolve + render
    await page.locator('.stratools').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(400)

    const hasRoot = await page.locator('.stratools').first().isVisible().catch(() => false)
    const boundary = await page.getByText(/Kunne ikke vise/i).count().catch(() => 0)
    const newErrors = pageErrors.slice(before)

    await page.screenshot({ path: `${SHOTS}/${s.name}.png`, fullPage: true }).catch(() => {})

    if (!hasRoot) failures.push(`${s.name}: .stratools root not visible (${s.path})`)
    if (boundary > 0) failures.push(`${s.name}: route error boundary shown (${s.path})`)
    if (newErrors.length) failures.push(`${s.name}: pageerror — ${newErrors.join(' | ')}`)
    // eslint-disable-next-line no-console
    console.log(`${failures.some((f) => f.startsWith(s.name)) ? '✗' : '✓'} ${s.name.padEnd(14)} ${s.path}`)
  }

  expect(failures, `Strategy surfaces with problems:\n${failures.join('\n')}`).toEqual([])
})
