/**
 * /table-test — five reference table styles taken directly from shadcn/ui and
 * TanStack Table examples, restyled to match our workplace shell (cream header
 * band, forest accent, Libre Baskerville serif). Two of the five are expandable
 * (rows 3 and 4).
 *
 * This page is intentionally self-contained — it deliberately does NOT use the
 * project's `DataTable` primitive so each style can show off its own header /
 * cell / expansion patterns side by side for visual comparison.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Search,
  Trash2,
  Download,
  Mail,
  FileText,
  Calendar,
  Users,
  Building2,
} from 'lucide-react'
import { Badge, type BadgeVariant } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { PageContainer } from '../components/layout/PageContainer'
import {
  WORKPLACE_PAGE_SERIF,
  WorkplacePageHeading1,
} from '../components/layout/WorkplacePageHeading1'

const FOREST = '#1a3d32'

/* ── Shared style tokens ──────────────────────────────────────────────────── */

const CARD = 'rounded-xl border border-neutral-200/80 bg-white overflow-hidden'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

const TH =
  'border-b border-neutral-200 bg-[#EFE8DC] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600'
const TD = 'border-b border-neutral-100 px-4 py-3 text-sm text-neutral-800'

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function TableTestPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] pb-20">
      <PageContainer width="wide" py="py-8">
        <WorkplacePageHeading1
          breadcrumb={[
            { label: 'Hjem', to: '/' },
            { label: 'Table test' },
          ]}
          title="Tabellgalleri"
          description={
            <>
              Fem referansetabeller hentet direkte fra{' '}
              <a
                href="https://ui.shadcn.com/docs/components/table"
                className="underline hover:text-neutral-900"
                target="_blank"
                rel="noreferrer"
              >
                shadcn/ui
              </a>{' '}
              og{' '}
              <a
                href="https://tanstack.com/table/latest/docs/framework/react/examples/basic"
                className="underline hover:text-neutral-900"
                target="_blank"
                rel="noreferrer"
              >
                TanStack Table
              </a>
              , stylet til vårt arbeidsflate-tema (krem-header, skoggrønn aksent,
              Libre Baskerville). Tabellene 3 og 4 er ekspanderbare.
            </>
          }
        />

        <div className="mt-8 grid gap-10">
          <Section
            number="01"
            badge="shadcn/ui · Table"
            title="Enkel tabell"
            blurb="Den klassiske shadcn-tabellen — caption, header-rad, ren bunnlinje per rad. Brukt for fakturaer og enkle lister."
          >
            <BasicInvoicesTable />
          </Section>

          <Section
            number="02"
            badge="TanStack · Basic data table"
            title="Sorterbar datatabell"
            blurb="Klikk på en kolonneoverskrift for å sortere. Identisk interaksjonsmønster som TanStack sin grunnleggende getSortedRowModel-eksempel."
          >
            <SortableEmployeesTable />
          </Section>

          <Section
            number="03"
            badge="shadcn/ui · Expandable row"
            title="Ekspanderbare rader (detaljpanel)"
            blurb="Trykk på chevron-knappen til venstre for å åpne et detaljpanel under raden — shadcn-mønsteret for å vise beskrivelse, delsteg og metadata uten å bytte side."
            expandable
          >
            <ExpandableTasksTable />
          </Section>

          <Section
            number="04"
            badge="TanStack · Expandable subRows"
            title="Hierarkisk tabell (tre)"
            blurb="Parent-rader åpnes for å vise underrader — direkte hentet fra TanStack sitt getExpandedRowModel + subRows-eksempel. Avdelinger med ansatte."
            expandable
          >
            <TreeOrgTable />
          </Section>

          <Section
            number="05"
            badge="shadcn/ui · Data table"
            title="Datatabell med valg og verktøyrad"
            blurb="Avkryssingsbokser, bulk-handlinger, søkefilter, kolonneskjuler og paginering. Speilbilde av shadcn sitt fulle data-table-eksempel."
          >
            <SelectableDocumentsTable />
          </Section>
        </div>

        <footer className="mt-12 flex items-center justify-between border-t border-neutral-200 pt-6 text-xs text-neutral-500">
          <span>
            Forhåndsvisning · <Link to="/" className="underline hover:text-neutral-700">tilbake til forsiden</Link>
          </span>
          <span>5 tabeller · 2 ekspanderbare</span>
        </footer>
      </PageContainer>
    </div>
  )
}

/* ── Section frame ────────────────────────────────────────────────────────── */

function Section({
  number,
  badge,
  title,
  blurb,
  expandable = false,
  children,
}: {
  number: string
  badge: string
  title: string
  blurb: string
  expandable?: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <span
              className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-white"
              aria-hidden
            >
              {number}
            </span>
            <span>{badge}</span>
            {expandable ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Ekspanderbar
              </span>
            ) : null}
          </div>
          <h2
            className="text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">{blurb}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

/* ── 1) shadcn/ui — Basic invoices table ──────────────────────────────────── */

type Invoice = {
  id: string
  status: 'paid' | 'pending' | 'unpaid'
  method: 'Visa' | 'Faktura' | 'Vipps' | 'PayPal'
  amount: number
}

const INVOICES: Invoice[] = [
  { id: 'INV-001', status: 'paid', method: 'Visa', amount: 25000 },
  { id: 'INV-002', status: 'pending', method: 'Faktura', amount: 15000 },
  { id: 'INV-003', status: 'unpaid', method: 'Vipps', amount: 3500 },
  { id: 'INV-004', status: 'paid', method: 'Visa', amount: 45000 },
  { id: 'INV-005', status: 'paid', method: 'PayPal', amount: 5500 },
  { id: 'INV-006', status: 'pending', method: 'Faktura', amount: 2000 },
]

function fmtNok(value: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value)
}

function BasicInvoicesTable() {
  const total = INVOICES.reduce((s, r) => s + r.amount, 0)
  return (
    <div className={CARD} style={CARD_SHADOW}>
      <table className="w-full border-collapse">
        <caption className="border-b border-neutral-100 bg-white px-5 py-3 text-left text-xs text-neutral-500">
          Siste fakturaer for Q1 2026.
        </caption>
        <thead>
          <tr>
            <th className={`${TH} w-32 pl-5`}>Faktura</th>
            <th className={TH}>Status</th>
            <th className={TH}>Metode</th>
            <th className={`${TH} pr-5 text-right`}>Beløp</th>
          </tr>
        </thead>
        <tbody>
          {INVOICES.map((r) => (
            <tr key={r.id} className="transition hover:bg-neutral-50">
              <td className={`${TD} pl-5 font-medium text-neutral-900`}>{r.id}</td>
              <td className={TD}>
                <Badge variant={invoiceBadge(r.status)}>{invoiceLabel(r.status)}</Badge>
              </td>
              <td className={`${TD} text-neutral-600`}>{r.method}</td>
              <td className={`${TD} pr-5 text-right font-mono tabular-nums text-neutral-900`}>
                {fmtNok(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-4 py-3 pl-5 text-sm font-semibold text-neutral-700">
              Totalt
            </td>
            <td className="px-4 py-3 pr-5 text-right font-mono text-sm font-semibold tabular-nums text-neutral-900">
              {fmtNok(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function invoiceBadge(status: Invoice['status']): BadgeVariant {
  if (status === 'paid') return 'success'
  if (status === 'pending') return 'warning'
  return 'danger'
}
function invoiceLabel(status: Invoice['status']) {
  if (status === 'paid') return 'Betalt'
  if (status === 'pending') return 'Avventer'
  return 'Ubetalt'
}

/* ── 2) TanStack — Sortable employees table ───────────────────────────────── */

type Employee = {
  id: string
  name: string
  email: string
  role: string
  hired: string // ISO date
  salary: number
}

const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Anita Solberg', email: 'anita@klarert.no', role: 'HR-leder', hired: '2021-04-12', salary: 720000 },
  { id: 'e2', name: 'Bjørn Haug', email: 'bjorn@klarert.no', role: 'Tillitsvalgt', hired: '2018-11-03', salary: 640000 },
  { id: 'e3', name: 'Cecilie Dahl', email: 'cecilie@klarert.no', role: 'Verneombud', hired: '2023-02-20', salary: 590000 },
  { id: 'e4', name: 'Daniel Nordvik', email: 'daniel@klarert.no', role: 'CFO', hired: '2017-08-15', salary: 980000 },
  { id: 'e5', name: 'Eivind Krogh', email: 'eivind@klarert.no', role: 'Utvikler', hired: '2024-01-08', salary: 720000 },
  { id: 'e6', name: 'Frida Skogen', email: 'frida@klarert.no', role: 'HR-rådgiver', hired: '2022-09-30', salary: 610000 },
]

type SortKey = keyof Employee
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3.5 text-neutral-400" />
  return dir === 'asc' ? (
    <ArrowUp className="size-3.5" style={{ color: FOREST }} />
  ) : (
    <ArrowDown className="size-3.5" style={{ color: FOREST }} />
  )
}

function HeaderSortButton({
  k,
  sortKey,
  sortDir,
  onToggle,
  align = 'left',
  children,
}: {
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onToggle: (k: SortKey) => void
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className={`-mx-2 -my-1 flex w-full items-center gap-1.5 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-600 transition hover:bg-white/60 hover:text-neutral-900 ${
        align === 'right' ? 'justify-end' : ''
      }`}
    >
      {children}
      <SortIcon active={sortKey === k} dir={sortDir} />
    </button>
  )
}

function SortableEmployeesTable() {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => {
    const copy = [...EMPLOYEES]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv), 'nb')
        : String(bv).localeCompare(String(av), 'nb')
    })
    return copy
  }, [sortKey, sortDir])

  const toggle = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className={CARD} style={CARD_SHADOW}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} pl-5`}>
              <HeaderSortButton k="name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle}>
                Navn
              </HeaderSortButton>
            </th>
            <th className={TH}>
              <HeaderSortButton k="role" sortKey={sortKey} sortDir={sortDir} onToggle={toggle}>
                Rolle
              </HeaderSortButton>
            </th>
            <th className={TH}>
              <HeaderSortButton k="email" sortKey={sortKey} sortDir={sortDir} onToggle={toggle}>
                E-post
              </HeaderSortButton>
            </th>
            <th className={TH}>
              <HeaderSortButton k="hired" sortKey={sortKey} sortDir={sortDir} onToggle={toggle}>
                Ansatt fra
              </HeaderSortButton>
            </th>
            <th className={`${TH} pr-5 text-right`}>
              <HeaderSortButton
                k="salary"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggle}
                align="right"
              >
                Lønn
              </HeaderSortButton>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="transition hover:bg-neutral-50">
              <td className={`${TD} pl-5 font-medium text-neutral-900`}>{r.name}</td>
              <td className={TD}>
                <Badge variant="neutral">{r.role}</Badge>
              </td>
              <td className={`${TD} text-neutral-600`}>{r.email}</td>
              <td className={`${TD} text-neutral-600`}>{fmtDate(r.hired)}</td>
              <td className={`${TD} pr-5 text-right font-mono tabular-nums`}>{fmtNok(r.salary)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-2.5 text-xs text-neutral-500">
        Sorterer etter <span className="font-medium text-neutral-700">{sortLabel(sortKey)}</span>{' '}
        ({sortDir === 'asc' ? 'stigende' : 'synkende'}). Klikk en kolonne for å bytte.
      </div>
    </div>
  )
}

function sortLabel(key: SortKey) {
  return ({
    name: 'Navn',
    role: 'Rolle',
    email: 'E-post',
    hired: 'Ansatt fra',
    salary: 'Lønn',
    id: 'ID',
  } as Record<SortKey, string>)[key]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/* ── 3) shadcn/ui — Expandable rows with detail panel ─────────────────────── */

type Task = {
  id: string
  title: string
  owner: string
  due: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'blocked' | 'done'
  description: string
  subtasks: { label: string; done: boolean }[]
}

const TASKS: Task[] = [
  {
    id: 'T-101',
    title: 'Risikovurdering for nytt verksted',
    owner: 'Anita Solberg',
    due: '2026-06-10',
    priority: 'high',
    status: 'in_progress',
    description:
      'Gjennomfør SJA + ROS for det nye verkstedet i 3. etasje før innflytting. Verneombud må delta på befaring og signere før første arbeidsdag.',
    subtasks: [
      { label: 'Befaring med verneombud', done: true },
      { label: 'Identifiser kjemiske farer', done: true },
      { label: 'Tiltaksplan til AMU', done: false },
      { label: 'Signering av leder', done: false },
    ],
  },
  {
    id: 'T-102',
    title: 'Årshjul AMU — vårmøtet',
    owner: 'Bjørn Haug',
    due: '2026-05-30',
    priority: 'medium',
    status: 'open',
    description:
      'Forbered agenda til vårmøtet i arbeidsmiljøutvalget: gjennomgang av sykefravær, vernerunde-funn Q1, status på opplæring.',
    subtasks: [
      { label: 'Innkalling sendt', done: false },
      { label: 'Underlag fra HR', done: false },
      { label: 'Sykefraværsstatistikk', done: false },
    ],
  },
  {
    id: 'T-103',
    title: 'Avvik — fall fra stillas',
    owner: 'Cecilie Dahl',
    due: '2026-05-20',
    priority: 'critical',
    status: 'blocked',
    description:
      'Hendelsesgranskning etter fall fra stillas 12.05. Politiet involvert, Arbeidstilsynet varslet etter AML § 5-2. Avventer rapport fra ekstern.',
    subtasks: [
      { label: 'Sikre åstedet', done: true },
      { label: 'Intervju vitner', done: true },
      { label: 'Rapport fra ekstern', done: false },
      { label: 'Tiltak iverksatt', done: false },
    ],
  },
  {
    id: 'T-104',
    title: 'GDPR-vurdering av nytt HR-system',
    owner: 'Daniel Nordvik',
    due: '2026-07-01',
    priority: 'medium',
    status: 'in_progress',
    description:
      'Vurdering av personvernkonsekvenser (DPIA) etter GDPR Art. 35 for det nye HR-systemet. Databehandleravtale signert, men risikovurdering gjenstår.',
    subtasks: [
      { label: 'Kartlegging av datakategorier', done: true },
      { label: 'Risikoanalyse', done: false },
      { label: 'Tiltak og restrisiko', done: false },
    ],
  },
]

function ExpandableTasksTable() {
  const [openId, setOpenId] = useState<string | null>(TASKS[0].id)
  return (
    <div className={CARD} style={CARD_SHADOW}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-10 pl-5`} aria-label="Utvid" />
            <th className={`${TH} w-24`}>ID</th>
            <th className={TH}>Tittel</th>
            <th className={TH}>Ansvarlig</th>
            <th className={TH}>Frist</th>
            <th className={TH}>Prioritet</th>
            <th className={`${TH} pr-5`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {TASKS.map((t) => {
            const isOpen = openId === t.id
            return (
              <ExpandableTaskRow
                key={t.id}
                task={t}
                isOpen={isOpen}
                onToggle={() => setOpenId(isOpen ? null : t.id)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ExpandableTaskRow({
  task,
  isOpen,
  onToggle,
}: {
  task: Task
  isOpen: boolean
  onToggle: () => void
}) {
  const doneCount = task.subtasks.filter((s) => s.done).length
  return (
    <>
      <tr
        className={`cursor-pointer transition ${isOpen ? 'bg-[#F7F4EE]' : 'hover:bg-neutral-50'}`}
        onClick={onToggle}
      >
        <td className={`${TD} pl-5`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="inline-flex size-6 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Lukk detaljer' : 'Vis detaljer'}
          >
            {isOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </td>
        <td className={`${TD} font-mono text-xs text-neutral-500`}>{task.id}</td>
        <td className={`${TD} font-medium text-neutral-900`}>{task.title}</td>
        <td className={`${TD} text-neutral-600`}>{task.owner}</td>
        <td className={`${TD} text-neutral-600`}>{fmtDate(task.due)}</td>
        <td className={TD}>
          <Badge variant={priorityBadge(task.priority)}>{priorityLabel(task.priority)}</Badge>
        </td>
        <td className={`${TD} pr-5`}>
          <Badge variant={statusBadge(task.status)}>{statusLabel(task.status)}</Badge>
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td colSpan={7} className="border-b border-neutral-100 bg-[#FBF8F1] px-5 py-5">
            <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  Beskrivelse
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
                  {task.description}
                </p>
              </div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                    Delsteg
                  </h4>
                  <span className="text-xs text-neutral-500">
                    {doneCount} / {task.subtasks.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {task.subtasks.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span
                        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                          s.done
                            ? 'border-transparent text-white'
                            : 'border-neutral-300 bg-white'
                        }`}
                        style={s.done ? { backgroundColor: FOREST } : undefined}
                        aria-hidden
                      >
                        {s.done ? (
                          <svg
                            viewBox="0 0 12 12"
                            className="size-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M2.5 6.5l2 2 5-5" />
                          </svg>
                        ) : null}
                      </span>
                      <span className={s.done ? 'text-neutral-500 line-through' : 'text-neutral-800'}>
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function priorityBadge(p: Task['priority']): BadgeVariant {
  if (p === 'low') return 'neutral'
  if (p === 'medium') return 'warning'
  if (p === 'high') return 'high'
  return 'critical'
}
function priorityLabel(p: Task['priority']) {
  return ({ low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk' } as Record<Task['priority'], string>)[p]
}
function statusBadge(s: Task['status']): BadgeVariant {
  if (s === 'done') return 'success'
  if (s === 'in_progress') return 'info'
  if (s === 'blocked') return 'danger'
  return 'draft'
}
function statusLabel(s: Task['status']) {
  return ({
    open: 'Åpen',
    in_progress: 'Pågår',
    blocked: 'Blokkert',
    done: 'Fullført',
  } as Record<Task['status'], string>)[s]
}

/* ── 4) TanStack — Tree table with subRows ────────────────────────────────── */

type OrgRow = {
  id: string
  name: string
  title: string
  headcount?: number
  budget?: number
  utilisation?: number // 0..1
  children?: OrgRow[]
}

const ORG: OrgRow[] = [
  {
    id: 'd1',
    name: 'Drift',
    title: 'Avdeling',
    headcount: 24,
    budget: 12_400_000,
    utilisation: 0.82,
    children: [
      { id: 'd1-1', name: 'Anders Holm', title: 'Driftssjef', utilisation: 0.95 },
      { id: 'd1-2', name: 'Berit Lund', title: 'Vedlikeholdsleder', utilisation: 0.78 },
      { id: 'd1-3', name: 'Carl Sæther', title: 'Driftstekniker', utilisation: 0.66 },
    ],
  },
  {
    id: 'd2',
    name: 'HR & HMS',
    title: 'Avdeling',
    headcount: 8,
    budget: 4_200_000,
    utilisation: 0.74,
    children: [
      { id: 'd2-1', name: 'Anita Solberg', title: 'HR-leder', utilisation: 0.88 },
      { id: 'd2-2', name: 'Cecilie Dahl', title: 'Verneombud', utilisation: 0.62 },
      { id: 'd2-3', name: 'Eivind Sand', title: 'HMS-rådgiver', utilisation: 0.71 },
    ],
  },
  {
    id: 'd3',
    name: 'Produktutvikling',
    title: 'Avdeling',
    headcount: 14,
    budget: 9_800_000,
    utilisation: 0.91,
    children: [
      { id: 'd3-1', name: 'Daniel Nordvik', title: 'CTO', utilisation: 0.85 },
      { id: 'd3-2', name: 'Frida Skogen', title: 'Designsjef', utilisation: 0.93 },
      {
        id: 'd3-3',
        name: 'Engineering',
        title: 'Team',
        headcount: 9,
        utilisation: 0.94,
        children: [
          { id: 'd3-3-1', name: 'Gunnar Aas', title: 'Tech lead', utilisation: 0.96 },
          { id: 'd3-3-2', name: 'Hilde Vik', title: 'Frontend-utvikler', utilisation: 0.92 },
          { id: 'd3-3-3', name: 'Ivar Bø', title: 'Backend-utvikler', utilisation: 0.93 },
        ],
      },
    ],
  },
]

function TreeOrgTable() {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(['d3', 'd3-3']))
  const flat = useMemo(() => flatten(ORG, openIds), [openIds])

  const toggle = (id: string) => {
    setOpenIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={CARD} style={CARD_SHADOW}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} pl-5`}>Navn / tittel</th>
            <th className={TH}>Type</th>
            <th className={`${TH} text-right`}>Hoder</th>
            <th className={`${TH} text-right`}>Budsjett</th>
            <th className={`${TH} pr-5 text-right`}>Kapasitet</th>
          </tr>
        </thead>
        <tbody>
          {flat.map(({ row, depth, hasChildren }) => {
            const isOpen = openIds.has(row.id)
            return (
              <tr key={row.id} className="transition hover:bg-neutral-50">
                <td className={`${TD} pl-5`}>
                  <div
                    className="flex items-center gap-1.5"
                    style={{ paddingLeft: depth * 22 }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggle(row.id)}
                        className="inline-flex size-6 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Skjul underrader' : 'Vis underrader'}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                    ) : (
                      <span className="inline-block size-6" aria-hidden />
                    )}
                    {hasChildren ? (
                      <Building2 className="size-4 shrink-0 text-neutral-400" aria-hidden />
                    ) : (
                      <Users className="size-4 shrink-0 text-neutral-300" aria-hidden />
                    )}
                    <span
                      className={`truncate ${
                        hasChildren ? 'font-semibold text-neutral-900' : 'text-neutral-800'
                      }`}
                    >
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className={`${TD} text-neutral-600`}>{row.title}</td>
                <td className={`${TD} text-right font-mono tabular-nums text-neutral-700`}>
                  {row.headcount ?? '—'}
                </td>
                <td className={`${TD} text-right font-mono tabular-nums text-neutral-700`}>
                  {row.budget ? fmtNok(row.budget) : '—'}
                </td>
                <td className={`${TD} pr-5`}>
                  {row.utilisation != null ? (
                    <UtilBar pct={row.utilisation} />
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function flatten(
  rows: OrgRow[],
  open: Set<string>,
  depth = 0,
): { row: OrgRow; depth: number; hasChildren: boolean }[] {
  const out: { row: OrgRow; depth: number; hasChildren: boolean }[] = []
  for (const r of rows) {
    const hasChildren = !!r.children && r.children.length > 0
    out.push({ row: r, depth, hasChildren })
    if (hasChildren && open.has(r.id)) {
      out.push(...flatten(r.children!, open, depth + 1))
    }
  }
  return out
}

function UtilBar({ pct }: { pct: number }) {
  const value = Math.round(pct * 100)
  const color = pct >= 0.9 ? '#b45309' : pct >= 0.7 ? FOREST : '#737373'
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-mono text-xs tabular-nums text-neutral-600">{value}%</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/* ── 5) shadcn/ui — Selectable rows with toolbar + pagination ─────────────── */

type DocRow = {
  id: string
  title: string
  type: 'Prosedyre' | 'Instruks' | 'Mal' | 'Rapport'
  owner: string
  updated: string
  reviewIn: number // days
  status: 'draft' | 'reviewed' | 'approved'
}

const DOCS: DocRow[] = [
  { id: 'D-001', title: 'HMS-håndbok 2026', type: 'Prosedyre', owner: 'Anita Solberg', updated: '2026-04-18', reviewIn: 42, status: 'approved' },
  { id: 'D-002', title: 'Beredskapsplan brann', type: 'Prosedyre', owner: 'Bjørn Haug', updated: '2026-03-02', reviewIn: 12, status: 'approved' },
  { id: 'D-003', title: 'SJA-skjema kjemikalier', type: 'Mal', owner: 'Cecilie Dahl', updated: '2026-05-09', reviewIn: 88, status: 'reviewed' },
  { id: 'D-004', title: 'Avviksrapport — Q1', type: 'Rapport', owner: 'Daniel Nordvik', updated: '2026-04-22', reviewIn: 6, status: 'draft' },
  { id: 'D-005', title: 'Instruks for verksted', type: 'Instruks', owner: 'Eivind Krogh', updated: '2026-05-15', reviewIn: 120, status: 'reviewed' },
  { id: 'D-006', title: 'Personvernerklæring', type: 'Prosedyre', owner: 'Frida Skogen', updated: '2026-02-11', reviewIn: -3, status: 'approved' },
  { id: 'D-007', title: 'Vernerunde — sjekkliste', type: 'Mal', owner: 'Anita Solberg', updated: '2026-05-21', reviewIn: 60, status: 'approved' },
  { id: 'D-008', title: 'Tilsynsbrev fra Arbeidstilsynet', type: 'Rapport', owner: 'Bjørn Haug', updated: '2026-05-05', reviewIn: 30, status: 'draft' },
  { id: 'D-009', title: 'Risikoanalyse 3. etasje', type: 'Rapport', owner: 'Cecilie Dahl', updated: '2026-04-30', reviewIn: 14, status: 'reviewed' },
  { id: 'D-010', title: 'Etiske retningslinjer', type: 'Prosedyre', owner: 'Daniel Nordvik', updated: '2026-01-22', reviewIn: 200, status: 'approved' },
]

const PAGE_SIZE = 5
const ALL_COLS = ['title', 'type', 'owner', 'updated', 'review', 'status'] as const
type ColKey = (typeof ALL_COLS)[number]

function SelectableDocumentsTable() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [hiddenCols, setHiddenCols] = useState<Set<ColKey>>(new Set())
  const [colsMenuOpen, setColsMenuOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return DOCS
    return DOCS.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.owner.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q),
    )
  }, [filter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const allOnPageSelected = paged.length > 0 && paged.every((d) => selected.has(d.id))
  const someOnPageSelected = paged.some((d) => selected.has(d.id))

  const togglePage = () => {
    setSelected((s) => {
      const next = new Set(s)
      if (allOnPageSelected) {
        paged.forEach((d) => next.delete(d.id))
      } else {
        paged.forEach((d) => next.add(d.id))
      }
      return next
    })
  }

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCol = (c: ColKey) => {
    setHiddenCols((s) => {
      const next = new Set(s)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const isHidden = (c: ColKey) => hiddenCols.has(c)

  return (
    <div className={CARD} style={CARD_SHADOW}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
            placeholder="Filtrer dokumenter…"
            className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
          />
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <BulkBar count={selected.size} onClear={() => setSelected(new Set())} />
          ) : null}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setColsMenuOpen((o) => !o)}
              icon={<Filter className="size-3.5" />}
            >
              Kolonner
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
            {colsMenuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  aria-hidden
                  onClick={() => setColsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
                  {COL_LABELS.map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={!isHidden(key)}
                        onChange={() => toggleCol(key)}
                        className="size-4 accent-[#1a3d32]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-10 pl-5`}>
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected
                  }}
                  onChange={togglePage}
                  className="size-4 accent-[#1a3d32]"
                  aria-label="Velg alle på siden"
                />
              </th>
              {!isHidden('title') && <th className={TH}>Tittel</th>}
              {!isHidden('type') && <th className={TH}>Type</th>}
              {!isHidden('owner') && <th className={TH}>Eier</th>}
              {!isHidden('updated') && <th className={TH}>Oppdatert</th>}
              {!isHidden('review') && <th className={`${TH} text-right`}>Revisjon</th>}
              {!isHidden('status') && <th className={`${TH} pr-5`}>Status</th>}
              <th className={`${TH} w-10 pr-5`} aria-label="Handlinger" />
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={ALL_COLS.length + 2}
                  className="px-5 py-12 text-center text-sm text-neutral-500"
                >
                  Ingen treff på «{filter}».
                </td>
              </tr>
            ) : (
              paged.map((d) => {
                const checked = selected.has(d.id)
                return (
                  <tr
                    key={d.id}
                    className={`transition ${checked ? 'bg-[#F7F4EE]' : 'hover:bg-neutral-50'}`}
                  >
                    <td className={`${TD} pl-5`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(d.id)}
                        className="size-4 accent-[#1a3d32]"
                        aria-label={`Velg ${d.title}`}
                      />
                    </td>
                    {!isHidden('title') && (
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 shrink-0 text-neutral-400" aria-hidden />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-neutral-900">{d.title}</div>
                            <div className="font-mono text-[10px] uppercase tracking-wide text-neutral-400">
                              {d.id}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}
                    {!isHidden('type') && (
                      <td className={`${TD} text-neutral-600`}>{d.type}</td>
                    )}
                    {!isHidden('owner') && (
                      <td className={`${TD} text-neutral-600`}>{d.owner}</td>
                    )}
                    {!isHidden('updated') && (
                      <td className={`${TD} text-neutral-600`}>{fmtDate(d.updated)}</td>
                    )}
                    {!isHidden('review') && (
                      <td className={`${TD} text-right`}>
                        <ReviewBadge days={d.reviewIn} />
                      </td>
                    )}
                    {!isHidden('status') && (
                      <td className={TD}>
                        <Badge variant={docStatusBadge(d.status)}>{docStatusLabel(d.status)}</Badge>
                      </td>
                    )}
                    <td className={`${TD} pr-5 text-right`}>
                      <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Flere handlinger"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 md:px-5">
        <span>
          {selected.size > 0
            ? `${selected.size} av ${filtered.length} rader valgt`
            : `${filtered.length} rader totalt`}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Side <span className="font-medium text-neutral-700">{safePage}</span> av{' '}
            <span className="font-medium text-neutral-700">{pageCount}</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
          >
            Forrige
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={safePage === pageCount}
          >
            Neste
          </Button>
        </div>
      </div>
    </div>
  )
}

const COL_LABELS: [ColKey, string][] = [
  ['title', 'Tittel'],
  ['type', 'Type'],
  ['owner', 'Eier'],
  ['updated', 'Oppdatert'],
  ['review', 'Revisjon'],
  ['status', 'Status'],
]

function BulkBar({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900"
      role="status"
    >
      <span className="font-semibold">{count} valgt</span>
      <span className="h-3.5 w-px bg-emerald-300" aria-hidden />
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-emerald-100"
      >
        <Mail className="size-3.5" />
        Send
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-emerald-100"
      >
        <Download className="size-3.5" />
        Eksporter
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-red-700 hover:bg-red-100"
      >
        <Trash2 className="size-3.5" />
        Slett
      </button>
      <span className="h-3.5 w-px bg-emerald-300" aria-hidden />
      <button
        type="button"
        onClick={onClear}
        className="rounded px-1.5 py-0.5 hover:bg-emerald-100"
      >
        Nullstill
      </button>
    </div>
  )
}

function ReviewBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">
        <Calendar className="size-3" />
        Forfalt {Math.abs(days)}d
      </span>
    )
  }
  if (days < 14) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        <Calendar className="size-3" />
        {days}d
      </span>
    )
  }
  return (
    <span className="text-xs text-neutral-500">om {days}d</span>
  )
}

function docStatusBadge(s: DocRow['status']): BadgeVariant {
  if (s === 'approved') return 'success'
  if (s === 'reviewed') return 'info'
  return 'draft'
}
function docStatusLabel(s: DocRow['status']) {
  return ({ approved: 'Godkjent', reviewed: 'Vurdert', draft: 'Utkast' } as Record<
    DocRow['status'],
    string
  >)[s]
}
