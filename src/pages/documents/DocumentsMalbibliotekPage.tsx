import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, LayoutTemplate, Plus, Scale, Search } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { FavoriteToggle } from '../../components/favorites/FavoriteToggle'
import type { PageTemplate, SpaceCategory } from '../../types/documents'

/**
 * Dokumenter — Malbibliotek (`/documents/malbibliotek`).
 *
 * Rebuilt from the Claude Design "Rec09" artboard: a searchable gallery of
 * system + org templates with a "Nytt fra mal" panel that creates a draft
 * wiki page from the chosen template and opens it in the editor.
 */

const CATEGORY_LABEL: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veileder',
  template_library: 'Malbibliotek',
  varsling: 'Varsling',
  personal: 'Personal',
  personvern: 'Personvern',
  likestilling: 'Likestilling',
  protokoll: 'Protokoll',
  register: 'Register',
  beredskap: 'Beredskap',
  bransje: 'Bransje',
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: PageTemplate
  selected: boolean
  onSelect: () => void
}) {
  const blockCount = Array.isArray(template.page.blocks) ? template.page.blocks.length : 0
  return (
    <div className="relative h-full">
      <FavoriteToggle
        kind="document"
        templateRef={template.id}
        templateName={template.label}
        size="sm"
        className="absolute right-1.5 top-1.5 z-10 bg-white/90"
      />
    <Button
      variant="ghost"
      onClick={onSelect}
      className={`flex h-full flex-col items-stretch rounded-xl border p-0 text-left font-normal ${
        selected ? 'border-[#0f766e] ring-1 ring-[#0f766e]/30' : 'border-neutral-200/80 hover:border-neutral-300'
      }`}
    >
      <span className="flex h-[88px] items-center justify-center rounded-t-xl bg-gradient-to-br from-[#f1f6f5] to-[#e6f2f0]">
        <LayoutTemplate className="h-8 w-8 text-[#0f766e]" aria-hidden />
      </span>
      <span className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="flex items-start justify-between gap-2 pr-6">
          <span className="truncate text-[13px] font-semibold text-neutral-900">{template.label}</span>
          {template.legalBasis[0] ? <Badge variant="info">{template.legalBasis[0]}</Badge> : null}
        </span>
        <span className="text-[11px] text-neutral-500">
          {CATEGORY_LABEL[template.category] ?? template.category} · {blockCount} blokker
        </span>
      </span>
    </Button>
    </div>
  )
}

export function DocumentsMalbibliotekPage() {
  const docs = useDocuments()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [targetSpaceId, setTargetSpaceId] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const templates = docs.pageTemplates

  const categories = useMemo(() => {
    const set = new Set<SpaceCategory>()
    for (const t of templates) set.add(t.category)
    return [...set]
  }, [templates])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false
      if (q && !`${t.label} ${t.description}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [templates, query, categoryFilter])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const handleCreate = async () => {
    if (!selected || !targetSpaceId || !title.trim()) return
    setBusy(true)
    setCreateError(null)
    try {
      const page = await docs.createPage(
        targetSpaceId,
        title.trim(),
        selected.page.template ?? 'standard',
        Array.isArray(selected.page.blocks) ? selected.page.blocks : [],
        {
          summary: selected.page.summary,
          legalRefs: selected.page.legalRefs,
          requiresAcknowledgement: selected.page.requiresAcknowledgement,
          templateId: selected.id,
        },
      )
      navigate(`/documents/page/${page.id}/reference-edit`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Kunne ikke opprette dokument.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
              <StandardInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="!pl-9"
                placeholder="Søk i maler…"
              />
            </div>
            <SearchableSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="Kategori: Alle"
              options={[
                { value: '', label: 'Kategori: Alle' },
                ...categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] ?? c })),
              ]}
              triggerClassName="py-2 text-xs"
            />
          </div>

          {filtered.length > 0 && !query && !categoryFilter ? (
            <ModuleSectionCard className="!p-0">
              <div className="border-b border-neutral-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-neutral-900">Anbefalt</h3>
                <p className="text-[11px] text-neutral-500">Forhåndsgodkjente HMS-maler med lov-anker.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 p-3">
                {filtered.slice(0, 3).map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selectedId === t.id}
                    onSelect={() => {
                      setSelectedId(t.id)
                      setTitle(t.label)
                    }}
                  />
                ))}
              </div>
            </ModuleSectionCard>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">
              Alle maler · {filtered.length}
            </h3>
            {filtered.length === 0 ? (
              <ModuleSectionCard>
                <p className="py-8 text-center text-sm text-neutral-500">Ingen maler i dette utvalget.</p>
              </ModuleSectionCard>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {filtered.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selectedId === t.id}
                    onSelect={() => {
                      setSelectedId(t.id)
                      setTitle(t.label)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nytt fra mal panel */}
        <div className="sticky top-4 self-start">
          <ModuleSectionCard className="!p-0 overflow-hidden">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Nytt fra mal</p>
              <p className="mt-0.5 font-serif text-[15px] font-semibold tracking-tight text-neutral-900">
                {selected ? selected.label : 'Velg en mal'}
              </p>
            </div>
            {selected ? (
              <div className="space-y-3 px-4 py-4">
                <p className="text-[13px] text-neutral-600">{selected.description}</p>
                {selected.legalBasis.length > 0 ? (
                  <p className="flex flex-wrap items-center gap-1">
                    <Scale className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                    {selected.legalBasis.map((ref) => (
                      <Badge key={ref} variant="info">
                        {ref}
                      </Badge>
                    ))}
                  </p>
                ) : null}
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Tittel</span>
                  <StandardInput
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                    placeholder="Dokumenttittel"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Plassering</span>
                  <SearchableSelect
                    value={targetSpaceId}
                    onChange={setTargetSpaceId}
                    placeholder="Velg mappe…"
                    className="mt-1"
                    options={docs.spaces
                      .filter((s) => s.status !== 'archived')
                      .map((s) => ({ value: s.id, label: s.title }))}
                  />
                </label>
                {createError ? <p className="text-xs text-red-700">{createError}</p> : null}
                <Button
                  className="w-full"
                  disabled={busy || !targetSpaceId || !title.trim()}
                  icon={<FileText className="h-4 w-4" aria-hidden />}
                  onClick={() => void handleCreate()}
                >
                  {busy ? 'Oppretter…' : 'Opprett dokument'}
                </Button>
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-[13px] text-neutral-500">
                <Plus className="mx-auto mb-2 h-6 w-6 text-neutral-300" aria-hidden />
                Velg en mal fra galleriet for å opprette et nytt dokument.
              </div>
            )}
          </ModuleSectionCard>
        </div>
      </div>
    </div>
  )
}
