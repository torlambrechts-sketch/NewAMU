// Settings-hub wrapper around the existing `DocumentsSettingsRevisjon`
// panel. See `DocumentsScopeGenerelt.tsx` for the rationale.

import { Loader2 } from 'lucide-react'
import { WarningBox } from '../../ui/AlertBox'
import { DocumentsSettingsRevisjon } from './DocumentsSettingsRevisjon'
import { useDocumentsModuleSettings } from './useDocumentsModuleSettings'

export default function DocumentsScopeRevisjon() {
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
      <DocumentsSettingsRevisjon
        settings={settings}
        setSettings={setSettings}
        saving={saving}
        onSave={() => void save()}
      />
    </div>
  )
}
