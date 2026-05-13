// Settings-hub wrapper around the existing `DocumentsSettingsGenerelt`
// panel. Owns its own load/save lifecycle via
// `useDocumentsModuleSettings` so the unified settings shell can lazy-
// load and render this tab independently.

import { Loader2 } from 'lucide-react'
import { WarningBox } from '../../ui/AlertBox'
import { DocumentsSettingsGenerelt } from './DocumentsSettingsGenerelt'
import { useDocumentsModuleSettings } from './useDocumentsModuleSettings'

export default function DocumentsScopeGenerelt() {
  const { settings, setSettings, loading, saving, error, canManage, save } =
    useDocumentsModuleSettings()

  if (!canManage) {
    return <WarningBox>Du har ikke tilgang. Krever rollen «documents.manage» eller administrator.</WarningBox>
  }
  if (loading) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Laster innstillinger…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {error ? <WarningBox>{error}</WarningBox> : null}
      <DocumentsSettingsGenerelt
        settings={settings}
        setSettings={setSettings}
        saving={saving}
        onSave={() => void save()}
      />
    </div>
  )
}
