// MeetingsPakkerTab — placeholder until meeting_packs table is provisioned.
//
// Meetings group templates by `framework` (AML, IK-f, ISO 45001, GDPR, …)
// rather than by licensed packs. A dedicated pack layer — with per-org
// toggle, KPI labels and severity labels — is on the roadmap once the
// meeting module reaches parity with compliance/survey.

import { Layers } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import { useMeetings } from '../index'
import { MEETING_FRAMEWORK_LABEL } from '../meetingsLabels'
import { MeetingFrameworkIcon } from '../MeetingFrameworkIcon'

export function MeetingsPakkerTab() {
  const meetings = useMeetings()

  // Derive the unique frameworks currently in use across system templates
  const frameworks = Array.from(
    new Set(meetings.systemTemplates.map((t) => t.framework)),
  ).sort()

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Møtepakker</h2>
        </div>
        <p className="text-sm text-neutral-600">
          Møtemaler er i dag gruppert etter <strong>rammeverk</strong> (AML, IK-f, ISO,
          GDPR, …). En dedikert pakkekonfigurasjon — med per-pakke KPI-merker,
          alvorlighetsetiketter og lovreferansebanner — vil komme i en fremtidig
          utgivelse når møtemodulen når full paritet med sjekkliste- og undersøkelsesmodulen.
        </p>

        <div className="mt-5">
          <InfoBox>
            Aktuelle rammeverk er konfigurert direkte på systemmalene. Bruk
            «Maler»-fanen for å aktivere/deaktivere og kategorisere maler per
            rammeverk.
          </InfoBox>
        </div>

        {frameworks.length > 0 && (
          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Aktive rammeverk ({frameworks.length})
            </p>
            <ul className="space-y-2">
              {frameworks.map((fw) => {
                const count = meetings.systemTemplates.filter(
                  (t) => t.framework === fw,
                ).length
                return (
                  <li
                    key={fw}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 px-4 py-3"
                  >
                    <div className="shrink-0 rounded border border-neutral-200 bg-white p-1.5">
                      <MeetingFrameworkIcon framework={fw} className="h-4 w-4 text-[#1a3d32]" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-neutral-900">
                        {MEETING_FRAMEWORK_LABEL[fw as keyof typeof MEETING_FRAMEWORK_LABEL] ?? fw}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {count} {count === 1 ? 'mal' : 'maler'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
