// /admin/templates — cross-module template browser.
//
// Renders every template in the org so admins can browse, filter, view
// details and edit. Visual reference is the Pinpoint Background Checks
// layout block at /platform-admin/layout-reference → "Background checks
// (Certn)": status tabs across the top, a white card wrapping the
// toolbar + table + pagination footer, neutral-50 row hover, pill
// badges.
//
// Three interactions open the right-side drawer instead of navigating
// away:
//   - Ny mal button       → drawer mode 'new' (type picker)
//   - Row name click      → drawer mode 'view' (compliance: inline
//                            editor; other sources: details + CTA)
//   - Rediger row button  → same as row name click
//
// Compliance has a slide-over template editor already
// (TemplateEditorPanel). We reuse it inline via ComplianceTemplate-
// EditorBridge so admins skip the /admin/settings/compliance/maler
// hop entirely. Survey, documents, learning and registers still use
// dedicated editor pages today — we deep-link there from the view
// drawer; each module's editor needs its own slide-over refactor
// before it can be embedded here.

import { useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileText,
  GraduationCap,
  History as HistoryIcon,
  Lock,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useChecklistModule } from '../../../modules/compliance/useChecklistModule'
import { parseChecklistDefinition } from '../../../modules/compliance/schema'
import {
  ADMIN_TEMPLATE_SOURCE_LABELS,
  ADMIN_TEMPLATE_STATUS_LABELS,
  useAdminTemplates,
  type AdminTemplateRow,
  type AdminTemplateSource,
  type AdminTemplateStatus,
} from '../../hooks/useAdminTemplates'
import { useAdminTemplateUsage } from '../../hooks/useAdminTemplateUsage'
import { ComplianceTemplateEditorBridge } from './ComplianceTemplateEditorBridge'
import { SurveyTemplateEditorBridge } from './SurveyTemplateEditorBridge'
import { TemplateHistoryModal } from './TemplateHistoryModal'
import { TemplatePreviewModal } from './TemplatePreviewModal'
import { LightweightTemplateEditor } from './LightweightTemplateEditor'
import { ConfirmDialog } from './ConfirmDialog'
import { AiTemplateGenModal } from './AiTemplateGenModal'

const SOURCE_KEYS: AdminTemplateSource[] = [
  'compliance',
  'survey',
  'documents',
  'learning',
  'registers',
]
const STATUS_KEYS: AdminTemplateStatus[] = [
  'active',
  'inactive',
  'draft',
  'archived',
  'system',
]

const STATUS_PILL: Record<AdminTemplateStatus, string> = {
  active: 'bg-emerald-100 text-emerald-950',
  inactive: 'bg-neutral-200 text-neutral-700',
  draft: 'bg-amber-100 text-amber-950',
  archived: 'bg-neutral-100 text-neutral-400 line-through',
  system: 'bg-sky-100 text-sky-950',
}

const SOURCE_NEW_PATH: Record<AdminTemplateSource, string> = {
  compliance: '/admin/settings/compliance/maler',
  survey: '/admin/settings/survey/maler',
  documents: '/admin/settings/documents/maler',
  learning: '/learning/courses',
  registers: '/admin/settings/registers',
}

const SOURCE_DESCRIPTION: Record<AdminTemplateSource, string> = {
  compliance: 'Sjekkliste-maler — gjenbrukbare punktlister, pack-bundlede krav, skjema-felter.',
  survey: 'Undersøkelses-maler — QPSNordic/ARK, AMU, tiltak, pulse-spørringer.',
  documents: 'Dokument- og wiki-maler — prosedyrer, rutiner, retningslinjer.',
  learning: 'Kurs-maler — opplæringsmoduler, kvitteringer, kompetansebevis.',
  registers: 'Register-maler — utstyrs-, kjemikalie-, leverandørlister.',
}

const SOURCE_ICON: Record<AdminTemplateSource, typeof ClipboardList> = {
  compliance: ClipboardList,
  survey: Megaphone,
  documents: FileText,
  learning: GraduationCap,
  registers: Database,
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

/** Look up the catalog_id that an override row points to. Survey
 *  duplicate needs to fork the catalog, not the override. */
async function getOverrideCatalogId(
  sb: NonNullable<ReturnType<typeof useOrgSetupContext>['supabase']>,
  overrideId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from('survey_org_templates')
    .select('catalog_id')
    .eq('id', overrideId)
    .maybeSingle()
  if (error || !data) return null
  return (data as { catalog_id: string }).catalog_id
}

type DrawerState =
  | { kind: 'closed' }
  | { kind: 'new' }
  | { kind: 'view'; row: AdminTemplateRow }
  | { kind: 'compliance-edit'; templateId: string | null }
  | { kind: 'survey-edit'; templateId: string | null }
  | { kind: 'lightweight-edit'; row: AdminTemplateRow }

/** Sources that have an inline slide-over editor wired today. */
const INLINE_EDITABLE_SOURCES: ReadonlySet<AdminTemplateSource> = new Set(['compliance', 'survey'])

export function AdminTemplatesPage() {
  const { rows, loading, error, refresh } = useAdminTemplates()
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const cl = useChecklistModule({ supabase })
  const usageByTemplateId = useAdminTemplateUsage()
  const [searchParams] = useSearchParams()
  const initialSource = searchParams.get('source') as AdminTemplateSource | null
  const [activeSource, setActiveSource] = useState<AdminTemplateSource | null>(
    () => (initialSource && SOURCE_KEYS.includes(initialSource) ? initialSource : null),
  )
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState<AdminTemplateStatus | null>(null)
  const [pageSize, setPageSize] = useState<PageSize>(25)
  const [page, setPage] = useState(0)
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'closed' })
  const [busyRowId, setBusyRowId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [historyFor, setHistoryFor] = useState<AdminTemplateRow | null>(null)
  const [previewFor, setPreviewFor] = useState<AdminTemplateRow | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [confirmRow, setConfirmRow] = useState<AdminTemplateRow | null>(null)
  const [confirmBulk, setConfirmBulk] = useState<boolean>(false)

  // Per-row JSON export. Source-aware payload — each shape captures
  // the canonical template state for that source so the file is
  // round-trippable via importTemplate. Schema v2 supports all 5
  // sources; v1 was compliance-only and is no longer written.
  const exportRow = useCallback(
    async (row: AdminTemplateRow) => {
      if (!supabase) return
      try {
        const payload: { schemaVersion: 2; exportedAt: string; source: AdminTemplateSource; template: Record<string, unknown> } = {
          schemaVersion: 2,
          exportedAt: new Date().toISOString(),
          source: row.source,
          template: {},
        }
        let slug = row.id
        if (row.source === 'compliance') {
          if (!cl.templates.some((t) => t.id === row.id)) await cl.load({})
          const original = cl.templates.find((t) => t.id === row.id)
          if (!original) throw new Error('Fant ikke malen.')
          payload.template = {
            pack: original.pack,
            slug: original.slug,
            name: original.name,
            description: original.description,
            definition: parseChecklistDefinition(original.definition),
          }
          slug = original.slug
        } else if (row.source === 'survey') {
          const { data: ovr, error: e0 } = await supabase
            .from('survey_org_templates')
            .select('catalog_id, name_override, description_override, body_override, pack, nav_pinned, is_active, cadence_hint, review_status')
            .eq('id', row.id)
            .maybeSingle()
          if (e0) throw e0
          if (!ovr) throw new Error('Fant ikke malen.')
          const { data: cat } = await supabase
            .from('survey_template_catalog')
            .select('name, short_name, description, source, use_case, category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack')
            .eq('id', (ovr as { catalog_id: string }).catalog_id)
            .maybeSingle()
          payload.template = { catalog: cat ?? null, override: ovr }
        } else if (row.source === 'documents') {
          const { data, error: err } = await supabase
            .from('document_org_templates')
            .select('label, description, category, legal_basis, page_payload, metadata_schema, nav_pinned')
            .eq('id', row.id)
            .maybeSingle()
          if (err) throw err
          if (!data) throw new Error('Fant ikke malen.')
          payload.template = data as Record<string, unknown>
        } else if (row.source === 'learning') {
          const { data, error: err } = await supabase
            .from('learning_courses')
            .select('title, description, status, category_id, content')
            .eq('id', row.id)
            .maybeSingle()
          if (err) throw err
          if (!data) throw new Error('Fant ikke kurset.')
          payload.template = data as Record<string, unknown>
        } else if (row.source === 'registers') {
          const { data, error: err } = await supabase
            .from('register_types')
            .select('name, description, metadata_schema, regulation_ids, pack_slugs, default_review_cadence_months, position')
            .eq('id', row.id)
            .maybeSingle()
          if (err) throw err
          if (!data) throw new Error('Fant ikke registertypen.')
          payload.template = data as Record<string, unknown>
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `mal-${row.source}-${slug}.json`
        a.click()
        URL.revokeObjectURL(a.href)
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke eksportere malen.')
      }
    },
    [supabase, cl],
  )

  // Import a template from a JSON file written by exportRow. Validates
  // schemaVersion + source and routes to the appropriate create logic.
  const importTemplate = useCallback(
    async (file: File) => {
      if (!supabase) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as {
          schemaVersion?: number
          source?: AdminTemplateSource
          template?: Record<string, unknown>
        }
        if (parsed.schemaVersion !== 2 || !parsed.source || !parsed.template) {
          throw new Error('Ikke en gyldig mal-eksport (mangler schemaVersion 2 / source / template).')
        }
        const t = parsed.template
        if (parsed.source === 'compliance') {
          const pack = t.pack as Parameters<typeof cl.createTemplate>[0]['pack']
          const slug = String(t.slug ?? 'imported')
          const name = String(t.name ?? '(ny mal)')
          const newId = await cl.createTemplate({
            pack,
            slug: `${slug}-import-${Date.now().toString(36)}`,
            name,
            description: (t.description as string | null) ?? undefined,
            definition: parseChecklistDefinition(t.definition),
          })
          if (newId) {
            await refresh()
            setDrawer({ kind: 'compliance-edit', templateId: newId })
          }
        } else if (parsed.source === 'survey') {
          const cat = (t.catalog as Record<string, unknown>) ?? null
          const ovr = (t.override as Record<string, unknown>) ?? {}
          if (!cat) throw new Error('Survey-import mangler katalog­data.')
          const newCatalogId = `${String(cat.id ?? 'imported')}-import-${Date.now().toString(36)}`
          const newCatalog: Record<string, unknown> = {
            ...cat,
            id: newCatalogId,
            organization_id: orgId,
            is_system: false,
            name: `Import: ${String(cat.name ?? 'mal')}`,
          }
          delete newCatalog.created_at
          delete newCatalog.updated_at
          const { error: e1 } = await supabase.from('survey_template_catalog').insert(newCatalog)
          if (e1) throw e1
          const { error: e2 } = await supabase.from('survey_org_templates').insert({
            organization_id: orgId,
            catalog_id: newCatalogId,
            pack: ovr.pack ?? cat.pack ?? cat.category,
            name_override: ovr.name_override ?? null,
            description_override: ovr.description_override ?? null,
            body_override: ovr.body_override ?? null,
            nav_pinned: ovr.nav_pinned ?? false,
            is_active: false,
            cadence_hint: ovr.cadence_hint ?? null,
            review_status: 'draft',
          })
          if (e2) throw e2
          await refresh()
        } else if (parsed.source === 'documents') {
          const newId = `imported-${Date.now().toString(36)}`
          const { error: err } = await supabase.from('document_org_templates').insert({
            id: newId,
            organization_id: orgId,
            label: `Import: ${String(t.label ?? 'mal')}`,
            description: (t.description as string) ?? '',
            category: t.category ?? 'guide',
            legal_basis: (t.legal_basis as string[] | null) ?? [],
            page_payload: t.page_payload ?? {},
            metadata_schema: t.metadata_schema ?? { fields: [] },
            nav_pinned: false,
          })
          if (err) throw err
          await refresh()
        } else if (parsed.source === 'learning') {
          const { error: err } = await supabase.from('learning_courses').insert({
            organization_id: orgId,
            title: `Import: ${String(t.title ?? 'kurs')}`,
            description: (t.description as string | null) ?? null,
            status: 'draft',
            category_id: (t.category_id as string | null) ?? null,
            content: t.content ?? null,
          })
          if (err) throw err
          await refresh()
        } else if (parsed.source === 'registers') {
          const newId = `imported-${Date.now().toString(36)}`
          const { error: err } = await supabase.from('register_types').insert({
            id: newId,
            organization_id: orgId,
            name: `Import: ${String(t.name ?? 'registertype')}`,
            description: (t.description as string | null) ?? null,
            metadata_schema: t.metadata_schema ?? { fields: [] },
            regulation_ids: (t.regulation_ids as string[] | null) ?? [],
            pack_slugs: (t.pack_slugs as string[] | null) ?? [],
            default_review_cadence_months: t.default_review_cadence_months ?? null,
            position: t.position ?? 0,
            is_active: false,
            is_system: false,
          })
          if (err) throw err
          await refresh()
        }
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke importere malen.')
      }
    },
    [supabase, cl, refresh, orgId],
  )

  const duplicateCompliance = useCallback(
    async (row: AdminTemplateRow) => {
      setBusyRowId(row.rowId)
      setActionError(null)
      try {
        // Ensure cl.templates contains the source row before copying.
        if (!cl.templates.some((t) => t.id === row.id)) {
          await cl.load({})
        }
        const original = cl.templates.find((t) => t.id === row.id)
        if (!original) {
          throw new Error('Fant ikke originalmalen.')
        }
        const definition = parseChecklistDefinition(original.definition)
        const newId = await cl.createTemplate({
          pack: original.pack,
          slug: `${original.slug}-kopi-${Date.now().toString(36)}`,
          name: `Kopi av ${original.name}`,
          description: original.description ?? undefined,
          definition,
        })
        if (newId) {
          await refresh()
          // Open the new template in the editor right away.
          setDrawer({ kind: 'compliance-edit', templateId: newId })
        }
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke duplisere malen.')
      } finally {
        setBusyRowId(null)
      }
    },
    [cl, refresh],
  )

  // Duplicate for non-compliance sources. Each source has its own
  // shape so the copy logic branches; all branches preserve the
  // template's pack / content blob and stamp a new id + «Kopi av »
  // prefix so the new row is visually distinct in the list.
  const duplicateRow = useCallback(
    async (row: AdminTemplateRow) => {
      if (row.source === 'compliance') return duplicateCompliance(row)
      if (!supabase) return
      if (row.isSystem) {
        setActionError('Systemmaler kan ikke dupliseres direkte. Plattform-admin må håndtere endringer.')
        return
      }
      setBusyRowId(row.rowId)
      setActionError(null)
      try {
        if (row.source === 'survey') {
          // Survey overrides reference a catalog row. To "duplicate"
          // we fork the catalog + create a new override pointing at
          // the new catalog id. This sidesteps the (org_id,catalog_id)
          // unique constraint and gives the user a fully independent
          // template they can edit.
          const { data: catalogRow, error: e0 } = await supabase
            .from('survey_template_catalog')
            .select('*')
            .eq('id', (await getOverrideCatalogId(supabase, row.id)) ?? '')
            .maybeSingle()
          if (e0) throw e0
          if (!catalogRow) throw new Error('Fant ikke kilde­katalogen.')
          const newCatalogId = `${(catalogRow as { id: string }).id}-kopi-${Date.now().toString(36)}`
          const newCatalog = {
            ...(catalogRow as Record<string, unknown>),
            id: newCatalogId,
            organization_id: orgId,
            is_system: false,
            name: `Kopi av ${(catalogRow as { name: string }).name}`,
            created_at: undefined,
            updated_at: undefined,
          }
          delete (newCatalog as Record<string, unknown>).created_at
          delete (newCatalog as Record<string, unknown>).updated_at
          const { error: e1 } = await supabase.from('survey_template_catalog').insert(newCatalog)
          if (e1) throw e1
          const { error: e2 } = await supabase.from('survey_org_templates').insert({
            organization_id: orgId,
            catalog_id: newCatalogId,
            pack: (catalogRow as { pack?: string }).pack ?? (catalogRow as { category?: string }).category,
            is_active: false,
            nav_pinned: false,
            review_status: 'draft',
          })
          if (e2) throw e2
        } else if (row.source === 'documents') {
          const { data: orig, error: e0 } = await supabase
            .from('document_org_templates')
            .select('*')
            .eq('id', row.id)
            .maybeSingle()
          if (e0) throw e0
          if (!orig) throw new Error('Fant ikke malen.')
          const copy: Record<string, unknown> = { ...(orig as Record<string, unknown>) }
          copy.id = `${(orig as { id: string }).id}-kopi-${Date.now().toString(36)}`
          copy.label = `Kopi av ${(orig as { label: string }).label}`
          delete copy.created_at
          delete copy.updated_at
          delete copy.deleted_at
          const { error: e1 } = await supabase.from('document_org_templates').insert(copy)
          if (e1) throw e1
        } else if (row.source === 'learning') {
          const { data: orig, error: e0 } = await supabase
            .from('learning_courses')
            .select('*')
            .eq('id', row.id)
            .maybeSingle()
          if (e0) throw e0
          if (!orig) throw new Error('Fant ikke kurset.')
          const copy: Record<string, unknown> = { ...(orig as Record<string, unknown>) }
          delete copy.id
          delete copy.created_at
          delete copy.updated_at
          copy.title = `Kopi av ${(orig as { title: string }).title}`
          copy.status = 'draft'
          const { error: e1 } = await supabase.from('learning_courses').insert(copy)
          if (e1) throw e1
        } else if (row.source === 'registers') {
          const { data: orig, error: e0 } = await supabase
            .from('register_types')
            .select('*')
            .eq('id', row.id)
            .maybeSingle()
          if (e0) throw e0
          if (!orig) throw new Error('Fant ikke registertypen.')
          const copy: Record<string, unknown> = { ...(orig as Record<string, unknown>) }
          copy.id = `${(orig as { id: string }).id}-kopi-${Date.now().toString(36)}`
          copy.organization_id = orgId
          copy.is_system = false
          copy.name = `Kopi av ${(orig as { name: string }).name}`
          copy.is_active = false
          delete copy.created_at
          delete copy.updated_at
          delete copy.deleted_at
          const { error: e1 } = await supabase.from('register_types').insert(copy)
          if (e1) throw e1
        }
        await refresh()
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke duplisere malen.')
      } finally {
        setBusyRowId(null)
      }
    },
    [duplicateCompliance, supabase, refresh, orgId],
  )

  const deleteCompliance = useCallback(
    async (row: AdminTemplateRow) => {
      if (row.isSystem) return
      setBusyRowId(row.rowId)
      setActionError(null)
      try {
        await cl.softDeleteTemplate(row.id)
        await refresh()
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke slette malen.')
      } finally {
        setBusyRowId(null)
      }
    },
    [cl, refresh],
  )

  // Soft-delete for non-compliance sources. Each module has its own
  // hide / archive idiom — kept narrow on purpose so we don't surprise
  // admins with destructive behaviour the underlying RPCs don't yet
  // formally support.
  const deleteRow = useCallback(
    async (row: AdminTemplateRow) => {
      if (row.isSystem) return
      if (row.source === 'compliance') return await deleteCompliance(row)
      if (!supabase) return
      setBusyRowId(row.rowId)
      setActionError(null)
      try {
        if (row.source === 'survey') {
          const { error: err } = await supabase
            .from('survey_org_templates')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', row.id)
          if (err) throw err
        } else if (row.source === 'learning') {
          const { error: err } = await supabase
            .from('learning_courses')
            .update({ status: 'archived' })
            .eq('id', row.id)
          if (err) throw err
        } else if (row.source === 'documents') {
          const { error: err } = await supabase
            .from('document_org_templates')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', row.id)
          if (err) throw err
        } else if (row.source === 'registers') {
          const { error: err } = await supabase
            .from('register_types')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', row.id)
          if (err) throw err
        } else {
          throw new Error('Ukjent kilde — sletting støttes ikke.')
        }
        await refresh()
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke slette malen.')
      } finally {
        setBusyRowId(null)
      }
    },
    [supabase, refresh, deleteCompliance],
  )

  // Bulk activate/deactivate. Compliance rows go through cl.update-
  // Template (proper hook); other sources fall back to direct
  // supabase update mirroring toggleActive. Survey is skipped — it
  // has its own override model (deleted_at / is_active) but mixing
  // with the others gets complex; keeps the bulk action predictable.
  const bulkSetActive = useCallback(
    async (next: boolean) => {
      const selectedRows = rows.filter((r) => selectedIds.has(r.rowId) && !r.isSystem)
      if (selectedRows.length === 0) return
      setBulkBusy(true)
      setActionError(null)
      try {
        for (const r of selectedRows) {
          if (r.source === 'compliance') {
            await cl.updateTemplate({ templateId: r.id, is_active: next })
          } else if (r.source === 'documents' && supabase) {
            await supabase.from('document_org_templates').update({ is_active: next }).eq('id', r.id)
          } else if (r.source === 'learning' && supabase) {
            await supabase
              .from('learning_courses')
              .update({ status: next ? 'published' : 'draft' })
              .eq('id', r.id)
          } else if (r.source === 'registers' && supabase) {
            await supabase.from('register_types').update({ is_active: next }).eq('id', r.id)
          } else if (r.source === 'survey' && supabase) {
            await supabase.from('survey_org_templates').update({ is_active: next }).eq('id', r.id)
          }
        }
        setSelectedIds(new Set())
        await refresh()
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke oppdatere markerte maler.')
      } finally {
        setBulkBusy(false)
      }
    },
    [rows, selectedIds, cl, supabase, refresh],
  )

  const bulkDelete = useCallback(async () => {
    const selectedRows = rows.filter((r) => selectedIds.has(r.rowId) && !r.isSystem)
    if (selectedRows.length === 0) return
    setBulkBusy(true)
    setActionError(null)
    try {
      for (const r of selectedRows) {
        await deleteRow(r)
      }
      setSelectedIds(new Set())
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Kunne ikke slette alle markerte maler.')
    } finally {
      setBulkBusy(false)
    }
  }, [rows, selectedIds, deleteRow])

  // Inline active-toggle for documents / learning / registers. The
  // sources don't have slide-over editors yet, so admins get this
  // small bit of inline control plus a deep-link for the rest.
  const toggleActive = useCallback(
    async (row: AdminTemplateRow, next: boolean) => {
      if (!supabase) return
      if (row.isSystem) return
      setBusyRowId(row.rowId)
      setActionError(null)
      try {
        if (row.source === 'documents') {
          const { error: err } = await supabase
            .from('document_org_templates')
            .update({ is_active: next })
            .eq('id', row.id)
          if (err) throw err
        } else if (row.source === 'learning') {
          const { error: err } = await supabase
            .from('learning_courses')
            .update({ status: next ? 'published' : 'draft' })
            .eq('id', row.id)
          if (err) throw err
        } else if (row.source === 'registers') {
          const { error: err } = await supabase
            .from('register_types')
            .update({ is_active: next })
            .eq('id', row.id)
          if (err) throw err
        }
        await refresh()
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Kunne ikke endre status.')
      } finally {
        setBusyRowId(null)
      }
    },
    [supabase, refresh],
  )

  const totals = useMemo(() => {
    const bySource = new Map<AdminTemplateSource, number>()
    const byStatus = new Map<AdminTemplateStatus, number>()
    for (const r of rows) {
      bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1)
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
    }
    return { bySource, byStatus }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (activeSource && r.source !== activeSource) return false
      if (activeStatus && r.status !== activeStatus) return false
      if (q) {
        const hay = [r.name, r.category ?? '', r.sourceLabel, r.hint ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, activeSource, activeStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize)
  const firstIndex = filtered.length === 0 ? 0 : safePage * pageSize + 1
  const lastIndex = Math.min(filtered.length, (safePage + 1) * pageSize)

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Admin' },
        { label: 'Maler' },
      ]}
      title="Maler"
      description="Alle maler i organisasjonen — sjekklister, undersøkelser, dokumenter, kurs, registertyper. Klikk en rad for å åpne et detaljpanel."
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Laster …' : 'Oppdater'}
          </Button>
          <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50">
            <Upload className="h-4 w-4" />
            Importer
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importTemplate(f)
                e.target.value = ''
              }}
            />
          </label>
          <Link
            to="/organisation"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Til selskap
          </Link>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-purple-300 bg-white px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            title="AI-assistert mal-generering (eksperimentell)"
          >
            <Sparkles className="h-4 w-4" />
            AI
          </button>
          <button
            type="button"
            onClick={() => setDrawer({ kind: 'new' })}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#16382e]"
          >
            <Plus className="h-4 w-4" />
            Ny mal
          </button>
        </div>
      }
    >
      {error ? <WarningBox>{error}</WarningBox> : null}
      {actionError ? <WarningBox>{actionError}</WarningBox> : null}

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#1a3d32]/30 bg-[#1a3d32]/5 px-4 py-2 text-sm">
          <span className="font-medium text-[#1a3d32]">
            {selectedIds.size} {selectedIds.size === 1 ? 'mal' : 'maler'} valgt
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void bulkSetActive(true)}
              disabled={bulkBusy}
              className="rounded-md border border-[#1a3d32] bg-white px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-[#1a3d32]/5 disabled:opacity-50"
            >
              Aktiver
            </button>
            <button
              type="button"
              onClick={() => void bulkSetActive(false)}
              disabled={bulkBusy}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              Deaktiver
            </button>
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              disabled={bulkBusy}
              className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Slett
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkBusy}
              className="rounded-md px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-800"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-x-1 gap-y-2 border-b border-neutral-200 pb-0">
        <SourceTab
          label="Alle"
          count={rows.length}
          active={activeSource === null}
          onClick={() => {
            setActiveSource(null)
            setPage(0)
          }}
        />
        {SOURCE_KEYS.map((s) => (
          <SourceTab
            key={s}
            label={ADMIN_TEMPLATE_SOURCE_LABELS[s]}
            count={totals.bySource.get(s) ?? 0}
            icon={SOURCE_ICON[s]}
            active={activeSource === s}
            onClick={() => {
              setActiveSource(s)
              setPage(0)
            }}
          />
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Søk etter navn, kategori, modul eller hint …"
              aria-label="Søk maler"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-9 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPage(0)
                }}
                aria-label="Tøm søk"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <StatusFilter
            active={activeStatus}
            counts={totals.byStatus}
            onChange={(s) => {
              setActiveStatus(s)
              setPage(0)
            }}
          />
          <span className="text-xs text-neutral-500">
            {activeStatus
              ? `Status: ${ADMIN_TEMPLATE_STATUS_LABELS[activeStatus]}`
              : 'Ingen filter aktivert'}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="divide-y divide-neutral-100" aria-busy="true" aria-label="Laster maler">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="size-3.5 rounded bg-neutral-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 rounded bg-neutral-100" />
                  <div className="h-2 w-1/4 rounded bg-neutral-100" />
                </div>
                <div className="h-5 w-20 rounded-full bg-neutral-100" />
                <div className="h-5 w-16 rounded-full bg-neutral-100" />
                <div className="h-3 w-16 rounded bg-neutral-100" />
                <div className="size-4 rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            {filtered.length === 0 && rows.length > 0
              ? 'Ingen maler matcher filtrene.'
              : 'Ingen maler funnet i organisasjonen.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <th className="w-10 px-4 py-3 sm:px-5">
                    <input
                      type="checkbox"
                      aria-label="Velg alle synlige rader"
                      checked={visible.length > 0 && visible.every((r) => selectedIds.has(r.rowId))}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) {
                            for (const r of visible) next.add(r.rowId)
                          } else {
                            for (const r of visible) next.delete(r.rowId)
                          }
                          return next
                        })
                      }}
                      className="size-3.5 cursor-pointer accent-[#1a3d32]"
                    />
                  </th>
                  <th className="px-4 py-3 sm:px-5">Navn</th>
                  <th className="px-4 py-3 sm:px-5">Modul</th>
                  <th className="px-4 py-3 sm:px-5">Status</th>
                  <th className="px-4 py-3 sm:px-5" title="Antall instanser opprettet fra denne malen (kjøringer / kampanjer / dokumenter / kurs / oppføringer)">Instanser</th>
                  <th className="px-4 py-3 sm:px-5">Sist oppdatert</th>
                  <th className="w-12 px-4 py-3 sm:px-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visible.map((r) => (
                  <TemplateRow
                    key={r.rowId}
                    row={r}
                    usage={usageByTemplateId.get(r.id) ?? null}
                    selected={selectedIds.has(r.rowId)}
                    onSelectChange={(checked) =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (checked) next.add(r.rowId)
                        else next.delete(r.rowId)
                        return next
                      })
                    }
                    busy={busyRowId === r.rowId}
                    onOpen={() => {
                      if (r.source === 'compliance') {
                        setDrawer({ kind: 'compliance-edit', templateId: r.id })
                      } else {
                        // Survey / documents / learning / registers
                        // → unified lightweight editor for the
                        // template's core fields. Rich content edits
                        // still navigate to the module's full editor
                        // via the CTA inside the panel.
                        setDrawer({ kind: 'lightweight-edit', row: r })
                      }
                    }}
                    onDuplicate={r.isSystem ? undefined : () => void duplicateRow(r)}
                    onShowHistory={() => setHistoryFor(r)}
                    onExport={() => void exportRow(r)}
                    onPreview={() => setPreviewFor(r)}
                    onDelete={r.isSystem ? undefined : () => setConfirmRow(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-600 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">Rader per side</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as PageSize)
                  setPage(0)
                }}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <span className="text-neutral-500">
              Viser {firstIndex} – {lastIndex} av {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Forrige"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-1 text-neutral-500">
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Neste"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <TemplateDrawer
        state={drawer}
        onClose={() => setDrawer({ kind: 'closed' })}
        onPickSource={(source) => {
          if (source === 'compliance') {
            setDrawer({ kind: 'compliance-edit', templateId: null })
          } else if (source === 'survey') {
            // Survey doesn't support create-from-blank — the bridge
            // renders an explainer modal pointing at the catalog.
            setDrawer({ kind: 'survey-edit', templateId: null })
          } else {
            setDrawer({ kind: 'closed' })
          }
        }}
        onToggleActive={toggleActive}
      />

      {drawer.kind === 'compliance-edit' ? (
        <ComplianceTemplateEditorBridge
          templateId={drawer.templateId}
          onClose={() => setDrawer({ kind: 'closed' })}
          onSaved={() => {
            void refresh()
            setDrawer({ kind: 'closed' })
          }}
        />
      ) : null}
      {drawer.kind === 'survey-edit' ? (
        <SurveyTemplateEditorBridge
          templateId={drawer.templateId}
          onClose={() => setDrawer({ kind: 'closed' })}
          onSaved={() => {
            void refresh()
            setDrawer({ kind: 'closed' })
          }}
        />
      ) : null}
      {drawer.kind === 'lightweight-edit' ? (
        <LightweightTemplateEditor
          row={drawer.row}
          onClose={() => setDrawer({ kind: 'closed' })}
          onSaved={() => {
            void refresh()
            setDrawer({ kind: 'closed' })
          }}
        />
      ) : null}
      {historyFor ? (
        <TemplateHistoryModal
          source={historyFor.source}
          templateId={historyFor.id}
          templateName={historyFor.name}
          onClose={() => setHistoryFor(null)}
          onRestored={() => void refresh()}
        />
      ) : null}
      {previewFor ? (
        <TemplatePreviewModal
          source={previewFor.source}
          templateId={previewFor.id}
          templateName={previewFor.name}
          onClose={() => setPreviewFor(null)}
        />
      ) : null}
      {confirmRow ? (
        <ConfirmDialog
          title={`Slett «${confirmRow.name}»?`}
          body={`Malen blir markert som slettet og forsvinner fra listen. Eksisterende ${
            confirmRow.source === 'compliance' ? 'utførelser' : 'instanser'
          } påvirkes ikke.`}
          confirmLabel="Slett"
          onConfirm={() => {
            const r = confirmRow
            setConfirmRow(null)
            void deleteRow(r)
          }}
          onCancel={() => setConfirmRow(null)}
        />
      ) : null}
      {confirmBulk ? (
        <ConfirmDialog
          title={`Slett ${selectedIds.size} ${selectedIds.size === 1 ? 'mal' : 'maler'}?`}
          body={`De markerte malene blir markert som slettet og forsvinner fra listen. Eksisterende instanser (utførelser, kampanjer, oppføringer) påvirkes ikke. Systemmaler hoppes over.`}
          confirmLabel={`Slett ${selectedIds.size}`}
          onConfirm={() => {
            setConfirmBulk(false)
            void bulkDelete()
          }}
          onCancel={() => setConfirmBulk(false)}
        />
      ) : null}
      {aiOpen ? (
        <AiTemplateGenModal
          onClose={() => setAiOpen(false)}
          onAccept={async (gen) => {
            try {
              const newId = await cl.createTemplate({
                pack: 'aml-amu',
                slug: `ai-${Date.now().toString(36)}`,
                name: gen.name,
                description: gen.description,
                definition: { items: gen.items as never[] },
              })
              setAiOpen(false)
              if (newId) {
                await refresh()
                setDrawer({ kind: 'compliance-edit', templateId: newId })
              }
            } catch (e) {
              setActionError(e instanceof Error ? e.message : 'Kunne ikke opprette malen.')
            }
          }}
        />
      ) : null}
    </ModulePageShell>
  )
}

function SourceTab({
  label,
  count,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  count: number
  icon?: typeof ClipboardList
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-1.5 px-3 py-2 text-left transition ${
        active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
      }`}
      style={
        active
          ? { borderBottomWidth: 3, borderBottomColor: '#1a3d32', marginBottom: -1 }
          : { marginBottom: -1, borderBottom: '3px solid transparent' }
      }
    >
      {Icon ? <Icon className="size-4 shrink-0 text-neutral-400" /> : null}
      <span className="whitespace-nowrap text-xs font-semibold sm:text-sm">{label}</span>
      <span className="tabular-nums text-sm font-bold text-neutral-900">{count}</span>
    </button>
  )
}

function StatusFilter({
  active,
  counts,
  onChange,
}: {
  active: AdminTemplateStatus | null
  counts: Map<AdminTemplateStatus, number>
  onChange: (status: AdminTemplateStatus | null) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-700 hover:bg-neutral-50"
      >
        Status filter
        <ChevronDown className="size-3.5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <MenuItem
            label="Alle statuser"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            selected={active === null}
          />
          {STATUS_KEYS.map((s) => (
            <MenuItem
              key={s}
              label={`${ADMIN_TEMPLATE_STATUS_LABELS[s]} (${counts.get(s) ?? 0})`}
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
              selected={active === s}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  selected,
}: {
  label: string
  onClick: () => void
  selected: boolean
}): ReactNode {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
        selected ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {label}
      {selected ? <span className="text-[#1a3d32]">●</span> : null}
    </button>
  )
}

function TemplateRow({
  row,
  usage,
  selected,
  onSelectChange,
  busy,
  onOpen,
  onDuplicate,
  onShowHistory,
  onExport,
  onPreview,
  onDelete,
}: {
  row: AdminTemplateRow
  usage: { count: number; lastUsedAt: string | null } | null
  selected: boolean
  onSelectChange: (checked: boolean) => void
  busy: boolean
  onOpen: () => void
  /** Compliance only today; undefined disables the menu item with a tooltip. */
  onDuplicate?: () => void
  /** Compliance only today — reads compliance_template_versions. */
  onShowHistory?: () => void
  /** Compliance only today — writes a JSON file. */
  onExport?: () => void
  /** Compliance only today — read-only render of items. */
  onPreview?: () => void
  /** Disabled for system templates and for non-compliance sources. */
  onDelete?: () => void
}) {
  return (
    <tr className={`hover:bg-neutral-50/80 ${busy ? 'opacity-60' : ''} ${selected ? 'bg-[#1a3d32]/5' : ''}`}>
      <td className="px-4 py-4 sm:px-5">
        <input
          type="checkbox"
          aria-label={`Velg ${row.name}`}
          checked={selected}
          onChange={(e) => onSelectChange(e.target.checked)}
          disabled={row.isSystem}
          className="size-3.5 cursor-pointer accent-[#1a3d32] disabled:cursor-not-allowed disabled:opacity-40"
        />
      </td>
      <td className="px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onOpen}
          className="text-left font-semibold text-neutral-900 hover:text-[#1a3d32] hover:underline"
        >
          {row.name}
        </button>
        {row.isSystem ? (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wide text-sky-950">
            <Lock className="size-2.5" aria-hidden />
            System
          </span>
        ) : null}
        {row.category ? (
          <p className="text-xs text-neutral-500">{row.category}</p>
        ) : null}
        {row.hint ? (
          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{row.hint}</p>
        ) : null}
      </td>
      <td className="px-4 py-4 sm:px-5">
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
          {row.sourceLabel}
        </span>
      </td>
      <td className="px-4 py-4 sm:px-5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_PILL[row.status]}`}
        >
          {ADMIN_TEMPLATE_STATUS_LABELS[row.status]}
        </span>
      </td>
      <td className="px-4 py-4 text-neutral-600 sm:px-5">
        {row.source === 'compliance' ? (
          usage && usage.count > 0 ? (
            <div className="flex flex-col">
              <span className="font-medium text-neutral-900">{usage.count}</span>
              {usage.lastUsedAt ? (
                <span className="text-[10px] text-neutral-500">
                  Sist: {new Date(usage.lastUsedAt).toLocaleDateString('nb-NO')}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-neutral-400">0</span>
          )
        ) : (
          <span
            className="text-neutral-300"
            title="Instans-telling er foreløpig bare aggregert for sjekkliste-maler. Per-modul aggregater kommer i en senere fase."
          >
            —
          </span>
        )}
      </td>
      <td className="px-4 py-4 text-neutral-600 sm:px-5">
        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('nb-NO') : '—'}
      </td>
      <td className="px-4 py-4 text-right sm:px-5">
        <RowActionsMenu
          row={row}
          busy={busy}
          onEdit={onOpen}
          onPreview={onPreview}
          onDuplicate={onDuplicate}
          onShowHistory={onShowHistory}
          onExport={onExport}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

function RowActionsMenu({
  row,
  busy,
  onEdit,
  onPreview,
  onDuplicate,
  onShowHistory,
  onExport,
  onDelete,
}: {
  row: AdminTemplateRow
  busy: boolean
  onEdit: () => void
  onPreview?: () => void
  onDuplicate?: () => void
  onShowHistory?: () => void
  onExport?: () => void
  onDelete?: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const duplicateHint = onDuplicate
    ? undefined
    : row.isSystem
      ? 'Systemmaler kan ikke dupliseres direkte. Plattform-admin må håndtere endringer.'
      : 'Dupliser er ikke tilgjengelig for denne maltypen.'
  const deleteHint = row.isSystem
    ? 'Systemmaler kan ikke slettes — bruk «Inaktiv» for å skjule.'
    : !onDelete
      ? 'Sletting er ikke konfigurert for denne maltypen.'
      : undefined

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Handlinger for ${row.name}`}
        className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <MenuRow
            icon={Pencil}
            label="Rediger"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
          />
          <MenuRow
            icon={Eye}
            label="Forhåndsvis"
            disabled={!onPreview}
            onClick={() => {
              setOpen(false)
              onPreview?.()
            }}
          />
          <MenuRow
            icon={Copy}
            label="Dupliser"
            disabled={!onDuplicate}
            hint={duplicateHint}
            onClick={() => {
              setOpen(false)
              onDuplicate?.()
            }}
          />
          <MenuRow
            icon={HistoryIcon}
            label="Vis historikk"
            disabled={!onShowHistory}
            onClick={() => {
              setOpen(false)
              onShowHistory?.()
            }}
          />
          <MenuRow
            icon={Download}
            label="Eksporter JSON"
            disabled={!onExport}
            onClick={() => {
              setOpen(false)
              onExport?.()
            }}
          />
          <div className="my-1 border-t border-neutral-100" />
          <MenuRow
            icon={Trash2}
            label="Slett"
            tone="danger"
            disabled={!onDelete}
            hint={deleteHint}
            onClick={() => {
              setOpen(false)
              onDelete?.()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function MenuRow({
  icon: Icon,
  label,
  tone,
  disabled,
  hint,
  onClick,
}: {
  icon: typeof Pencil
  label: string
  tone?: 'danger'
  disabled?: boolean
  hint?: string
  onClick: () => void
}) {
  const base = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors'
  const enabled = tone === 'danger'
    ? 'text-rose-700 hover:bg-rose-50'
    : 'text-neutral-800 hover:bg-neutral-50'
  const disabledCls = 'cursor-not-allowed text-neutral-400'
  return (
    <button
      type="button"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={hint}
      className={`${base} ${disabled ? disabledCls : enabled}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="flex-1">{label}</span>
      {disabled ? <Lock className="size-3 shrink-0 text-neutral-300" aria-hidden /> : null}
    </button>
  )
}

function TemplateDrawer({
  state,
  onClose,
  onPickSource,
  onToggleActive,
}: {
  state: DrawerState
  onClose: () => void
  onPickSource: (source: AdminTemplateSource) => void
  onToggleActive: (row: AdminTemplateRow, next: boolean) => void | Promise<void>
}) {
  // Close on Esc, body-scroll lock while open. Don't render this
  // drawer when an inline editor bridge is active — those bridges
  // render their own slide-over and we'd double-stack overlays.
  const shouldRender = state.kind === 'new' || state.kind === 'view'

  useEffect(() => {
    if (!shouldRender) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [shouldRender, onClose])

  if (!shouldRender) return null

  const title = state.kind === 'new' ? 'Ny mal' : state.row.name

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Lukk panel"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {state.kind === 'new' ? 'Velg maltype' : 'Mal-detaljer'}
            </p>
            <h2 className="truncate text-lg font-semibold text-neutral-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {state.kind === 'new' ? (
            <NewTemplatePicker onPickSource={onPickSource} />
          ) : (
            <TemplateDetails row={state.row} onToggleActive={onToggleActive} />
          )}
        </div>
      </aside>
    </div>
  )
}

function NewTemplatePicker({
  onPickSource,
}: {
  onPickSource: (source: AdminTemplateSource) => void
}) {
  const navigate = useNavigate()
  const onPick = (source: AdminTemplateSource) => {
    if (INLINE_EDITABLE_SOURCES.has(source)) {
      // Inline-supported source — bridge renders its own slide-over.
      onPickSource(source)
    } else {
      // Full-page editor — navigate.
      onPickSource(source)
      navigate(SOURCE_NEW_PATH[source])
    }
  }
  return (
    <div className="space-y-2">
      <p className="mb-3 text-xs text-neutral-600">
        Velg type mal du vil opprette. Maltyper merket med «Inline» åpnes direkte i et
        redigeringspanel; andre åpnes i sin modul.
      </p>
      {SOURCE_KEYS.map((s) => {
        const Icon = SOURCE_ICON[s]
        const inlineSupported = INLINE_EDITABLE_SOURCES.has(s)
        return (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="flex w-full items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-[#1a3d32]/40 hover:bg-neutral-50"
          >
            <div className="rounded-md bg-[#1a3d32]/10 p-2 text-[#1a3d32]">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                {ADMIN_TEMPLATE_SOURCE_LABELS[s]}
                {inlineSupported ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-950">
                    Inline
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">{SOURCE_DESCRIPTION[s]}</p>
            </div>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-neutral-400" />
          </button>
        )
      })}
    </div>
  )
}

function TemplateDetails({
  row,
  onToggleActive,
}: {
  row: AdminTemplateRow
  onToggleActive: (row: AdminTemplateRow, next: boolean) => void | Promise<void>
}) {
  const Icon = SOURCE_ICON[row.source]
  const canToggle =
    !row.isSystem &&
    (row.source === 'documents' || row.source === 'learning' || row.source === 'registers')
  const isActive = row.status === 'active'
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
            <Icon className="size-3.5" />
            {row.sourceLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_PILL[row.status]}`}
          >
            {ADMIN_TEMPLATE_STATUS_LABELS[row.status]}
          </span>
          {row.isSystem ? (
            <span className="inline-block rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
              system
            </span>
          ) : null}
        </div>

        {canToggle ? (
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">Aktiv</p>
              <p className="text-xs text-neutral-600">
                Inaktive maler skjules for vanlige brukere men kan reaktiveres når som helst.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onToggleActive(row, !isActive)}
              role="switch"
              aria-checked={isActive}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                isActive ? 'bg-[#1a3d32]' : 'bg-neutral-300'
              }`}
            >
              <span
                aria-hidden
                className={`inline-block size-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 text-sm">
          {row.category ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Kategori
              </dt>
              <dd className="mt-0.5 text-neutral-900">{row.category}</dd>
            </div>
          ) : null}
          {row.hint ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Hint</dt>
              <dd className="mt-0.5 font-mono text-xs text-neutral-700">{row.hint}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Sist oppdatert
            </dt>
            <dd className="mt-0.5 text-neutral-900">
              {row.updatedAt ? new Date(row.updatedAt).toLocaleString('nb-NO') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Id (intern)
            </dt>
            <dd className="mt-0.5 font-mono text-xs text-neutral-700 break-all">{row.id}</dd>
          </div>
        </dl>

        <div className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          Selve innholdet i malen redigeres i {row.sourceLabel}-modulen. Klikk under for å åpne
          mal-editoren med riktige felter og forhåndsvisning.
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-5">
        <Link
          to={row.editUrl}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#16382e]"
        >
          <ExternalLink className="size-4" />
          Åpne i full editor
        </Link>
      </div>
    </div>
  )
}
