// Plan & abonnement — kontakt-salg-kort.
//
// No billing/plan tables exist in the open-source schema; commercial
// licensing is handled outside the app. This panel simply surfaces the
// organisation identity and offers a contact path for plan questions.

import { ExternalLink, Mail } from 'lucide-react'
import { ModuleSectionCard } from '../../../module'
import { Button } from '../../../ui/Button'
import { useOrgSetupContext } from '../../../../hooks/useOrgSetupContext'

export default function PlanAdminPanel() {
  const { organization } = useOrgSetupContext()
  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Plan og abonnement</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Plan­valg og lisensiering håndteres utenfor applikasjonen. Ta kontakt for endring i
          omfang, ekstra moduler eller fakturerings­spørsmål.
        </p>
        {organization ? (
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Organisasjon</dt>
              <dd className="mt-0.5 text-neutral-900">{organization.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Org.nr</dt>
              <dd className="mt-0.5 text-neutral-900">{organization.organization_number}</dd>
            </div>
          </dl>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="mailto:salg@atics.no" rel="noreferrer">
            <Button variant="primary" size="sm" icon={<Mail className="size-3.5" />}>
              Kontakt salg
            </Button>
          </a>
          <a href="https://atics.no/priser" target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm" icon={<ExternalLink className="size-3.5" />}>
              Se prisplaner
            </Button>
          </a>
        </div>
      </ModuleSectionCard>
    </div>
  )
}
