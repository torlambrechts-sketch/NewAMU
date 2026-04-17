import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle2, Clock, FileText, Plus } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import type { PageTemplate, WikiSpace } from '../../types/documents'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { InspectionReadinessScore } from '../../components/documents/InspectionReadinessScore'

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

const CARD =
  'rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm transition hover:border-neutral-300'
const BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 text-sm font-medium text-white hover:bg-[#142e26]'
const BTN_OUTLINE =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'
const INPUT =
  'rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'

export function DocumentsHome() {
  const docs = useDocuments()
  const navigate = useNavigate()

  const [showNewSpace, setShowNewSpace] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState<WikiSpace['category']>('hms_handbook')
  const [savingSpace, setSavingSpace] = useState(false)

  const activeSpaces = docs.spaces.filter((s) => s.status === 'active')

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSavingSpace(true)
    try {
      await docs.createSpace(newTitle, newDesc, newCategory, CATEGORY_ICONS[newCategory])
      setNewTitle('')
      setNewDesc('')
      setShowNewSpace(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingSpace(false)
    }
  }

  return (
    <DocumentsModuleLayout
      subHeader={
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-b border-neutral-200/80 pb-6">
          <button type="button" onClick={() => setShowNewSpace(true)} className={BTN_PRIMARY}>
            <Plus className="size-4 shrink-0" aria-hidden />
            Ny mappe
          </button>
        </div>
      }
    >
      {docs.error && (
        <div className="mt-4 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {docs.error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Publiserte sider" value={docs.stats.published} icon={<FileText className="size-5 text-emerald-600" />} />
        <StatCard label="Utkast" value={docs.stats.drafts} icon={<BookOpen className="size-5 text-amber-500" />} />
        <StatCard label="Krever signatur" value={docs.stats.requireAck} icon={<FileText className="size-5 text-[#1a3d32]" />} />
        <StatCard label="Compliance-kvitteringer" value={docs.stats.acknowledged} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
      </div>

      <div className="mt-6">
        <InspectionReadinessScore />
      </div>

      {showNewSpace && (
        <form onSubmit={(e) => void handleCreateSpace(e)} className={`${CARD} mt-6`}>
          <h2 className="mb-4 text-sm font-semibold text-neutral-800">Ny dokumentmappe</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tittel"
              required
              className={INPUT}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as WikiSpace['category'])}
              className={`${INPUT} bg-white`}
            >
              {(Object.keys(CATEGORY_LABELS) as WikiSpace['category'][]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Kort beskrivelse"
              className={`${INPUT} sm:col-span-2`}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" disabled={savingSpace} className={BTN_PRIMARY}>
              {savingSpace ? 'Oppretter…' : 'Opprett'}
            </button>
            <button type="button" onClick={() => setShowNewSpace(false)} className={BTN_OUTLINE}>
              Avbryt
            </button>
          </div>
        </form>
      )}

      <div className="mt-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-neutral-500">Mapper</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeSpaces.map((space) => {
            const pagesInSpace = docs.pages.filter((p) => p.spaceId === space.id)
            const published = pagesInSpace.filter((p) => p.status === 'published').length
            return (
              <Link key={space.id} to={`/documents/space/${space.id}`} className={CARD}>
                <div className="flex items-start gap-3 border-b border-neutral-100 pb-3">
                  <span className="text-2xl">{space.icon}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                      {CATEGORY_LABELS[space.category]}
                    </span>
                    <div className="mt-1 font-serif text-lg font-semibold leading-snug text-[#1a3d32]">{space.title}</div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-neutral-600">{space.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                    {pagesInSpace.length} {pagesInSpace.length === 1 ? 'side' : 'sider'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                    {published} publisert
                  </span>
                </div>
                <span className={`${BTN_OUTLINE} mt-4 w-full sm:w-auto`}>Åpne mappe →</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Malbibliotek</h2>
          <span className="text-xs text-neutral-500">
            {docs.pageTemplates.length} {docs.backend === 'supabase' ? 'tilgjengelige maler' : 'mal(er) (demo lokalt)'}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.pageTemplates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              spaces={activeSpaces}
              onUse={async (spaceId) => {
                const page = await docs.createPage(
                  spaceId,
                  tpl.page.title,
                  tpl.page.template,
                  tpl.page.blocks,
                  {
                    legalRefs: tpl.page.legalRefs,
                    requiresAcknowledgement: tpl.page.requiresAcknowledgement,
                    summary: tpl.page.summary,
                  },
                )
                navigate(`/documents/page/${page.id}/edit`)
              }}
            />
          ))}
        </div>
      </div>
    </DocumentsModuleLayout>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-none bg-neutral-50">{icon}</div>
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
  tpl: PageTemplate
  spaces: WikiSpace[]
  onUse: (spaceId: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(spaces[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <div className="rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
      <div className="font-medium text-neutral-900">{tpl.label}</div>
      <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{tpl.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tpl.legalBasis.slice(0, 2).map((ref) => (
          <span key={ref} className="rounded-none bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#1a3d32]">
            {ref}
          </span>
        ))}
        {tpl.legalBasis.length > 2 && (
          <span className="rounded-none bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
            +{tpl.legalBasis.length - 2}
          </span>
        )}
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !selected}
              onClick={() => {
                setBusy(true)
                void Promise.resolve(onUse(selected)).finally(() => {
                  setBusy(false)
                  setOpen(false)
                })
              }}
              className="flex-1 rounded-none border border-[#1a3d32] bg-[#1a3d32] py-1.5 text-xs font-medium text-white hover:bg-[#142e26] disabled:opacity-50"
            >
              {busy ? '…' : 'Bruk mal'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-none border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSelected(spaces[0]?.id ?? '')
            setOpen(true)
          }}
          disabled={spaces.length === 0}
          className="mt-3 w-full rounded-none border border-neutral-200 py-1.5 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Bruk mal
        </button>
      )}
    </div>
  )
}
