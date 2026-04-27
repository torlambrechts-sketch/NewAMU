import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { TEMPLATE_CATEGORIES, type SurveyTemplateCatalogRow } from '../surveyTemplateCatalogTypes'

const CREAM_DEEP = '#EFE8DC'

type Props = {
  templates: SurveyTemplateCatalogRow[]
  loading: boolean
  onUseTemplate: (templateId: string) => void
  canManage: boolean
}

function categoryLabel(id: string): string {
  return TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

function questionCount(t: SurveyTemplateCatalogRow): number {
  return t.body?.questions?.length ?? 0
}

export function SurveyMalerTab({ templates, loading, onUseTemplate, canManage }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [audience, setAudience] = useState('')
  const [orderBy, setOrderBy] = useState<'name' | 'duration' | 'questions'>('name')

  const categoryOptions = useMemo(
    () => [{ value: '', label: 'Alle kategorier' }, ...TEMPLATE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))],
    [],
  )

  const audienceOptions = [
    { value: '', label: 'Alle målgrupper' },
    { value: 'internal', label: 'Ansatte' },
    { value: 'external', label: 'Leverandør' },
    { value: 'both', label: 'Begge' },
  ]

  const orderOptions = [
    { value: 'name', label: 'Navn (A–Å)' },
    { value: 'duration', label: 'Varighet (kort først)' },
    { value: 'questions', label: 'Antall spørsmål' },
  ]

  const filtered = useMemo(() => {
    let rows = [...templates]
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((t) => {
        const hay = [t.name, t.short_name, t.description, t.source, t.use_case, t.scoring_note, t.law_ref]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }
    if (category) {
      rows = rows.filter((t) => t.category === category)
    }
    if (audience) {
      rows = rows.filter((t) => t.audience === audience || t.audience === 'both')
    }
    rows.sort((a, b) => {
      if (orderBy === 'duration') return a.estimated_minutes - b.estimated_minutes
      if (orderBy === 'questions') return questionCount(b) - questionCount(a)
      return a.name.localeCompare(b.name, 'nb')
    })
    return rows
  }, [templates, search, category, audience, orderBy])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-neutral-800">Maler</p>
        <p className="mt-1 text-sm text-neutral-600">
          Velg et utgangspunkt for undersøkelsen. Listen kommer fra databasen (system- og egenorganisasjonsmaler).
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
        <StandardInput
          type="search"
          id="survey-template-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk i navn, beskrivelse, kilde…"
          className="w-full py-2.5 pl-10 pr-3"
          aria-label="Søk i maler"
        />
      </div>

      <div
        className="grid gap-4 rounded-lg border border-neutral-200/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ backgroundColor: CREAM_DEEP }}
      >
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Kategori
          <div className="mt-1.5">
            <SearchableSelect value={category} options={categoryOptions} onChange={setCategory} />
          </div>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Målgruppe
          <div className="mt-1.5">
            <SearchableSelect value={audience} options={audienceOptions} onChange={setAudience} />
          </div>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Sorter etter
          <div className="mt-1.5">
            <SearchableSelect
              value={orderBy}
              options={orderOptions}
              onChange={(v) => setOrderBy(v as 'name' | 'duration' | 'questions')}
            />
          </div>
        </label>
        <div className="flex flex-col justify-end pb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Treff</span>
          <p className="mt-1 text-sm text-neutral-700">
            {loading ? '…' : `${filtered.length} av ${templates.length}`}
          </p>
        </div>
      </div>

      {loading && templates.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">Laster maler…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          {templates.length === 0
            ? 'Ingen maler i katalogen (kjør database-migrering eller kontakt administrator).'
            : 'Ingen maler matcher filteret.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} canManage={canManage} onUse={() => onUseTemplate(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateCard({
  template: t,
  canManage,
  onUse,
}: {
  template: SurveyTemplateCatalogRow
  canManage: boolean
  onUse: () => void
}) {
  const icon = (t.short_name ?? t.name).slice(0, 2).toUpperCase()
  const nQ = questionCount(t)
  const orgBadge = !t.is_system && t.organization_id ? 'Egen mal' : null
  const recommended = t.id === 'tpl-uwes' || t.id === 'tpl-qps-nordic'

  return (
    <div
      className={[
        'flex flex-col gap-3 rounded-xl border bg-white p-4 transition-all hover:-translate-y-px',
        recommended ? 'border-[#1a3d32] ring-2 ring-[#e7efe9]' : 'border-neutral-200 hover:border-neutral-300',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-sm font-bold text-[#1a3d32]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">{t.name}</p>
          {t.source && <p className="truncate text-xs text-neutral-500">{t.source}</p>}
          {recommended && <p className="text-xs font-semibold text-[#1a3d32]">⭐ Anbefalt</p>}
          {orgBadge && (
            <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
              {orgBadge}
            </span>
          )}
        </div>
      </div>

      {t.description && <p className="flex-1 text-xs leading-relaxed text-neutral-600">{t.description}</p>}

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
          {categoryLabel(t.category)}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
          {nQ} spm.
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
          ~{t.estimated_minutes} min
        </span>
        {t.audience === 'external' && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            Leverandør
          </span>
        )}
        {t.audience === 'internal' && (
          <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-medium text-[#1a3d32]">
            Ansatte
          </span>
        )}
        {t.audience === 'both' && (
          <span className="rounded-full bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600">
            Alle
          </span>
        )}
        {t.law_ref && (
          <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-medium text-[#1a3d32]">
            {t.law_ref}
          </span>
        )}
      </div>

      {canManage && (
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="primary" size="sm" onClick={onUse}>
            Bruk mal
          </Button>
        </div>
      )}
    </div>
  )
}
