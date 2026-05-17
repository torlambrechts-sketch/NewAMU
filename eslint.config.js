import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

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
  {
    files: [
      'modules/alerts/pages/PublicAlertSubmitPage.tsx',
      'modules/alerts/pages/PublicAlertStatusPage.tsx',
      'src/pages/AuthPage.tsx',
      'src/pages/InviteAcceptPage.tsx',
      'src/pages/LandingPage.tsx',
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
