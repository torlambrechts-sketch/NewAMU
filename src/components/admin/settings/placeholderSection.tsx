// Helper that wraps `PlaceholderPanel` in a `React.lazy` factory matching
// the shape expected by `SettingsSection.component`. Lets scope files
// stay JSX-light and keeps a stable contract between the registry and
// any unbuilt sections.

import { lazy } from 'react'
import { PlaceholderPanel } from './PlaceholderPanel'

export function placeholderSection(title: string, description?: string, hint?: string) {
  return lazy(async () => ({
    default: () => <PlaceholderPanel title={title} description={description} hint={hint} />,
  }))
}
