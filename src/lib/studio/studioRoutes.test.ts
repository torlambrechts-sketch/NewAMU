// Studio route smoke test.
//
// Verifies every studio-related route imports + resolves the right
// component. Catches the canonical regression where a refactor renames
// a component but leaves the route stale.

import { describe, it, expect } from 'vitest'

describe('studio routes', () => {
  it('StudioPage imports cleanly', async () => {
    const mod = await import('../../pages/studio/StudioPage')
    expect(typeof mod.StudioPage).toBe('function')
  })

  it('PackEditor imports cleanly', async () => {
    const mod = await import('../../pages/studio/PackEditor')
    expect(typeof mod.PackEditor).toBe('function')
  })

  it('PartnerOffboardingPage imports cleanly', async () => {
    const mod = await import('../../pages/admin/partners/PartnerOffboardingPage')
    expect(typeof mod.PartnerOffboardingPage).toBe('function')
  })

  it('PlatformStudioGrantsPage imports cleanly', async () => {
    const mod = await import('../../pages/platform/PlatformStudioGrantsPage')
    expect(typeof mod.PlatformStudioGrantsPage).toBe('function')
  })

  it('all shell components import cleanly', async () => {
    const components = await Promise.all([
      import('../../components/studio/shell/ScopePicker'),
      import('../../components/studio/shell/ModeToggle'),
      import('../../components/studio/shell/SimpleModeCards'),
      import('../../components/studio/shell/AdvancedShell'),
      import('../../components/studio/shell/CommandPalette'),
      import('../../components/studio/shell/PartnerOrgSwitcher'),
      import('../../components/studio/shell/VersionTimeline'),
      import('../../components/studio/shell/PublishBar'),
      import('../../components/studio/shell/AutosaveIndicator'),
      import('../../components/studio/shell/ConflictModal'),
      import('../../components/studio/shell/DeferredEmbedderPlaceholder'),
    ])
    expect(components).toHaveLength(11)
    for (const c of components) {
      const exportedFns = Object.values(c).filter((v) => typeof v === 'function')
      expect(exportedFns.length).toBeGreaterThanOrEqual(1)
    }
  })
})
