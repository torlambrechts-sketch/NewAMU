// ChecklistsLibraryPage — "Bibliotek" — Direction 5a side-by-side page.
//
// Three-lens view: Pakke | Kategori | Alle
//   • Pakke   — sub-tabs per licensed pack; context card shows pack info
//   • Kategori — sub-tabs per category; context card shows category info
//   • Alle    — two-column grid: all templates + all executions
//
// Each lens shows "Maler å starte fra" alongside "Nylig aktivitet".
// "Se alle" links navigate to /maler (template library) and /aktivitet
// (execution log).

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Plus,
  Scale,
  Users,
} from 'lucide-react'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import type { ComplianceExecutionRow, ComplianceTemplateRow } from './types'

type Lens = 'pakke' | 'kategori' | 'alle'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  active: 'Pågående',
  signed: 'Fullført',
}
const STATUS_BADGE = {
  draft: 'draft',
  active: 'active',
  signed: 'signed',
} as const

// Compact inline dropdown filter chip
function MiniFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: { id: string; label: string }[]
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.id === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
          value
            ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
        }`}
      >
        {label}
        {current ? `: ${current.label}` : ''}
        <ChevronRight className="h-3 w-3 rotate-90" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-30 min-w-[160px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-50 ${!value ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}
            >
              Alle
            </button>
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-50 ${
                  value === o.id ? 'font-semibold text-[#1a3d32]' : 'text-neutral-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Template card (compact)
function TemplateCard({
  template,
  categoryName,
  onClick,
}: {
  template: ComplianceTemplateRow
  categoryName: string | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-[#1a3d32]/40 hover:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-neutral-900 group-hover:text-[#1a3d32]">
          {template.name}
        </span>
        {template.review_status === 'approved' && (
          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1a3d32]" />
        )}
      </div>
      {categoryName ? (
        <p className="mt-0.5 text-xs text-neutral-500">{categoryName}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {template.cadence_hint ? (
          <Badge variant="info">{template.cadence_hint}</Badge>
        ) : null}
        {template.review_status === 'approved' ? (
          <Badge variant="success">Offisiell</Badge>
        ) : template.review_status === 'reviewed' ? (
          <Badge variant="neutral">Verifisert</Badge>
        ) : null}
      </div>
    </button>
  )
}

// Single activity/execution row
function ActivityRow({
  execution,
  templateName,
  categoryName,
}: {
  execution: ComplianceExecutionRow
  templateName: string | null
  categoryName: string | null
}) {
  const navigate = useNavigate()
  const initials = execution.title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()

  return (
    <button
      onClick={() => navigate(`/compliance/checklists/${execution.id}`)}
      className="flex w-full items-start gap-2.5 border-t border-neutral-100 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50 first:border-t-0"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a3d32] text-[10px] font-bold text-white">
        {initials || '??'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-neutral-800">
          <span className="font-medium text-neutral-900">{execution.title}</span>
          {templateName ? (
            <span className="text-neutral-600"> · {templateName}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {categoryName ? `${categoryName} · ` : ''}
          {new Date(execution.updated_at).toLocaleDateString('nb-NO', {
            dateStyle: 'short',
          })}
        </p>
      </div>
      <Badge variant={STATUS_BADGE[execution.status] ?? 'neutral'}>
        {STATUS_LABEL[execution.status] ?? execution.status}
      </Badge>
    </button>
  )
}

export function ChecklistsLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const lens = (searchParams.get('lens') as Lens) ?? 'pakke'
  const lensVal = searchParams.get('lv')

  const licensedPacks = useLicensedPacks()
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const navigate = useNavigate()

  const [tplStatus, setTplStatus] = useState<string | null>(null)
  const [actStatus, setActStatus] = useState<string | null>(null)

  useEffect(() => {
    void cl.load()
  }, [cl])

  function setLens(l: Lens) {
    const p = new URLSearchParams(searchParams)
    p.set('lens', l)
    p.delete('lv')
    setSearchParams(p, { replace: true })
  }

  function setLensVal(v: string) {
    const p = new URLSearchParams(searchParams)
    p.set('lv', v)
    setSearchParams(p, { replace: true })
  }

  // Build sub-tabs list for the active lens
  const tabs = useMemo(() => {
    if (lens === 'pakke') {
      return licensedPacks.map((p) => ({ id: p.slug, label: p.shortName }))
    }
    if (lens === 'kategori') {
      return cl.categories
        .filter((c) => c.is_active)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
        .map((c) => ({ id: c.id, label: c.name }))
    }
    return []
  }, [lens, licensedPacks, cl.categories])

  const activeTab = tabs.find((t) => t.id === lensVal)?.id ?? tabs[0]?.id ?? null

  // Context card data
  const activePack =
    lens === 'pakke' && activeTab
      ? (licensedPacks.find((p) => p.slug === activeTab) ?? null)
      : null
  const activeCat =
    lens === 'kategori' && activeTab
      ? (cl.categories.find((c) => c.id === activeTab) ?? null)
      : null

  const categoryNameById = useMemo(
    () => new Map(cl.categories.map((c) => [c.id, c.name])),
    [cl.categories],
  )
  const templateById = useMemo(
    () => new Map(cl.templates.map((t) => [t.id, t])),
    [cl.templates],
  )

  // Filter templates for the active lens + value
  const filteredTemplates = useMemo(() => {
    let list = [...cl.templates].filter((t) => t.is_active)
    if (lens === 'pakke' && activeTab) list = list.filter((t) => t.pack === activeTab)
    if (lens === 'kategori' && activeTab) list = list.filter((t) => t.category_id === activeTab)
    if (tplStatus === 'approved') list = list.filter((t) => t.review_status === 'approved')
    if (tplStatus === 'reviewed') list = list.filter((t) => t.review_status === 'reviewed')
    if (tplStatus === 'pinned') list = list.filter((t) => t.nav_pinned)
    return list
  }, [cl.templates, lens, activeTab, tplStatus])

  // Filter executions for the active lens + value
  const filteredExecutions = useMemo(() => {
    let list = [...cl.executions]
    if (lens === 'pakke' && activeTab) list = list.filter((e) => e.pack === activeTab)
    if (lens === 'kategori' && activeTab) {
      list = list.filter((e) => {
        const tpl = templateById.get(e.template_id)
        return tpl?.category_id === activeTab
      })
    }
    if (actStatus) list = list.filter((e) => e.status === actStatus)
    return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [cl.executions, lens, activeTab, actStatus, templateById])

  const hasContextCard = activePack !== null || activeCat !== null

  const pageTitle =
    lens === 'pakke'
      ? 'Maler etter pakke'
      : lens === 'kategori'
        ? 'Maler etter kategori'
        : 'Alle maler'
  const pageSubtitle =
    lens === 'pakke'
      ? 'Maler og aktivitet per lovverk og pakke'
      : lens === 'kategori'
        ? 'Maler og aktivitet per kategori'
        : 'Hele biblioteket med alle maler og aktivitet'

  const TPL_FILTER_OPTS = [
    { id: 'approved', label: 'Offisiell' },
    { id: 'reviewed', label: 'Verifisert' },
    { id: 'pinned', label: 'Festet' },
  ]
  const ACT_FILTER_OPTS = [
    { id: 'active', label: 'Pågående' },
    { id: 'signed', label: 'Fullført' },
    { id: 'draft', label: 'Kladd' },
  ]

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      {/* Page header */}
      <header className="bg-[#F9F7F2]">
        <div className="mx-auto max-w-[1400px] px-4 pb-0 pt-4 md:px-8">
          {/* Breadcrumb + title + segmented control */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <nav className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Link to="/compliance/checklists" className="hover:text-neutral-700">
                  Sjekklister
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="font-medium text-neutral-700">Bibliotek</span>
              </nav>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
                {pageTitle}
              </h1>
              <p className="mt-0.5 text-sm text-neutral-600">{pageSubtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Tri-mode segmented control */}
              <div className="inline-flex rounded-lg bg-neutral-100 p-1 gap-0.5">
                {(
                  [
                    { id: 'pakke', label: 'Pakke', LucideIcon: Scale },
                    { id: 'kategori', label: 'Kategori', LucideIcon: Users },
                    { id: 'alle', label: 'Alle', LucideIcon: LayoutGrid },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setLens(m.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      lens === m.id
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-800'
                    }`}
                  >
                    <m.LucideIcon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>

              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => navigate('/compliance/checklists')}
              >
                Ny sjekkliste
              </Button>
            </div>
          </div>

          {/* Sub-tabs (hidden in 'alle' lens) */}
          {tabs.length > 0 && (
            <div className="mt-3 flex gap-0 overflow-x-auto border-b border-neutral-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLensVal(tab.id)}
                  className={`flex-shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#1a3d32] text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:border-neutral-200 hover:text-neutral-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <div
          className={`grid gap-6 ${
            hasContextCard
              ? 'lg:grid-cols-[240px_1fr_1fr]'
              : 'lg:grid-cols-2'
          }`}
        >
          {/* Context card — only in pakke/kategori mode when a tab is active */}
          {hasContextCard && (
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                {activePack && (
                  <>
                    <div className="mb-1 font-serif text-2xl font-bold text-[#1a3d32]">
                      {activePack.shortName}
                    </div>
                    <div className="mb-3 text-sm font-semibold text-neutral-800">
                      {activePack.pluralLabel}
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-600">
                      {activePack.description}
                    </p>
                    {activePack.legalReferences.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          Sentrale referanser
                        </div>
                        {activePack.legalReferences.slice(0, 4).map((ref, i) => (
                          <div
                            key={i}
                            className="border-t border-neutral-100 py-1.5 text-xs text-neutral-700 first:border-t-0"
                          >
                            {ref.code}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {activeCat && (
                  <>
                    <div className="mb-1 text-lg font-bold text-neutral-900">
                      {activeCat.name}
                    </div>
                    {activeCat.description ? (
                      <p className="text-xs leading-relaxed text-neutral-600">
                        {activeCat.description}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <Badge variant="neutral">{activeCat.pack.toUpperCase()}</Badge>
                    </div>
                  </>
                )}
                {/* Stats */}
                <div className="mt-4 flex gap-4 border-t border-neutral-100 pt-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      Maler
                    </div>
                    <div className="text-xl font-bold tabular-nums text-neutral-900">
                      {filteredTemplates.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      Aktivitet
                    </div>
                    <div className="text-xl font-bold tabular-nums text-[#1a3d32]">
                      {filteredExecutions.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Templates column */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-neutral-900">Maler å starte fra</h2>
              <Link
                to="/compliance/checklists/maler"
                className="text-xs font-semibold text-[#1a3d32] hover:underline"
              >
                Se alle {cl.templates.filter((t) => t.is_active).length} →
              </Link>
            </div>

            {/* Inline filter chips */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <MiniFilter
                label="Status"
                value={tplStatus}
                options={TPL_FILTER_OPTS}
                onChange={setTplStatus}
              />
              {tplStatus && (
                <button
                  onClick={() => setTplStatus(null)}
                  className="text-xs text-neutral-400 hover:text-neutral-600"
                >
                  Nullstill
                </button>
              )}
              <span className="ml-auto text-xs text-neutral-500">
                {filteredTemplates.length} treff
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {filteredTemplates.slice(0, 8).map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  categoryName={
                    t.category_id ? (categoryNameById.get(t.category_id) ?? null) : null
                  }
                  onClick={() =>
                    navigate(
                      `/compliance/checklists?template=${encodeURIComponent(t.slug)}&pack=${encodeURIComponent(t.pack)}`,
                    )
                  }
                />
              ))}
              {filteredTemplates.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
                  Ingen maler matcher filtrene.
                </div>
              )}
            </div>
          </div>

          {/* Activity/Executions column */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-neutral-900">Nylig aktivitet</h2>
              <Link
                to="/compliance/checklists/aktivitet"
                className="text-xs font-semibold text-[#1a3d32] hover:underline"
              >
                Se all aktivitet →
              </Link>
            </div>

            {/* Inline filter chips */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <MiniFilter
                label="Status"
                value={actStatus}
                options={ACT_FILTER_OPTS}
                onChange={setActStatus}
              />
              {actStatus && (
                <button
                  onClick={() => setActStatus(null)}
                  className="text-xs text-neutral-400 hover:text-neutral-600"
                >
                  Nullstill
                </button>
              )}
              <span className="ml-auto text-xs text-neutral-500">
                {filteredExecutions.length} treff
              </span>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
              {filteredExecutions.slice(0, 8).map((e) => {
                const tpl = templateById.get(e.template_id)
                const catId = tpl?.category_id ?? null
                return (
                  <ActivityRow
                    key={e.id}
                    execution={e}
                    templateName={tpl?.name ?? null}
                    categoryName={catId ? (categoryNameById.get(catId) ?? null) : null}
                  />
                )
              })}
              {filteredExecutions.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-neutral-500">
                  Ingen aktivitet matcher filtrene.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
