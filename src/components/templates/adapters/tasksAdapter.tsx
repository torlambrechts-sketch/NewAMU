// Tasks adapter — metadata-only. task_org_templates is a join row
// (catalog_id + per-org flags); the catalog row owns name / description.
// The shell renders the per-org settings (nav_pinned, is_active,
// category) plus a deep-link to the catalog editor in tasks-admin.

import { ExternalLink, Kanban } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../ui/Button'
import { ToggleSwitch } from '../../ui/FormToggles'
import type {
  AdapterMeta,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

export type TasksDraft = {
  id: string
  catalogId: string
  catalogName: string
  navPinned: boolean
  isActive: boolean
}

export type TasksAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

export function createTasksAdapter(
  deps: TasksAdapterDeps,
): TemplateEditorAdapter<TasksDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'tasks',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('task_org_templates')
        .select('id, catalog_id, nav_pinned, is_active, task_template_catalog!inner(name, law_refs)')
        .eq('id', rowId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error || !data) return null
      const row = data as unknown as {
        id: string
        catalog_id: string
        nav_pinned: boolean
        is_active: boolean
        task_template_catalog: { name: string; law_refs: string[] | null }
      }
      const meta: AdapterMeta = {
        title: row.task_template_catalog.name,
        subtitle: 'Oppgave-mal — per-org-innstillinger her, innhold i katalogen.',
        lawRefs: row.task_template_catalog.law_refs ?? [],
        versionLabel: row.is_active ? 'Aktiv' : 'Inaktiv',
        accent: 'amber',
        icon: Kanban,
        metadataOnly: true,
      }
      return {
        draft: {
          id: row.id,
          catalogId: row.catalog_id,
          catalogName: row.task_template_catalog.name,
          navPinned: row.nav_pinned,
          isActive: row.is_active,
        },
        canEdit,
        meta,
      }
    },

    buildSteps: () => [],
    renderStepDetail: () => null,
    addStepOptions: () => [],
    applyAddStep: (draft) => draft,
    applyRemoveStep: (draft) => draft,

    renderMetadataOnly(draft, patch) {
      return (
        <>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <p className={LABEL}>Katalog-mal</p>
            <p className="mt-1 font-medium text-neutral-900">{draft.catalogName}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Navn og innhold defineres i katalogen og deles på tvers av organisasjoner.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2">
            <span className="text-sm text-neutral-700">Aktiv</span>
            <ToggleSwitch
              checked={draft.isActive}
              onChange={(v) => patch({ ...draft, isActive: v })}
              label="Aktiv"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2">
            <span className="text-sm text-neutral-700">Festet i sidemenyen</span>
            <ToggleSwitch
              checked={draft.navPinned}
              onChange={(v) => patch({ ...draft, navPinned: v })}
              label="Pinnet"
            />
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            <p className="font-medium">Innhold</p>
            <p className="mt-1 text-xs">
              Felter, lov-referanser og standardverdier på malen redigeres i oppgave-admin.
            </p>
            <Button
              variant="ghost"
              className="mt-2 inline-flex items-center gap-1 rounded-none border border-amber-300 bg-white p-1 px-2 text-xs hover:bg-amber-100"
              onClick={() =>
                typeof window !== 'undefined' &&
                window.open(
                  `/tasks/management/admin?template=${encodeURIComponent(draft.catalogId)}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Åpne oppgave-admin <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </>
      )
    },

    validate() {
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const { error } = await supabase
        .from('task_org_templates')
        .update({
          is_active: draft.isActive,
          nav_pinned: draft.navPinned,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },

    async publish(rowId, draft) {
      return this.saveDraft(rowId, draft)
    },
  }
}
