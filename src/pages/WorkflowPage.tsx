/**
 * WorkflowPage — org-level module automation rules (module templates).
 *
 * Shown under Arbeidsflyt → «Modul-regler». One ModuleSectionCard per module,
 * stacked vertically. Uses the standard design system.
 */

import { AlertCircle, BarChart3, BookOpen, ClipboardCheck, ShieldAlert, Users } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { ModuleRulesModuleSection } from '../components/workflow/ModuleRulesModuleSection'
import { ModulePageShell, ModuleSectionCard } from '../components/module'
import { InfoBox, WarningBox } from '../components/ui/AlertBox'

const MODULES = [
  { key: 'hse.inspections', label: 'Inspeksjonsrunder', icon: ClipboardCheck, path: '/hse?tab=inspections' },
  { key: 'hse.sja', label: 'SJA', icon: ShieldAlert, path: '/hse?tab=sja' },
  { key: 'hse.vernerunder', label: 'Vernerunder', icon: Users, path: '/vernerunder' },
  { key: 'hse.incidents', label: 'Hendelser', icon: AlertCircle, path: '/workplace-reporting/incidents' },
  { key: 'hse.training', label: 'Opplæring', icon: BookOpen, path: '/hse?tab=training' },
  { key: 'survey', label: 'Undersøkelser', icon: BarChart3, path: '/surveys' },
]

export function WorkflowPage() {
  const { can, isAdmin, profile } = useOrgSetupContext()
  const canManage = profile?.is_org_admin === true || isAdmin || can('workflows.manage')

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Arbeidsflyt' }]}
      title="Automatiseringsregler per modul"
      description="Rediger og publiser automatiseringsregler for hver modul. Utkast er bare synlige for deg til du publiserer."
    >
      <ModuleSectionCard className="p-5 md:p-6">
        <InfoBox>
          Reglene gjelder modulmalen for organisasjonen. Åpne modulen i appen via lenkene under hvert kort når du vil teste flyten der.
        </InfoBox>
      </ModuleSectionCard>

      {!canManage && (
        <ModuleSectionCard className="p-5 md:p-6">
          <WarningBox>
            Du har ikke tilgang til å lagre eller publisere modulregler. Kontakt en organisasjonsadministrator eller få tilgangen{' '}
            <code className="rounded bg-white/80 px-1 text-xs">workflows.manage</code>.
          </WarningBox>
        </ModuleSectionCard>
      )}

      {MODULES.map((m) => (
        <ModuleRulesModuleSection
          key={m.key}
          moduleKey={m.key}
          label={m.label}
          icon={m.icon}
          path={m.path}
          canManage={canManage}
        />
      ))}
    </ModulePageShell>
  )
}
