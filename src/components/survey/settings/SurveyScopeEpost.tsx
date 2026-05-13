import { Loader2 } from 'lucide-react'
import { WarningBox } from '../../ui/AlertBox'
import { SurveySettingsEpost } from './SurveySettingsEpost'
import { useSurveyModuleSettings } from './useSurveyModuleSettings'

export default function SurveyScopeEpost() {
  const { settings, setSettings, loading, saving, error, canManage, save } =
    useSurveyModuleSettings()
  if (!canManage) {
    return <WarningBox>Du har ikke tilgang. Krever rollen «survey.manage» eller administrator.</WarningBox>
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
      <SurveySettingsEpost
        settings={settings}
        setSettings={setSettings}
        saving={saving}
        onSave={() => void save()}
      />
    </div>
  )
}
