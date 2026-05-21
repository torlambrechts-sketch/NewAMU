// "Mine favoritter" — the cross-module aggregated favourites page.
//
// Why it exists: every module's template list can star a template, but a
// user wants ONE place that gathers their daily working set. Templates are
// grouped by module, reorderable within a module, and the role-based
// starter list can be (re-)applied additively.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpRight, GripVertical, Sparkles, Star, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useFavorites } from '../../components/favorites/favoritesContext'
import {
  TEMPLATE_KINDS,
  TEMPLATE_KIND_HOME,
  TEMPLATE_KIND_LABELS,
  type TemplateFavorite,
  type TemplateKind,
} from '../../types/favorites'

function FavoriteRow({
  fav,
  onRemove,
}: {
  fav: TemplateFavorite
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fav.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5',
        isDragging ? 'opacity-60 shadow-md' : '',
      ].join(' ')}
    >
      <Button
        variant="ghost"
        size="icon"
        className="cursor-grab text-neutral-300 hover:text-neutral-500"
        aria-label="Endre rekkefølge"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </Button>
      <Star className="h-4 w-4 shrink-0 text-amber-500" aria-hidden fill="currentColor" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800">{fav.title}</p>
        {!fav.resolved && (
          <p className="text-xs text-rose-500">Malen finnes ikke lenger — kan fjernes.</p>
        )}
        {fav.source === 'role_default' && fav.resolved && (
          <p className="text-xs text-neutral-400">Rolleforslag</p>
        )}
      </div>
      <Link
        to={TEMPLATE_KIND_HOME[fav.templateKind]}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
      >
        Åpne <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Fjern ${fav.title} fra favoritter`}
        className="text-neutral-400 hover:bg-rose-50 hover:text-rose-500"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  )
}

function ModuleSection({
  kind,
  items,
}: {
  kind: TemplateKind
  items: TemplateFavorite[]
}) {
  const { toggle, reorder } = useFavorites()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((f) => f.id === active.id)
    const newIndex = items.findIndex((f) => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const ordered = arrayMove(items, oldIndex, newIndex)
    void reorder(kind, ordered.map((f) => f.id))
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {TEMPLATE_KIND_LABELS[kind]}
        <span className="ml-2 font-normal text-neutral-400">{items.length}</span>
      </h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {items.map((fav) => (
              <FavoriteRow
                key={fav.id}
                fav={fav}
                onRemove={() => void toggle(kind, fav.templateRef)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  )
}

export function MyFavoritesPage() {
  const { loading, favorites, applyRoleDefaults } = useFavorites()
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)

  const byKind = useMemo(() => {
    const map = new Map<TemplateKind, TemplateFavorite[]>()
    for (const kind of TEMPLATE_KINDS) {
      const items = favorites
        .filter((f) => f.templateKind === kind)
        .sort((a, b) => a.position - b.position)
      if (items.length) map.set(kind, items)
    }
    return map
  }, [favorites])

  const onApplyDefaults = async () => {
    setApplying(true)
    setApplyMsg(null)
    try {
      const added = await applyRoleDefaults()
      setApplyMsg(
        added > 0
          ? `La til ${added} forslag fra rollen din.`
          : 'Ingen nye forslag — favorittene dine er allerede oppdatert.',
      )
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
            <Star className="h-5 w-5 text-amber-500" aria-hidden fill="currentColor" />
            Mine favoritter
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Malene du bruker oftest — på tvers av alle moduler. Stjernemerk en mal
            hvor som helst, så dukker den opp her.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void onApplyDefaults()}
          disabled={applying}
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
        >
          {applying ? 'Henter forslag …' : 'Bruk rolleforslag'}
        </Button>
      </header>

      {applyMsg && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {applyMsg}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Laster favoritter …</p>
      ) : byKind.size === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
          <Star className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-neutral-700">Ingen favoritter ennå</p>
          <p className="mt-1 text-sm text-neutral-500">
            Stjernemerk maler i modulene, eller hent forslagene for rollen din.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...byKind.entries()].map(([kind, items]) => (
            <ModuleSection key={kind} kind={kind} items={items} />
          ))}
        </div>
      )}
    </div>
  )
}
