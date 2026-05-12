# Testing setup — vitest + React Testing Library

**Forfatter:** Senior dev
**Status:** Setup-instruks — krever pakke-installasjon
**Avhengighet for:** Fase 5 sprint 2 og fremover

NewAMU har 0% test-dekning. Senior-dev review (specs/fase5-utestaaende-plan.md §7) flagget dette som blokker før fase 6. Denne specen dokumenterer oppsettet — kjør kommandoene under FØR videre testing-PRs.

---

## 1. Installasjon

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom \
  @types/node
```

---

## 2. Konfigurasjon

### 2.1 `vitest.config.ts` (ny fil i repo-root)

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'modules/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'supabase/functions/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

### 2.2 `vitest.setup.ts` (ny fil i repo-root)

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

### 2.3 `package.json` scripts

Legg til i `scripts`:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage"
}
```

---

## 3. Test-skjelett

Plassering: ved siden av fil-en som testes, med `.test.tsx`-suffiks.

### Eksempel — `GdprBreachAdminPanel.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GdprBreachAdminPanel } from './GdprBreachAdminPanel'

// Mock useOrgSetupContext
vi.mock('../../hooks/useOrgSetupContext', () => ({
  useOrgSetupContext: () => ({
    supabase: createMockSupabase(),
    organization: { id: 'org-1' },
    profile: { id: 'user-1', is_org_admin: true },
    user: { id: 'user-1' },
  }),
}))

function createMockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
  }
}

describe('GdprBreachAdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('viser tomstatus når det ikke finnes brudd', async () => {
    render(<GdprBreachAdminPanel />)
    await waitFor(() => {
      expect(screen.getByText(/Ingen registrerte brudd/i)).toBeInTheDocument()
    })
  })

  it('viser admin-warning hvis bruker ikke er org-admin', async () => {
    // Override mock
    // ...
  })

  it('72-timers-fristen vises rødt ved < 24 timer', async () => {
    // Render med mocked brudd-record som har deadline om 12 timer
    // assert at deadline-element har class 'text-red-700'
  })

  it('status-overgang detected → investigating fungerer', async () => {
    const user = userEvent.setup()
    render(<GdprBreachAdminPanel />)
    // ... mer test
  })
})
```

---

## 4. Tester som skal være på plass FØR fase 6

### Kritiske admin-paneler (compliance-risiko)
- [ ] `GdprBreachAdminPanel.test.tsx` — 72-timers deadline-rendering, status-overganger
- [ ] `GdprSubjectRequestsAdminPanel.test.tsx` — 30-dagers deadline, identitets-verifikasjon
- [ ] `FunctionalRolesAdminPanel.test.tsx` — multi_incumbent-håndhevelse, terskel-deteksjon
- [ ] `IntegrationsAdminPanel.test.tsx` — config-skjema, enable/disable

### Kritiske dashboards
- [ ] `useComplianceDatasets.test.ts` — KPI-beregning, gap-deteksjon
- [ ] `useRoleComplianceDatasets.test.ts` — status-utledning fra training_matrix
- [ ] `useDashboardLayout.test.ts` — save-as, named views, default-flagg

### Edge functions (integration-tester)
- [ ] `role-compliance-reconcile/index.test.ts` — mot lokal Supabase
- [ ] `compliance-audit-pdf/index.test.ts` — PDF-struktur

---

## 5. Coverage-mål

- **Admin-paneler:** > 70% line coverage
- **Datasets hooks:** > 80% line coverage
- **Edge functions:** > 60% line coverage (integration-tester veier mer)

---

## 6. CI-integrasjon

Legg til i GitHub Actions (eller tilsvarende):

```yaml
- name: Run vitest
  run: npm run test:coverage

- name: Coverage threshold
  run: |
    # Faile hvis < threshold
```

---

## 7. Senior-dev anbefaling

**Ikke utsett.** Test-suite er forskjellen mellom å oppdage GDPR-deadline-feil før vs. etter pålegg fra Datatilsynet. Sett av 1.5 dager til oppsett + 0.5 dag per kritisk admin-panel.
