import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus, Loader2, Pencil, Plus } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PageTemplate, SpaceCategory, WikiSpace } from '../../types/documents'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { WarningBox } from '../ui/AlertBox'

const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

const categoryOptions: SelectOption[] = (Object.keys(CATEGORY_LABELS) as SpaceCategory[]).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

type Props = {
  /**
   * Mapper brukeren kan opprette dokument fra (f.eks. kun `template_library`-mapper på malbibliotek-siden).
   * Tom liste → ingen «Bruk mal».
   */
  destinationSpaces?: WikiSpace[]
  /** Opprett ny malmappe (`template_library`). */
  onNewTemplateFolder?: () => void
  /** Inkrementeres fra forelder for å åpne «Ny mal»-skjema (f.eks. hub-knapp når `showIntro`). */
  newTemplateKey?: number
}

/**
 * Malbibliotek grid (brukt i hub med `centerContent="templates"`).
 * Rediger (blyant): organisasjonsmal → TipTap på egen rute; systemmal → ny wiki-side fra mal i valgt malmappe, deretter TipTap.
 */
export function DocumentsTemplateLibraryBody({
  destinationSpaces,
  onNewTemplateFolder,
  newTemplateKey = 0,
}: Props) {
  const docs = useDocuments()
  const navigate = useNavigate()
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('documents.manage')
  const activeSpaces = useMemo(() => docs.spaces.filter((s) => s.status === 'active'), [docs.spaces])
  const dest = destinationSpaces ?? activeSpaces

  const orgCustomIds = useMemo(() => new Set(docs.orgCustomTemplates.map((t) => t.id)), [docs.orgCustomTemplates])

  const [createOpen, setCreateOpen] = useState(false)
  const [createLabel, setCreateLabel] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createCategory, setCreateCategory] = useState<SpaceCategory>('template_library')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateActionErr, setTemplateActionErr] = useState<string | null>(null)

  useEffect(() => {
    if (newTemplateKey <= 0) return
    setCreateErr(null)
    setCreateLabel('')
    setCreateDesc('')
    setCreateCategory('template_library')
    setCreateOpen(true)
  }, [newTemplateKey])

  const openOrgTemplateEditor = useCallback(
    (tpl: PageTemplate) => {
      setTemplateActionErr(null)
      navigate(`/documents/templates/org/${encodeURIComponent(tpl.id)}/edit`)
    },
    [navigate],
  )

  const openSystemTemplateAsDocument = useCallback(
    async (tpl: PageTemplate) => {
      const sid = dest[0]?.id
      if (!sid) {
        setTemplateActionErr('Opprett eller velg en malmappe før du redigerer systemmal som dokument.')
        return
      }
      setTemplateActionErr(null)
      setEditingTemplateId(tpl.id)
      try {
        const page = await docs.createPage(
          sid,
          tpl.page.title,
          tpl.page.template,
          tpl.page.blocks,
          {
            legalRefs: tpl.page.legalRefs,
            requiresAcknowledgement: tpl.page.requiresAcknowledgement,
            summary: tpl.page.summary,
            acknowledgementAudience: tpl.page.acknowledgementAudience,
            revisionIntervalMonths: tpl.page.revisionIntervalMonths,
            templateId: tpl.id,
          },
        )
        navigate(`/documents/page/${page.id}/reference-edit`)
      } catch (err) {
        setTemplateActionErr(err instanceof Error ? err.message : 'Kunne ikke åpne mal for redigering.')
      } finally {
        setEditingTemplateId(null)
      }
    },
    [dest, docs, navigate],
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateErr(null)
    if (!createLabel.trim()) {
      setCreateErr('Tittel er påkrevd.')
      return
    }
    setCreateBusy(true)
    try {
      await docs.saveOrgCustomTemplate({
        label: createLabel.trim(),
        description: createDesc.trim(),
        category: createCategory,
        legalBasis: [],
        page: {
          title: createLabel.trim(),
          summary: createDesc.trim(),
          status: 'draft',
          template: 'standard',
          legalRefs: [],
          requiresAcknowledgement: false,
          blocks: [{ kind: 'text', body: '<p>Rediger innholdet etter behov.</p>' }],
        },
      })
      setCreateOpen(false)
      setCreateLabel('')
      setCreateDesc('')
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Kunne ikke lagre mal.')
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <>
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">Tilgjengelige maler</h2>
            <span className="mt-1 block text-xs text-neutral-500">
              {docs.pageTemplates.length} {docs.backend === 'supabase' ? 'tilgjengelige maler' : 'mal(er) (demo lokalt)'}
            </span>
          </div>
          {canManage ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
              {onNewTemplateFolder ? (
                <Button type="button" variant="secondary" icon={<FolderPlus className="h-4 w-4" />} onClick={onNewTemplateFolder}>
                  Ny malmappe
                </Button>
              ) : null}
              <Button type="button" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Ny mal
              </Button>
            </div>
          ) : null}
        </div>
        {templateActionErr ? (
          <div className="mb-3">
            <WarningBox>{templateActionErr}</WarningBox>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.pageTemplates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              spaces={dest}
              canManage={canManage}
              isOrgCustom={orgCustomIds.has(tpl.id)}
              busyEdit={editingTemplateId === tpl.id}
              onEditOrg={() => openOrgTemplateEditor(tpl)}
              onEditSystem={() => void openSystemTemplateAsDocument(tpl)}
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
                    acknowledgementAudience: tpl.page.acknowledgementAudience,
                    revisionIntervalMonths: tpl.page.revisionIntervalMonths,
                    templateId: tpl.id,
                  },
                )
                navigate(`/documents/page/${page.id}/reference-edit`)
              }}
            />
          ))}
        </div>
      </ModuleSectionCard>

      {createOpen && canManage ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-create-title"
          onClick={() => setCreateOpen(false)}
        >
          <ModuleSectionCard className="w-full max-w-md p-5 shadow-lg" onClick={(ev) => ev.stopPropagation()}>
            <h3 id="tpl-create-title" className="text-sm font-semibold text-neutral-900">
              Ny mal
            </h3>
            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-lib-new-label">
                  Tittel
                </label>
                <StandardInput
                  id="tpl-lib-new-label"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  placeholder="F.eks. Intern revisjon — sjekkliste"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-lib-new-desc">
                  Beskrivelse
                </label>
                <StandardInput
                  id="tpl-lib-new-desc"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Kort beskrivelse"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-lib-new-cat">
                  Kategori
                </label>
                <SearchableSelect
                  value={createCategory}
                  options={categoryOptions}
                  onChange={(v) => setCreateCategory(v as SpaceCategory)}
                />
              </div>
              {createErr ? <WarningBox>{createErr}</WarningBox> : null}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Avbryt
                </Button>
                <Button type="submit" variant="primary" disabled={createBusy}>
                  {createBusy ? 'Lagrer…' : 'Opprett mal'}
                </Button>
              </div>
            </form>
          </ModuleSectionCard>
        </div>
      ) : null}
    </>
  )
}

function TemplateCard({
  tpl,
  spaces,
  canManage,
  isOrgCustom,
  busyEdit,
  onEditOrg,
  onEditSystem,
  onUse,
}: {
  tpl: PageTemplate
  spaces: WikiSpace[]
  canManage: boolean
  isOrgCustom: boolean
  busyEdit: boolean
  onEditOrg: () => void
  onEditSystem: () => void | Promise<void>
  onUse: (spaceId: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(spaces[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  const spaceOptions: SelectOption[] = useMemo(
    () => spaces.map((s) => ({ value: s.id, label: s.title })),
    [spaces],
  )

  return (
    <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-neutral-900">{tpl.label}</div>
          <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{tpl.description}</p>
        </div>
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-neutral-500 hover:text-neutral-800"
            title={isOrgCustom ? 'Rediger mal' : 'Rediger som dokument (fra systemmal)'}
            aria-label={isOrgCustom ? `Rediger mal ${tpl.label}` : `Rediger systemmal ${tpl.label} som dokument`}
            disabled={busyEdit}
            onClick={() => (isOrgCustom ? onEditOrg() : void onEditSystem())}
          >
            {busyEdit ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Pencil className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {tpl.legalBasis.slice(0, 2).map((ref) => (
          <span key={ref} className="rounded bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#1a3d32]">
            {ref}
          </span>
        ))}
        {tpl.legalBasis.length > 2 && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
            +{tpl.legalBasis.length - 2}
          </span>
        )}
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <SearchableSelect value={selected} options={spaceOptions} onChange={(v) => setSelected(v)} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !selected}
              onClick={() => {
                setBusy(true)
                void Promise.resolve(onUse(selected)).finally(() => {
                  setBusy(false)
                  setOpen(false)
                })
              }}
            >
              {busy ? '…' : 'Bruk mal'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => {
            setSelected(spaces[0]?.id ?? '')
            setOpen(true)
          }}
          disabled={spaces.length === 0}
        >
          + Bruk mal
        </Button>
      )}
    </div>
  )
}
