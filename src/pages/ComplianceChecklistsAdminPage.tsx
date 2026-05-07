// Compliance Checklists — admin / settings page.
//
// Five-tab layout matching MODULE_SPEC.md §7:
//   Maler        — template CRUD (full editor, item list, requirement tagging)
//   Pakker       — pack display fields (name, KPI labels, severity labels, refs)
//   Krav         — compliance requirements taxonomy (system + org-defined)
//   Arbeidsflyt  — reuse WorkflowRulesTab with sourceModule='compliance_checklist'
//   Statistikk   — coverage strip + simple stats
//
// This commit ships the Maler tab fully. Pakker, Krav, Arbeidsflyt and
// Statistikk are placeholder text until follow-up commits 4b and 4c.

import { useState } from 'react'
import {
  BarChart2,
  ClipboardList,
  FolderTree,
  GitBranch,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import { ModulePageShell } from '../components/module/ModulePageShell'
import { Tabs } from '../components/ui/Tabs'
import { useActivePack } from '../context/packContextValue'
import { MalerTab } from '../../modules/compliance/admin/MalerTab'
import { KategorierTab } from '../../modules/compliance/admin/KategorierTab'
import { PakkerTab } from '../../modules/compliance/admin/PakkerTab'
import { KravTab } from '../../modules/compliance/admin/KravTab'
import { ArbeidsflytTab } from '../../modules/compliance/admin/ArbeidsflytTab'
import { StatistikkTab } from '../../modules/compliance/admin/StatistikkTab'

type AdminTab = 'maler' | 'kategorier' | 'pakker' | 'krav' | 'arbeidsflyt' | 'statistikk'

const TAB_ITEMS = [
  { id: 'maler', label: 'Maler', icon: ClipboardList },
  { id: 'kategorier', label: 'Kategorier', icon: FolderTree },
  { id: 'pakker', label: 'Pakker', icon: Layers },
  { id: 'krav', label: 'Krav', icon: ShieldCheck },
  { id: 'arbeidsflyt', label: 'Arbeidsflyt', icon: GitBranch },
  { id: 'statistikk', label: 'Statistikk', icon: BarChart2 },
]

export function ComplianceChecklistsAdminPage() {
  const [tab, setTab] = useState<AdminTab>('maler')
  const pack = useActivePack()

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: pack.pluralLabel, to: '/compliance/checklists' },
        { label: 'Innstillinger' },
      ]}
      title={`${pack.pluralLabel} — innstillinger`}
      description="Konfigurer maler, pakker, krav og arbeidsflyt for sjekklister."
      tabs={
        <Tabs
          items={TAB_ITEMS}
          activeId={tab}
          onChange={(id) => setTab(id as AdminTab)}
          overflow="scroll"
        />
      }
    >
      {tab === 'maler' && <MalerTab />}
      {tab === 'kategorier' && <KategorierTab />}
      {tab === 'pakker' && <PakkerTab />}
      {tab === 'krav' && <KravTab />}
      {tab === 'arbeidsflyt' && <ArbeidsflytTab />}
      {tab === 'statistikk' && <StatistikkTab />}
    </ModulePageShell>
  )
}
