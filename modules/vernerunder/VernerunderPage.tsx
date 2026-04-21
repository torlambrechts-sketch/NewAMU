import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, Loader2, Plus, Sparkles } from 'lucide-react'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { WorkplaceStandardFormPanel } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../src/components/ui/Input'
import { WarningBox } from '../../src/components/ui/AlertBox'
import type { VernerunderRow } from './types'
import { useVernerunde } from './useVernerunde'

const STATUS_LABEL: Record<VernerunderRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  completed: 'Fullført',
  signed: 'Signert',
}

function statusBadgeVariant(s: VernerunderRow['status']): 'draft' | 'active' | 'signed' | 'success' {
  if (s === 'signed') return 'signed'
  if (s === 'completed') return 'success'
  if (s === 'active') return 'active'
  return 'draft'
}

function ListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400">
        <Sparkles className="h-7 w-7" strokeWidth={1.25} aria-hidden />
      </div>
      <p className="max-w-sm text-sm font-medium text-neutral-800">Ingen vernerunder ennå</p>
      <p className="max-w-md text-sm text-neutral-500">
        Opprett en runde for å planlegge dato, sjekkliste, funn og deltakere — i tråd med arbeidsmiljøloven og medvirkning.
      </p>
    </div>
  )
}

export function VernerunderPage() {
  const navigate = useNavigate()
  const v = useVernerunde()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [plannedYmd, setPlannedYmd] = useState('')

  useEffect(() => {
    void v.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.load])

  const templateOptions: SelectOption[] = useMemo(() => {
    return [{ value: '', label: 'Uten mal' }, ...v.templates.map((t) => ({ value: t.id, label: t.name }))]
  }, [v.templates])

  const onCreate = useCallback(async () => {
    if (!title.trim()) {
      v.setError('Tittel er påkrevd.')
      return
    }
    const row = await v.createVernerunde({
      title: title.trim(),
      template_id: templateId || null,
      planned_date: plannedYmd || null,
    })
    if (row) {
      setCreateOpen(false)
      setTitle('')
      setTemplateId('')
      setPlannedYmd('')
      navigate(`/vernerunder/${row.id}`)
    }
  }, [v, title, templateId, plannedYmd, navigate])

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="border-b border-neutral-200/80 bg-[#F9F7F2]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
          <WorkplacePageHeading1
            breadcrumb={[{ label: 'HMS', to: '/compliance' }, { label: 'Vernerunder' }]}
            title="Vernerunder"
            description="Planlegg, gjennomfør og dokumenter vernerunder med sjekkliste, funn og signaturer."
            menu={null}
            headerActions={
              <div className="flex flex-wrap items-center gap-2">
                {v.canManage ? (
                  <Link
                    to="/vernerunder/admin"
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Innstillinger
                  </Link>
                ) : null}
                {v.canManage ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="default"
                    icon={<Plus className="h-4 w-4" aria-hidden />}
                    onClick={() => setCreateOpen(true)}
                  >
                    Ny vernerunde
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
        {v.error ? (
          <div className={WORKPLACE_MODULE_CARD} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <div className="p-4">
              <WarningBox>{v.error}</WarningBox>
            </div>
          </div>
        ) : null}

        <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
          <LayoutTable1PostingsShell
            wrap={false}
            titleTypography="sans"
            title="Aktive og planlagte runder"
            description="Klikk på en rad for å åpne detaljer, sjekkliste og signaturer."
            toolbar={<span className="text-sm text-neutral-500">Oversikt</span>}
            headerActions={null}
          >
            {v.loading && v.vernerunder.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Laster…
              </div>
            ) : v.vernerunder.length === 0 ? (
              <ListEmpty />
            ) : (
              <table className="w-full min-w-0 text-left text-sm text-neutral-800">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
                    <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-12 text-right`} aria-label="Handling" />
                  </tr>
                </thead>
                <tbody>
                  {v.vernerunder.map((r) => (
                    <tr key={r.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                      <td className="px-5 py-3 font-medium text-neutral-900">{r.title}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-neutral-600">{r.planned_date ?? '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Åpne"
                          onClick={() => navigate(`/vernerunder/${r.id}`)}
                          icon={<ClipboardList className="h-4 w-4" />}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </LayoutTable1PostingsShell>
        </div>
      </div>

      <WorkplaceStandardFormPanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleId="vnr-create-title"
        title="Ny vernerunde"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button type="button" variant="primary" onClick={() => void onCreate()}>
              Opprett
            </Button>
          </div>
        }
      >
        <div className={WPSTD_FORM_ROW_GRID}>
          <span className={WPSTD_FORM_FIELD_LABEL}>Tittel</span>
          <StandardInput id="vnr-create-name" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <span className={WPSTD_FORM_FIELD_LABEL}>Mal (valgfritt)</span>
          <SearchableSelect
            value={templateId}
            options={templateOptions}
            onChange={setTemplateId}
            placeholder="Uten mal"
          />
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <span className={WPSTD_FORM_FIELD_LABEL}>Planlagt dato</span>
          <StandardInput
            type="date"
            value={plannedYmd}
            onChange={(e) => setPlannedYmd(e.target.value)}
            aria-label="Planlagt dato"
          />
        </div>
      </WorkplaceStandardFormPanel>
    </div>
  )
}
