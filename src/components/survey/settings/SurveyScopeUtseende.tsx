import { Loader2 } from 'lucide-react'
import { WarningBox } from '../../ui/AlertBox'
import { SurveySettingsUtseende } from './SurveySettingsUtseende'
import { useSurveyModuleSettings } from './useSurveyModuleSettings'

export default function SurveyScopeUtseende() {
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
      <SurveySettingsUtseende
        settings={settings}
        setSettings={setSettings}
        saving={saving}
        onSave={() => void save()}
      />
    </div>
  )
}
