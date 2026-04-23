import { useMemo, useState } from 'react'
import {
  Archive,
  Briefcase,
  ChevronDown,
  FileText,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
} from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'

const FOREST = '#1a3d32'

type RecentDoc = { name: string; modified: string }

export type DocumentFolderJobsItem = {
  id: string
  name: string
  /** Line under title (e.g. location · category) */
  meta: string
  /** Short code / ref shown as chip */
  code: string
  documentCount: number
  recentDocuments: RecentDoc[]
}

const DEFAULT_FOLDERS: DocumentFolderJobsItem[] = [
  {
    id: 'f1',
    name: 'Arbeidsrett — referanser',
    meta: 'Juridisk · HMS · Eksempel AS',
    code: 'DOC-01',
    documentCount: 124,
    recentDocuments: [
      { name: 'Oppsigelsesfrister_2024.pdf', modified: '12. okt. 2024' },
      { name: 'AML_kapittel_15_sammendrag.docx', modified: '2. okt. 2024' },
      { name: 'Ferie_og_fritid_mal.pdf', modified: '28. sep. 2024' },
      { name: 'Tidsbegrenset_ansettelse.docx', modified: '15. sep. 2024' },
      { name: 'Arbeidstakerrettigheter.pdf', modified: '1. sep. 2024' },
    ],
  },
  {
    id: 'f2',
    name: 'Tariffavtaler',
    meta: 'Bergen · HR',
    code: 'DOC-02',
    documentCount: 48,
    recentDocuments: [
      { name: 'LO_hovedtariff_utdrag.pdf', modified: '10. okt. 2024' },
      { name: 'Lokale_tillegg_2024.pdf', modified: '5. okt. 2024' },
      { name: 'Overenskomst_verksted.docx', modified: '20. sep. 2024' },
      { name: 'Fellesbestemmelse_signert.pdf', modified: '12. sep. 2024' },
      { name: 'Tariffhistorikk.xlsx', modified: '1. sep. 2024' },
    ],
  },
  {
    id: 'f3',
    name: 'Møtereferat 2024',
    meta: 'Oslo · AMU',
    code: 'DOC-03',
    documentCount: 89,
    recentDocuments: [
      { name: 'AMU_oktober_referat.pdf', modified: '8. okt. 2024' },
      { name: 'Vernerunde_sept_notat.docx', modified: '22. sep. 2024' },
      { name: 'HMS_møte_august.pdf', modified: '5. sep. 2024' },
      { name: 'BHT_oppfølging.pdf', modified: '28. aug. 2024' },
      { name: 'Ledelsesgjennomgang.docx', modified: '14. aug. 2024' },
    ],
  },
  {
    id: 'f4',
    name: 'HMS-håndbok',
    meta: 'Digital · Publisert',
    code: 'DOC-04',
    documentCount: 36,
    recentDocuments: [
      { name: 'Brannrutiner_oppdatert.pdf', modified: '30. sep. 2024' },
      { name: 'Førstehjelp_oversikt.pdf', modified: '18. sep. 2024' },
      { name: 'Verneutstyr_krav.docx', modified: '3. sep. 2024' },
      { name: 'Kjemikalier_register.xlsx', modified: '25. aug. 2024' },
      { name: 'Nødplan_bygg_A.pdf', modified: '10. aug. 2024' },
    ],
  },
  {
    id: 'f5',
    name: 'Opplæring og kompetanse',
    meta: 'Læring · Obligatorisk',
    code: 'DOC-05',
    documentCount: 15,
    recentDocuments: [
      { name: 'Introduksjon_HMS_video.pdf', modified: '1. okt. 2024' },
      { name: 'Truck_sertifikatliste.xlsx', modified: '20. sep. 2024' },
      { name: 'Varmt_arbeid_kurs.docx', modified: '5. sep. 2024' },
      { name: 'HMS_for_nye_ansatte.pdf', modified: '22. aug. 2024' },
      { name: 'Årlig_opplæringsplan.pdf', modified: '1. aug. 2024' },
    ],
  },
]

type Props = {
  folders?: DocumentFolderJobsItem[]
}

/**
 * Document folders in the same visual language as platform layout-reference «Stillinger (Jobs)»:
 * forest tab bar, white toolbar (count + search + filters + grid/list), then five compact job-style cards.
 * Each card expands to show five recent documents (demodata).
 */
export function DocumentFolderJobsStrip({ folders = DEFAULT_FOLDERS }: Props) {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [stripQuery, setStripQuery] = useState('')

  const totalDocs = useMemo(() => folders.reduce((s, f) => s + f.documentCount, 0), [folders])

  const filteredFolders = useMemo(() => {
    const q = stripQuery.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((f) => f.name.toLowerCase().includes(q) || f.meta.toLowerCase().includes(q))
  }, [folders, stripQuery])

  const gridClass =
    layout === 'grid'
      ? 'grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5'
      : 'space-y-2'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2" style={{ backgroundColor: FOREST }}>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="bg-[#FDFBF7] text-neutral-900 shadow-sm hover:bg-[#FDFBF7]"
            icon={<Briefcase className="h-3.5 w-3.5" />}
          >
            Aktive mapper
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="border-transparent text-white/90 hover:bg-white/10"
            icon={<Archive className="h-3.5 w-3.5" />}
          >
            Arkiv
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="border border-white/20 bg-white/10 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-white/20"
        >
          + Ny mappe
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200/80 bg-white px-3 py-2 shadow-sm sm:gap-3 sm:px-4 sm:py-2.5">
        <p className="shrink-0 text-xs font-semibold text-neutral-900 sm:text-sm">
          <span className="text-lg font-bold tabular-nums sm:text-xl">{totalDocs}</span>{' '}
          <span className="font-medium text-neutral-600">Dokumenter i mapper</span>
        </p>
        <div className="relative min-w-0 flex-1 basis-[min(100%,12rem)]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 sm:left-3 sm:h-4 sm:w-4" />
          <StandardInput
            type="search"
            className="w-full py-2 pl-9 text-xs sm:pl-10 sm:text-sm"
            placeholder="Søk i mapper…"
            value={stripQuery}
            onChange={(e) => setStripQuery(e.target.value)}
            aria-label="Søk i mapper"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <Button type="button" size="sm" variant="secondary" icon={<Filter className="h-3.5 w-3.5" />} className="text-[10px] uppercase">
            Filter
          </Button>
          <div className="flex rounded-lg border border-neutral-200 p-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={layout === 'grid' ? 'rounded-md bg-[#EFE8DC] text-neutral-900' : 'rounded-md text-neutral-500'}
              aria-label="Rutenett"
              aria-pressed={layout === 'grid'}
              onClick={() => setLayout('grid')}
            >
              <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={layout === 'list' ? 'rounded-md bg-[#EFE8DC] text-neutral-900' : 'rounded-md text-neutral-500'}
              aria-label="Liste"
              aria-pressed={layout === 'list'}
              onClick={() => setLayout('list')}
            >
              <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className={gridClass}>
        {filteredFolders.map((f) => {
          const open = expandedId === f.id
          return (
            <ModuleSectionCard key={f.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 px-2.5 py-2 sm:px-3 sm:py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-neutral-900 sm:text-[13px]">{f.name}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-500 sm:text-[11px]">{f.meta}</p>
                  <span className="mt-1 inline-block rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                    {f.code}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" className="text-neutral-400 hover:text-neutral-700" aria-label="Mer">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 sm:px-3">
                <div>
                  <p className="text-base font-bold tabular-nums text-neutral-900 sm:text-lg">{f.documentCount}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">Dokumenter</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-[10px] font-semibold uppercase tracking-wide text-neutral-700"
                  icon={<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />}
                  onClick={() => setExpandedId(open ? null : f.id)}
                  aria-expanded={open}
                >
                  {open ? 'Skjul' : 'Vis siste'}
                </Button>
              </div>
              {open ? (
                <div className="border-t border-neutral-100 bg-neutral-50/80 px-2.5 py-2 sm:px-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">5 siste i mappen</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {f.recentDocuments.map((d) => (
                      <li key={d.name} className="flex min-w-0 items-start gap-1.5 text-[10px] text-neutral-700 sm:text-[11px]">
                        <FileText className="mt-0.5 h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">{d.name}</span>
                        <span className="shrink-0 text-neutral-500">{d.modified}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </ModuleSectionCard>
          )
        })}
      </div>
    </div>
  )
}
