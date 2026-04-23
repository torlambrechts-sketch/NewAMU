import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PageTemplate, WikiSpace } from '../../types/documents'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DOCUMENTS_HUB_SECTION_IDS } from '../../components/documents/documentsHubSectionIds'
import { InspectionReadinessScore } from '../../components/documents/InspectionReadinessScore'
import {
  ModuleDocumentsHubLayout,
  ModuleDocumentsInsightPanel,
  ModuleRecordsTableShell,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../components/module'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Button } from '../../components/ui/Button'
import { InfoBox } from '../../components/ui/AlertBox'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { useDocumentsHubActionsRegister } from '../../../modules/documents/DocumentsHubActionsContext'

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

const categoryOptions: SelectOption[] = (Object.keys(CATEGORY_LABELS) as WikiSpace['category'][]).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

export function DocumentsHome() {
  const docs = useDocuments()
  const navigate = useNavigate()
  const location = useLocation()
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('documents.manage')

  const [showNewSpace, setShowNewSpace] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState<WikiSpace['category']>('hms_handbook')
  const [savingSpace, setSavingSpace] = useState(false)
  const [spaceSearch, setSpaceSearch] = useState('')

  const openNewFolder = useCallback(() => setShowNewSpace(true), [])
  useDocumentsHubActionsRegister(openNewFolder)

  useEffect(() => {
    const raw = location.hash.replace(/^#/, '')
    if (!raw) return
    const allowed = Object.values(DOCUMENTS_HUB_SECTION_IDS) as string[]
    if (!allowed.includes(raw)) return
    queueMicrotask(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash])

  const activeSpaces = docs.spaces.filter((s) => s.status === 'active')

  const filteredSpaces = useMemo(() => {
    const q = spaceSearch.trim().toLowerCase()
    if (!q) return activeSpaces
    return activeSpaces.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        CATEGORY_LABELS[s.category].toLowerCase().includes(q),
    )
  }, [activeSpaces, spaceSearch])

  const kpiItems = useMemo(
    () => [
      { big: String(docs.stats.published), title: 'Publiserte sider', sub: 'Synlige dokumenter' },
      { big: String(docs.stats.drafts), title: 'Utkast', sub: 'Ikke publisert ennå' },
      { big: String(docs.stats.requireAck), title: 'Krever signatur', sub: 'Les og bekreft' },
      { big: String(docs.stats.acknowledged), title: 'Kvitteringer', sub: 'Signerte / lest' },
    ],
    [docs.stats.published, docs.stats.drafts, docs.stats.requireAck, docs.stats.acknowledged],
  )

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

  const foldersTable = (
    <ModuleRecordsTableShell
      wrapInCard={false}
      kpiItems={kpiItems}
      title="Mapper"
      description="Dokumentmapper for HMS-håndbok, policyer og prosedyrer."
      toolbar={
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <StandardInput
            type="search"
            value={spaceSearch}
            onChange={(e) => setSpaceSearch(e.target.value)}
            placeholder="Søk i mapper…"
            className="py-2 pl-10"
          />
        </div>
      }
      footer={<span className="text-sm text-neutral-500">{filteredSpaces.length} mapper</span>}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className={MODULE_TABLE_TH}>Mappe</th>
            <th className={MODULE_TABLE_TH}>Kategori</th>
            <th className={MODULE_TABLE_TH}>Sider</th>
            <th className={MODULE_TABLE_TH}>Publisert</th>
          </tr>
        </thead>
        <tbody>
          {filteredSpaces.map((space) => {
            const pagesInSpace = docs.pages.filter((p) => p.spaceId === space.id)
            const published = pagesInSpace.filter((p) => p.status === 'published').length
            return (
              <tr
                key={space.id}
                className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                onClick={() => navigate(`/documents/space/${space.id}`)}
              >
                <td className="px-5 py-4 align-middle">
                  <div className="flex items-start gap-2">
                    <span className="text-lg" aria-hidden>
                      {space.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900">{space.title}</div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{space.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 align-middle text-neutral-600">{CATEGORY_LABELS[space.category]}</td>
                <td className="px-5 py-4 align-middle text-neutral-600">{pagesInSpace.length}</td>
                <td className="px-5 py-4 align-middle text-neutral-600">{published}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ModuleRecordsTableShell>
  )

  const documentsAside = (
    <>
      <ModuleDocumentsInsightPanel title="Oversikt">
        <p className="text-xs text-neutral-600">
          Bruk søkefeltet i listen for å filtrere mapper etter tittel, kategori eller beskrivelse. Nye mapper opprettes med{' '}
          <span className="font-medium text-neutral-800">Ny mappe</span> i toppfeltet.
        </p>
        <div className="mt-3">
          <InfoBox>Malbibliotek og tilsynsklarhet finner du under listen på denne siden.</InfoBox>
        </div>
      </ModuleDocumentsInsightPanel>
    </>
  )

  return (
    <DocumentsModuleLayout>
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <ModuleDocumentsHubLayout
        regionId={DOCUMENTS_HUB_SECTION_IDS.mapper}
        main={foldersTable}
        aside={documentsAside}
        below={
          <>
            <div id={DOCUMENTS_HUB_SECTION_IDS.readiness} className="scroll-mt-6">
              <InspectionReadinessScore />
            </div>

            {showNewSpace && canManage ? (
              <ModuleSectionCard className="p-5 md:p-6">
                <h2 className="text-sm font-semibold text-neutral-900">Ny dokumentmappe</h2>
                <form onSubmit={(e) => void handleCreateSpace(e)} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="doc-new-space-title">
                      Tittel
                    </label>
                    <StandardInput
                      id="doc-new-space-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tittel"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="doc-new-space-category">
                      Kategori
                    </label>
                    <SearchableSelect
                      value={newCategory}
                      options={categoryOptions}
                      onChange={(v) => setNewCategory(v as WikiSpace['category'])}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="doc-new-space-desc">
                      Kort beskrivelse
                    </label>
                    <StandardInput
                      id="doc-new-space-desc"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Kort beskrivelse"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="primary" disabled={savingSpace}>
                      {savingSpace ? 'Oppretter…' : 'Opprett'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setShowNewSpace(false)}>
                      Avbryt
                    </Button>
                  </div>
                </form>
              </ModuleSectionCard>
            ) : null}

            <ModuleSectionCard id={DOCUMENTS_HUB_SECTION_IDS.templates} className="scroll-mt-6 p-5 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Malbibliotek</h2>
                <span className="text-xs text-neutral-500">
                  {docs.pageTemplates.length}{' '}
                  {docs.backend === 'supabase' ? 'tilgjengelige maler' : 'mal(er) (demo lokalt)'}
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
                          acknowledgementAudience: tpl.page.acknowledgementAudience,
                          revisionIntervalMonths: tpl.page.revisionIntervalMonths,
                          templateId: tpl.id,
                        },
                      )
                      navigate(`/documents/page/${page.id}/edit`)
                    }}
                  />
                ))}
              </div>
            </ModuleSectionCard>
          </>
        }
      />
    </DocumentsModuleLayout>
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

  const spaceOptions: SelectOption[] = useMemo(
    () => spaces.map((s) => ({ value: s.id, label: s.title })),
    [spaces],
  )

  return (
    <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="font-medium text-neutral-900">{tpl.label}</div>
      <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{tpl.description}</p>
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
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
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
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
