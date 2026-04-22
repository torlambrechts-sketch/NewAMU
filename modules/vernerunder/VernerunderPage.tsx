import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Loader2, Plus, Settings, Sparkles } from 'lucide-react'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { WorkplaceStandardFormPanel } from '../../src/components/layout/WorkplaceStandardFormPanel'
import {
  ModulePageShell,
  ModuleRecordsTableShell,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../src/components/module'
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

export function VernerunderPage({
  tabs,
  bodyOnly = false,
  hideAdminNav = false,
}: {
  /** Optional tabs row passed to `ModulePageShell.tabs`. */
  tabs?: ReactNode
  /**
   * When `true`, skip the ModulePageShell chrome and render the rounds
   * body only. Used when the parent already owns the page shell
   * (VernerunderPageRoute root-tab wrapper).
   */
  bodyOnly?: boolean
  /**
   * When `true`, hide the duplicate "Innstillinger" header button because
   * the page already renders root tabs (Oversikt / Innstillinger).
   */
  hideAdminNav?: boolean
} = {}) {
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

  const kpiItems = useMemo(() => {
    let draft = 0
    let active = 0
    let completed = 0
    let signed = 0
    for (const r of v.vernerunder) {
      if (r.status === 'draft') draft++
      else if (r.status === 'active') active++
      else if (r.status === 'completed') completed++
      else if (r.status === 'signed') signed++
    }
    const open = draft + active
    return [
      { big: String(v.vernerunder.length), title: 'Totalt runder', sub: 'Alle vernerunder' },
      { big: String(open), title: 'Åpne', sub: 'Kladd og aktiv' },
      { big: String(completed), title: 'Fullført', sub: 'Venter på signatur' },
      { big: String(signed), title: 'Signert', sub: 'Arkivert' },
    ]
  }, [v.vernerunder])

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {v.canManage && !hideAdminNav ? (
        <Button
          type="button"
          variant="secondary"
          icon={<Settings className="h-4 w-4" />}
          onClick={() => navigate('/vernerunder/admin')}
        >
          <span className="hidden sm:inline">Innstillinger</span>
        </Button>
      ) : null}
      {v.canManage ? (
        <Button
          type="button"
          variant="primary"
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={() => setCreateOpen(true)}
        >
          Ny vernerunde
        </Button>
      ) : null}
    </div>
  )

  const body = (
    <>
      {v.error ? <WarningBox>{v.error}</WarningBox> : null}

      <ModuleRecordsTableShell
        kpiItems={kpiItems}
        title="Aktive og planlagte runder"
        description="Klikk på en rad for å åpne detaljer, sjekkliste og signaturer."
        toolbar={<div className="min-w-0 flex-1" aria-hidden />}
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
              <tr>
                <th className={MODULE_TABLE_TH}>Tittel</th>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH}>Planlagt</th>
                <th className={`${MODULE_TABLE_TH} w-12 text-right`} aria-label="Handling" />
              </tr>
            </thead>
            <tbody>
              {v.vernerunder.map((r) => (
                <tr
                  key={r.id}
                  className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                  onClick={() => navigate(`/vernerunder/${r.id}`)}
                >
                  <td className="px-5 py-4 align-middle font-medium text-neutral-900">{r.title}</td>
                  <td className="px-5 py-4 align-middle">
                    <Badge variant={statusBadgeVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-5 py-4 align-middle text-neutral-600">{r.planned_date ?? '—'}</td>
                  <td className="px-5 py-4 text-right align-middle" onClick={(e) => e.stopPropagation()}>
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
      </ModuleRecordsTableShell>

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
    </>
  )

  if (bodyOnly) {
    return <>{body}</>
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Vernerunder' }]}
      title="Vernerunder"
      description="Planlegg, gjennomfør og dokumenter vernerunder med sjekkliste, funn og signaturer."
      tabs={tabs}
      headerActions={headerActions}
    >
      {body}
    </ModulePageShell>
  )
}
