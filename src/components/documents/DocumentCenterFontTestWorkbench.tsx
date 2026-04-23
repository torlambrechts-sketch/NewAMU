import { useMemo, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cloud,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  History,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { LayoutScoreStatRow } from '../layout/LayoutScoreStatRow'
import { ModuleMainAside } from '../module/ModuleMainAside'
import { ModuleRecordsTableShell } from '../module/ModuleRecordsTableShell'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { MODULE_TABLE_TD, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../module/moduleTableKit'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { Tabs } from '../ui/Tabs'

const FOREST = '#1a3d32'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

const DEPT_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Alle avdelinger' },
  { value: 'hr', label: 'HR' },
  { value: 'hms', label: 'HMS' },
  { value: 'adm', label: 'Administrasjon' },
]

const DATE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'any', label: 'Når som helst' },
  { value: '7d', label: 'Siste 7 dager' },
  { value: '30d', label: 'Siste 30 dager' },
  { value: 'year', label: 'Dette året' },
]

type DocTypeFilter = 'all' | 'pdf' | 'docx' | 'sheet'

type FileRow = {
  id: string
  name: string
  type: 'PDF' | 'DOCX' | 'Regneark'
  typeKey: DocTypeFilter
  owner: string
  ownerInitials: string
  modified: string
  size: string
}

const MOCK_FILES: FileRow[] = [
  {
    id: '1',
    name: '2024_Rekrutteringspolicy_v2.pdf',
    type: 'PDF',
    typeKey: 'pdf',
    owner: 'Kari Nordmann',
    ownerInitials: 'KN',
    modified: '12. okt. 2023',
    size: '2,4 MB',
  },
  {
    id: '2',
    name: 'Medarbeiderhandbok_utkast.docx',
    type: 'DOCX',
    typeKey: 'docx',
    owner: 'Markus Berg',
    ownerInitials: 'MB',
    modified: '11. okt. 2023',
    size: '850 KB',
  },
  {
    id: '3',
    name: 'Budsjettfordeling_2024.xlsx',
    type: 'Regneark',
    typeKey: 'sheet',
    owner: 'Sara Li',
    ownerInitials: 'SL',
    modified: '9. okt. 2023',
    size: '1,1 MB',
  },
  {
    id: '4',
    name: 'Helse_og_sikkerhet_retninglinjer.pdf',
    type: 'PDF',
    typeKey: 'pdf',
    owner: 'Kari Nordmann',
    ownerInitials: 'KN',
    modified: '5. okt. 2023',
    size: '4,7 MB',
  },
]

/** Two rows × 5 compact folder tiles (demodata), half-scale vs default KPI row. */
const FOLDER_KPI_ROW_A = [
  { big: '124', title: 'Arbeidsrett', sub: '1,2 GB', icon: 'folder' as const },
  { big: '48', title: 'Tariffavtaler', sub: '450 MB', icon: 'folder' as const },
  { big: '89', title: 'Møtereferat 24', sub: '210 MB', icon: 'folder' as const },
  { big: '36', title: 'HMS-håndbok', sub: '88 MB', icon: 'folder' as const },
  { big: '15', title: 'Opplæring', sub: '12 filer', icon: 'folder' as const },
] as const

const FOLDER_KPI_ROW_B = [
  { big: '22', title: 'ROS / risiko', sub: '9 mapper', icon: 'folder' as const },
  { big: '7', title: 'SJA', sub: '3 aktive', icon: 'folder' as const },
  { big: '41', title: 'Varsling', sub: 'PDF + mal', icon: 'folder' as const },
  { big: '18', title: 'Avvik', sub: '2024', icon: 'folder' as const },
  { big: '3', title: 'Årsgj.', sub: 'utkast', icon: 'folder' as const },
] as const

/**
 * Visual prototype: document hub with filters, folder catalogues and file table.
 * Folder KPIs render above `ModuleMainAside` (outside white cards, like ROS/SJA hub). Table uses `ModuleRecordsTableShell` without KPIs; `ModuleMainAside` + module cards per docs/UI_PLACEMENT_RULES.md.
 * Static mock data only.
 */
export function DocumentCenterFontTestWorkbench() {
  const [dept, setDept] = useState('all')
  const [docType, setDocType] = useState<DocTypeFilter>('all')
  const [dateFilter, setDateFilter] = useState('any')
  const [libraryTab, setLibraryTab] = useState<'recent' | 'shared' | 'starred'>('recent')
  const [query, setQuery] = useState('')

  const filteredFiles = useMemo(() => {
    return MOCK_FILES.filter((f) => {
      if (docType !== 'all' && f.typeKey !== docType) return false
      const q = query.trim().toLowerCase()
      if (q && !f.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [docType, query])

  const clearFilters = () => {
    setDept('all')
    setDocType('all')
    setDateFilter('any')
    setQuery('')
  }

  const filterCard = (
    <ModuleSectionCard className="p-5">
      <h3 className="text-sm font-semibold text-neutral-900">Filtre</h3>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-neutral-700">Avdeling</p>
          <SearchableSelect
            className="mt-1.5"
            value={dept}
            options={DEPT_OPTIONS}
            onChange={setDept}
            placeholder="Velg avdeling"
            triggerClassName="py-2 text-xs"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-700">Dokumenttype</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { id: 'all' as const, label: 'Alle' },
                { id: 'pdf' as const, label: 'PDF' },
                { id: 'docx' as const, label: 'DOCX' },
                { id: 'sheet' as const, label: 'Regneark' },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={docType === opt.id ? 'primary' : 'secondary'}
                onClick={() => setDocType(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-700">Endret</p>
          <SearchableSelect
            className="mt-1.5"
            value={dateFilter}
            options={DATE_FILTER_OPTIONS}
            onChange={setDateFilter}
            placeholder="Tidsrom"
            triggerClassName="py-2 text-xs"
          />
        </div>
        <Button type="button" variant="secondary" className="w-full" onClick={clearFilters}>
          Nullstill filtre
        </Button>
      </div>
    </ModuleSectionCard>
  )

  /** Compact forest cards — aligned padding/typography with Organisasjonslagring. */
  const forestCardShell = (Icon: LucideIcon, title: string, body: ReactNode) => {
    return (
      <ModuleSectionCard className="overflow-hidden p-0 text-white" style={{ backgroundColor: FOREST, ...CARD_SHADOW }}>
        <div className="p-4">
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/95">{title}</h3>
          </div>
          <div className="mt-2">{body}</div>
        </div>
      </ModuleSectionCard>
    )
  }

  const storageCard = forestCardShell(
    Cloud,
    'Organisasjonslagring',
    <>
      <p className="text-[11px] leading-snug text-white/75">32,5 GB av 50 GB brukt</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-[65%] rounded-full bg-emerald-400/90" />
      </div>
    </>,
  )

  const pendingCard = forestCardShell(
    AlertTriangle,
    'Venter på godkjenning',
    <ul className="space-y-2">
      <li className="flex items-start justify-between gap-2 border-b border-white/10 pb-2 last:border-0 last:pb-0">
        <span className="min-w-0 text-[11px] font-medium leading-snug text-white/90">Tariffavtaleutkast.pdf</span>
        <Badge variant="critical" className="shrink-0 scale-90">
          Haster
        </Badge>
      </li>
      <li className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[11px] font-medium leading-snug text-white/90">Ressursplan_Q4.docx</span>
        <Badge variant="success" className="shrink-0 scale-90">
          Standard
        </Badge>
      </li>
    </ul>,
  )

  const complianceCard = forestCardShell(CheckCircle2, 'I samsvar', (
    <>
      <p className="text-2xl font-bold tabular-nums leading-tight text-white">100%</p>
      <p className="mt-1 text-[11px] leading-snug text-white/75">Publiserte HMS-dokumenter (demo).</p>
    </>
  ))

  const expiringCard = forestCardShell(Clock, 'Utløper snart', (
    <>
      <p className="text-2xl font-bold tabular-nums leading-tight text-white">12</p>
      <p className="mt-1 text-[11px] leading-snug text-white/75">Revisjon / årlig gjennomgang (demo).</p>
    </>
  ))

  const folderKpiRows = (
    <div className="space-y-2">
      <LayoutScoreStatRow items={[...FOLDER_KPI_ROW_A]} variant="dense" columns={5} gap="tight" />
      <LayoutScoreStatRow items={[...FOLDER_KPI_ROW_B]} variant="dense" columns={5} gap="tight" />
    </div>
  )

  /** Table only inside main white card — folder tiles sit above `ModuleMainAside` like ROS/SJA hub. */
  const documentsTableBlock = (
    <ModuleRecordsTableShell
      title="Nylige filer"
      titleTypography="sans"
      description={
        libraryTab === 'recent'
          ? 'Siste åpnet i biblioteket (demodata).'
          : libraryTab === 'shared'
            ? 'Dokumenter delt med teamet (demodata).'
            : 'Merkede favoritter (demodata).'
      }
      headerActions={
        <Button type="button" variant="ghost" size="sm" icon={<History className="h-4 w-4" />}>
          Vis historikk
        </Button>
      }
      toolbar={
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              type="search"
              className="w-full py-2 pl-10"
              placeholder="Søk i dokumenter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Søk"
            />
          </div>
          <Tabs
            className="shrink-0"
            overflow="scroll"
            items={[
              { id: 'recent', label: 'Nylig' },
              { id: 'shared', label: 'Delt' },
              { id: 'starred', label: 'Merket' },
            ]}
            activeId={libraryTab}
            onChange={(id) => setLibraryTab(id as typeof libraryTab)}
          />
        </div>
      }
    >
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={MODULE_TABLE_TH}>Navn</th>
            <th className={MODULE_TABLE_TH}>Type</th>
            <th className={MODULE_TABLE_TH}>Eier</th>
            <th className={MODULE_TABLE_TH}>Endret</th>
            <th className={`${MODULE_TABLE_TH} text-right`}>Størrelse</th>
          </tr>
        </thead>
        <tbody>
          {filteredFiles.map((row) => (
            <tr key={row.id} className={MODULE_TABLE_TR_BODY}>
              <td className={MODULE_TABLE_TD}>
                <span className="inline-flex items-center gap-2">
                  {row.typeKey === 'pdf' ? (
                    <FileText className="h-4 w-4 text-red-600/90" aria-hidden />
                  ) : row.typeKey === 'docx' ? (
                    <FileText className="h-4 w-4 text-blue-600/90" aria-hidden />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700/90" aria-hidden />
                  )}
                  <span className="font-medium text-neutral-900">{row.name}</span>
                </span>
              </td>
              <td className={MODULE_TABLE_TD}>
                <span className="text-neutral-600">{row.type}</span>
              </td>
              <td className={MODULE_TABLE_TD}>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700"
                    aria-hidden
                  >
                    {row.ownerInitials}
                  </span>
                  <span className="text-neutral-700">{row.owner}</span>
                </span>
              </td>
              <td className={`${MODULE_TABLE_TD} text-neutral-600`}>{row.modified}</td>
              <td className={`${MODULE_TABLE_TD} text-right text-neutral-600`}>{row.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModuleRecordsTableShell>
  )

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 border-b border-neutral-200/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">
            <span>Dokumenter</span>
            <span className="mx-1.5 text-neutral-300">›</span>
            <span className="font-medium text-neutral-700">HR-protokoller</span>
          </p>
          <h2 className="mt-2 text-xl font-semibold text-neutral-900 sm:text-2xl">HR-protokoller</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">
            Demoside for dokumenthub: filtre, katalogkort og liste — samme kort- og tabellmønstre som i plattform layout-referanse. Ingen ekte data.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" icon={<FolderPlus className="h-4 w-4" />}>
            Ny mappe
          </Button>
          <Button type="button" variant="secondary" icon={<Upload className="h-4 w-4" />}>
            Last opp dokument
          </Button>
          <Button type="button" variant="primary" icon={<Plus className="h-4 w-4" />}>
            Nytt dokument
          </Button>
        </div>
      </div>

      <div className="mb-6">{folderKpiRows}</div>

      <ModuleMainAside
        cardWrap
        main={<div className="space-y-6">{documentsTableBlock}</div>}
        aside={
          <div className="space-y-4">
            {filterCard}
            {storageCard}
            {pendingCard}
            {complianceCard}
            {expiringCard}
          </div>
        }
      />
    </>
  )
}
