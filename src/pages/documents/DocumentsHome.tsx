import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2, FileText, Plus, ShieldCheck } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { PAGE_TEMPLATES, LEGAL_COVERAGE } from '../../data/documentTemplates'
import type { WikiSpace } from '../../types/documents'

const CATEGORY_LABELS: Record<WikiSpace['category'], string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

const CATEGORY_ICONS: Record<WikiSpace['category'], string> = {
  hms_handbook: '📋',
  policy: '📜',
  procedure: '🔄',
  guide: '📖',
  template_library: '🗂️',
}

export function DocumentsHome() {
  const docs = useDocuments()
  const [showNewSpace, setShowNewSpace] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState<WikiSpace['category']>('hms_handbook')

  const activeSpaces = docs.spaces.filter((s) => s.status === 'active')
  const totalCovered = LEGAL_COVERAGE.filter(() =>
    docs.pages.some((p) => p.status === 'published'),
  ).length
  void totalCovered

  function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    docs.createSpace(newTitle, newDesc, newCategory, CATEGORY_ICONS[newCategory])
    setNewTitle('')
    setNewDesc('')
    setShowNewSpace(false)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Documents & Wiki
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            HMS-håndbok, policyer og prosedyrer. Bygd for å oppfylle kravene i{' '}
            <strong>Internkontrollforskriften §5</strong> og <strong>Arbeidsmiljøloven §3-1</strong>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/documents/compliance"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ShieldCheck className="size-4 text-emerald-600" />
            Samsvarsstatus
          </Link>
          <button
            type="button"
            onClick={() => setShowNewSpace(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
          >
            <Plus className="size-4" />
            Ny mappe
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Publiserte sider" value={docs.stats.published} icon={<FileText className="size-5 text-emerald-600" />} />
        <StatCard label="Utkast" value={docs.stats.drafts} icon={<BookOpen className="size-5 text-amber-500" />} />
        <StatCard label="Krever signatur" value={docs.stats.requireAck} icon={<ShieldCheck className="size-5 text-[#1a3d32]" />} />
        <StatCard label="Compliance-kvitteringer" value={docs.stats.acknowledged} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
      </div>

      {/* New space form */}
      {showNewSpace && (
        <form onSubmit={handleCreateSpace} className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-800">Ny dokumentmappe</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tittel"
              required
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as WikiSpace['category'])}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              {(Object.keys(CATEGORY_LABELS) as WikiSpace['category'][]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Kort beskrivelse"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm sm:col-span-2 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
              Opprett
            </button>
            <button type="button" onClick={() => setShowNewSpace(false)} className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
              Avbryt
            </button>
          </div>
        </form>
      )}

      {/* Spaces grid */}
      <div className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-neutral-700">Mapper</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeSpaces.map((space) => {
            const pagesInSpace = docs.pages.filter((p) => p.spaceId === space.id)
            const published = pagesInSpace.filter((p) => p.status === 'published').length
            return (
              <Link
                key={space.id}
                to={`/documents/space/${space.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{space.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-neutral-900 group-hover:text-[#1a3d32]">{space.title}</div>
                    <div className="mt-0.5 text-xs text-neutral-500">{CATEGORY_LABELS[space.category]}</div>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 line-clamp-2">{space.description}</p>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>{pagesInSpace.length} sider</span>
                  {published > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{published} publisert</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Template library */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-700">Malbibliotek</h2>
          <span className="text-xs text-neutral-500">{PAGE_TEMPLATES.length} forhåndsbygde maler</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAGE_TEMPLATES.map((tpl) => (
            <TemplateCard key={tpl.id} tpl={tpl} spaces={activeSpaces} onUse={(spaceId) => {
              const page = docs.createPage(
                spaceId,
                tpl.page.title,
                tpl.page.template,
                tpl.page.blocks,
                { legalRefs: tpl.page.legalRefs, requiresAcknowledgement: tpl.page.requiresAcknowledgement, summary: tpl.page.summary },
              )
              window.location.href = `/documents/page/${page.id}/edit`
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-50">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums text-neutral-900">{value}</div>
        <div className="text-sm text-neutral-500">{label}</div>
      </div>
    </div>
  )
}

function TemplateCard({
  tpl,
  spaces,
  onUse,
}: {
  tpl: typeof PAGE_TEMPLATES[0]
  spaces: WikiSpace[]
  onUse: (spaceId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(spaces[0]?.id ?? '')
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="font-medium text-neutral-900">{tpl.label}</div>
      <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{tpl.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tpl.legalBasis.slice(0, 2).map((ref) => (
          <span key={ref} className="rounded bg-[#1a3d32]/8 px-1.5 py-0.5 font-mono text-[10px] text-[#1a3d32]">{ref}</span>
        ))}
        {tpl.legalBasis.length > 2 && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">+{tpl.legalBasis.length - 2}</span>
        )}
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          >
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onUse(selected)}
              className="flex-1 rounded-lg bg-[#1a3d32] py-1.5 text-xs font-medium text-white hover:bg-[#142e26]"
            >
              Bruk mal
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setSelected(spaces[0]?.id ?? ''); setOpen(true) }}
          className="mt-3 w-full rounded-lg border border-neutral-200 py-1.5 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50"
        >
          + Bruk mal
        </button>
      )}
    </div>
  )
}
