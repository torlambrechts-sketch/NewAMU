import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Forbid Tailwind arbitrary-value hex literals (e.g. `bg-[#1a3d32]`) in
// designated central files. Brand colours have CSS variables defined in
// src/index.css — use `bg-[var(--ui-accent)]` etc. Plain JS string
// hexes (function default args, inline `style={{ color: '#xxx' }}`) are
// NOT matched since they often resolve in contexts where `var(...)`
// can't be used (chart libs, theme JS, etc.).
const noHexInClassNamesRule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "Literal[value=/\\[#[0-9a-fA-F]{3,6}/]",
      message:
        'Hex literal inside a Tailwind className. Use the matching CSS variable (bg-[var(--ui-accent)] etc.) so the design tokens stay the single source of truth. See src/index.css.',
    },
    {
      selector: "TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3,6}/]",
      message:
        'Hex literal inside a Tailwind className. Use the matching CSS variable (bg-[var(--ui-accent)] etc.) so the design tokens stay the single source of truth. See src/index.css.',
    },
  ],
}

// Forbid raw HTML form controls in module + component code.
// Design system requires <Button>, <StandardInput>, <StandardTextarea>, <SearchableSelect>.
// See DESIGN_SYSTEM.md §3.
const noRawControlsRule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'JSXOpeningElement[name.name="button"]',
      message:
        'Use <Button> from src/components/ui/Button instead of raw <button>. See DESIGN_SYSTEM.md §3.',
    },
    {
      selector: 'JSXOpeningElement[name.name="input"]',
      message:
        'Use <StandardInput> from src/components/ui/Input instead of raw <input>. See DESIGN_SYSTEM.md §3.',
    },
    {
      selector: 'JSXOpeningElement[name.name="select"]',
      message:
        'Use <SearchableSelect> from src/components/ui/SearchableSelect instead of raw <select>. See DESIGN_SYSTEM.md §3.',
    },
    {
      selector: 'JSXOpeningElement[name.name="textarea"]',
      message:
        'Use <StandardTextarea> from src/components/ui/Textarea instead of raw <textarea>. See DESIGN_SYSTEM.md §3.',
    },
  ],
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Enforce design-token usage for Tailwind className hex literals in
  // the central shell + page-chrome surfaces. Other files are left as
  // a follow-up cleanup — the ~1700 existing hex literals elsewhere
  // would flood lint output and need their own dedicated PR.
  {
    files: [
      'src/components/layout/AticsShell.tsx',
      'src/components/layout/ShellHeaderWidgets.tsx',
      'src/components/layout/PageContainer.tsx',
      'src/components/layout/CommandPalette.tsx',
      'src/components/layout/commandPaletteEntries.ts',
      'src/components/layout/aticsRailState.ts',
      'src/components/layout/aticsNavTypes.ts',
      'src/components/layout/aticsNavPerms.ts',
      'src/components/layout/recentPaths.ts',
      'src/components/module/ModulePageShell.tsx',
      'src/components/module/ModuleAnalyticsDashboard.tsx',
    ],
    rules: noHexInClassNamesRule,
  },
  // Enforce primitive usage in module + component code.
  {
    files: ['modules/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
    rules: noRawControlsRule,
  },
  // Whitelist: the primitive library itself defines the raw elements.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // Whitelist: unauthenticated public surfaces may use raw HTML controls.
  // Includes the marketing site (LandingPage + everything under
  // src/pages/marketing/**) — these are public chrome with their own
  // visual language and don't need to share the in-app primitive set.
  {
    files: [
      'modules/alerts/pages/PublicAlertSubmitPage.tsx',
      'modules/alerts/pages/PublicAlertStatusPage.tsx',
      'src/pages/AuthPage.tsx',
      'src/pages/InviteAcceptPage.tsx',
      'src/pages/LandingPage.tsx',
      'src/pages/marketing/**/*.{ts,tsx}',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // Whitelist: platform dev-tooling surfaces (layout-lab, composer, demo,
  // gallery, reference blocks, UI-core previews). Internal tooling for
  // design-system work, not end-user UI; primitives are intentionally
  // bypassed so engineers can prototype freely.
  {
    files: [
      'src/pages/platform/**/*.{ts,tsx}',
      'src/components/platform/**/*.{ts,tsx}',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
