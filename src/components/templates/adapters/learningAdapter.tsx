// Learning adapter — course modules become EditorStep rows. The shell
// edits the lightweight fields (title, duration, kind) inline; rich
// content (text body, quiz questions, scenarios) is too varied for the
// step-list metaphor, so the detail card surfaces a deep-link to the
// existing LearningCourseBuilder for those edits.
//
// Auto-save writes the in-memory modules into learning_courses.
// studio_draft_payload. «Publiser» promotes the draft into the
// learning_modules table (insert-or-update by id).

import {
  AlertTriangle,
  AlignLeft,
  Calendar,
  CheckSquare,
  ExternalLink,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Sparkles,
  Video,
} from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect } from '../../ui/SearchableSelect'
import type {
  AdapterMeta,
  EditorStep,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

type ModuleKind =
  | 'text'
  | 'flashcard'
  | 'quiz'
  | 'image'
  | 'video'
  | 'checklist'
  | 'tips'
  | 'on_job'
  | 'event'
  | 'scenario'
  | 'other'

const KIND_LABELS: Record<ModuleKind, string> = {
  text: 'Tekst',
  flashcard: 'Flashcards',
  quiz: 'Quiz',
  image: 'Bilde',
  video: 'Video',
  checklist: 'Sjekkliste',
  tips: 'Tips',
  on_job: 'Praksis',
  event: 'Aktivitet',
  scenario: 'Scenario',
  other: 'Annet',
}

const KIND_ICONS: Record<ModuleKind, typeof GraduationCap> = {
  text: AlignLeft,
  flashcard: Layers,
  quiz: ListChecks,
  image: ImageIcon,
  video: Video,
  checklist: CheckSquare,
  tips: Sparkles,
  on_job: CheckSquare,
  event: Calendar,
  scenario: AlertTriangle,
  other: GraduationCap,
}

type ModuleRow = {
  id: string
  title: string
  kind: ModuleKind
  sort_order: number
  duration_minutes: number
  content: unknown
}

type ModuleWithKey = ModuleRow & { _localKey: string }

export type LearningDraft = {
  courseId: string
  courseTitle: string
  modules: ModuleWithKey[]
  hasDraft: boolean
}

export type LearningAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

let localCounter = 0
function nextLocalKey() {
  localCounter += 1
  return `mod-${localCounter}-${Date.now()}`
}

function withLocalKeys(rows: ModuleRow[]): ModuleWithKey[] {
  return rows.map((r) => ({ ...r, _localKey: nextLocalKey() }))
}

export function createLearningAdapter(
  deps: LearningAdapterDeps,
): TemplateEditorAdapter<LearningDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'learning',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data: courseData, error: ce } = await supabase
        .from('learning_courses')
        .select('id, title, studio_draft_payload')
        .eq('id', rowId)
        .maybeSingle()
      if (ce || !courseData) return null
      const course = courseData as {
        id: string
        title: string
        studio_draft_payload: unknown
      }

      let modules: ModuleRow[] = []
      const draftPayload = course.studio_draft_payload as
        | { modules: ModuleRow[] }
        | null
        | undefined
      if (draftPayload && Array.isArray(draftPayload.modules)) {
        modules = draftPayload.modules
      } else {
        const { data: mods } = await supabase
          .from('learning_modules')
          .select('id, title, kind, sort_order, duration_minutes, content')
          .eq('course_id', rowId)
          .order('sort_order', { ascending: true })
        modules = (mods ?? []) as ModuleRow[]
      }

      const draft: LearningDraft = {
        courseId: course.id,
        courseTitle: course.title,
        modules: withLocalKeys(modules),
        hasDraft: !!draftPayload,
      }

      const meta: AdapterMeta = {
        title: course.title,
        subtitle:
          'Kurs-mal — moduler til venstre, detaljer til høyre. Rikt innhold redigeres i fullversjonen.',
        lawRefs: [],
        versionLabel: draft.hasDraft ? 'Utkast (ulagrede endringer)' : 'Publisert',
        accent: 'teal',
        icon: GraduationCap,
      }

      return { draft, canEdit, meta, escapeHatch: null }
    },

    buildSteps(draft) {
      return draft.modules.map((m) => {
        const Icon = KIND_ICONS[m.kind] ?? GraduationCap
        return {
          uiKey: `mod:${m._localKey}`,
          kind: 'item' as const,
          title: m.title || '(uten tittel)',
          subtitle: `${KIND_LABELS[m.kind] ?? m.kind} · ${m.duration_minutes ?? 0} min`,
          icon: Icon,
          accent: 'teal' as const,
          locked: false,
          completed: !!m.title && !!m.title.trim(),
        }
      })
    },

    renderStepDetail(step, draft, patch) {
      const local = step.uiKey.replace(/^mod:/, '')
      const idx = draft.modules.findIndex((m) => m._localKey === local)
      if (idx === -1) return null
      const m = draft.modules[idx]
      const setM = (next: Partial<ModuleRow>) => {
        const updated = draft.modules.slice()
        updated[idx] = { ...m, ...next }
        patch({ ...draft, modules: updated })
      }
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Modul-tittel</label>
            <StandardInput value={m.title} onChange={(e) => setM({ title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL}>Type</label>
              <SearchableSelect
                value={m.kind}
                options={(Object.keys(KIND_LABELS) as ModuleKind[]).map((k) => ({
                  value: k,
                  label: KIND_LABELS[k],
                }))}
                onChange={(v) => setM({ kind: v as ModuleKind })}
              />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Varighet (min)</label>
              <StandardInput
                type="number"
                min={0}
                value={m.duration_minutes ?? 0}
                onChange={(e) => setM({ duration_minutes: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            <p className="font-medium">Innhold redigeres i fullversjonen</p>
            <p className="mt-1 text-xs">
              Tekst, quiz, video, scenario osv. for denne modulen redigeres i den fulle
              kurs-byggeren der hver type har sin egen redigerer.
            </p>
            <Button
              variant="ghost"
              className="mt-2 inline-flex items-center gap-1 rounded-none border border-amber-300 bg-white p-1 px-2 text-xs hover:bg-amber-100"
              onClick={() =>
                typeof window !== 'undefined' &&
                window.open(
                  `/learning/courses/${encodeURIComponent(draft.courseId)}#mod-${encodeURIComponent(m.id)}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Åpne i kurs-bygger
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )
    },

    addStepOptions() {
      return [
        { id: 'text', label: 'Tekst-modul' },
        { id: 'quiz', label: 'Quiz' },
        { id: 'checklist', label: 'Sjekkliste' },
        { id: 'video', label: 'Video' },
        { id: 'scenario', label: 'Scenario' },
      ]
    },

    applyAddStep(draft, optionId) {
      const kind = optionId as ModuleKind
      const newMod: ModuleWithKey = {
        _localKey: nextLocalKey(),
        id: `auto-${Date.now()}`,
        title: '',
        kind,
        sort_order:
          (draft.modules.length > 0
            ? Math.max(...draft.modules.map((m) => m.sort_order ?? 0))
            : 0) + 10,
        duration_minutes: 5,
        content: { kind },
      }
      return { ...draft, modules: [...draft.modules, newMod] }
    },

    applyRemoveStep(draft, step) {
      const local = step.uiKey.replace(/^mod:/, '')
      return { ...draft, modules: draft.modules.filter((m) => m._localKey !== local) }
    },

    validate(draft) {
      if (draft.modules.length === 0) return 'Kurset må ha minst én modul.'
      const blank = draft.modules.findIndex((m) => !m.title.trim())
      if (blank >= 0) return `Modul ${blank + 1} mangler tittel.`
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const payload = {
        modules: draft.modules.map((m) => ({
          id: m.id,
          title: m.title,
          kind: m.kind,
          sort_order: m.sort_order,
          duration_minutes: m.duration_minutes,
          content: m.content,
        })),
      }
      const { error } = await supabase
        .from('learning_courses')
        .update({
          studio_draft_payload: payload as unknown as Record<string, unknown>,
          studio_draft_at: new Date().toISOString(),
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },

    async publish(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }

      // Apply the draft to learning_modules table. Strategy: upsert each
      // row by id (preserving content for existing modules), and delete
      // rows no longer present in the draft.
      const draftIds = new Set(draft.modules.map((m) => m.id))
      const { data: existing } = await supabase
        .from('learning_modules')
        .select('id')
        .eq('course_id', rowId)
      const existingIds = ((existing ?? []) as { id: string }[]).map((r) => r.id)
      const toDelete = existingIds.filter((id) => !draftIds.has(id))

      if (toDelete.length > 0) {
        const { error } = await supabase.from('learning_modules').delete().in('id', toDelete)
        if (error) return { ok: false, error: error.message }
      }

      for (const m of draft.modules) {
        const { error } = await supabase
          .from('learning_modules')
          .upsert(
            {
              id: m.id,
              course_id: rowId,
              title: m.title,
              kind: m.kind,
              sort_order: m.sort_order,
              duration_minutes: m.duration_minutes,
              content: m.content as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          )
        if (error) return { ok: false, error: error.message }
      }

      const { error } = await supabase
        .from('learning_courses')
        .update({
          studio_draft_payload: null,
          studio_draft_at: null,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }

      return { ok: true }
    },
  }
}
