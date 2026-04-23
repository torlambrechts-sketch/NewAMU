import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDocuments } from '../../hooks/useDocuments'
import type { PageTemplate, WikiSpace } from '../../types/documents'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DOCUMENTS_HUB_SECTION_IDS } from '../../components/documents/documentsHubSectionIds'
import { ModuleDocumentsKandidatdetaljHub } from '../../components/module/ModuleDocumentsKandidatdetaljHub'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Button } from '../../components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'

/**
 * Dokumenter **Oversikt** — standard hub med {@link ModuleDocumentsKandidatdetaljHub}.
 */
export function DocumentsHome() {
  const docs = useDocuments()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const raw = location.hash.replace(/^#/, '')
    if (!raw) return
    if (raw !== DOCUMENTS_HUB_SECTION_IDS.mapper && raw !== DOCUMENTS_HUB_SECTION_IDS.templates) return
    queueMicrotask(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash])

  const activeSpaces = useMemo(() => docs.spaces.filter((s) => s.status === 'active'), [docs.spaces])

  return (
    <DocumentsModuleLayout>
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <div id={DOCUMENTS_HUB_SECTION_IDS.mapper} className="scroll-mt-6">
        <ModuleDocumentsKandidatdetaljHub variant="home" showIntro />
      </div>

      <ModuleSectionCard id={DOCUMENTS_HUB_SECTION_IDS.templates} className="scroll-mt-6 mt-8 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Malbibliotek</h2>
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
