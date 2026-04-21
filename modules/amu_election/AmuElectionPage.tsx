import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { WarningBox } from '../../src/components/ui/AlertBox'
import type { AmuElectionRow } from './types'
import { useAmuElection } from './useAmuElection'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

const TH = `${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`

const STATUS_LABEL: Record<AmuElectionRow['status'], string> = {
  draft: 'Kladd',
  nomination: 'Nominasjon',
  voting: 'Stemmegivning',
  closed: 'Avsluttet',
}

function statusBadgeVariant(s: AmuElectionRow['status']): BadgeVariant {
  switch (s) {
    case 'draft':
      return 'neutral'
    case 'nomination':
      return 'info'
    case 'voting':
      return 'warning'
    case 'closed':
      return 'success'
    default:
      return 'neutral'
  }
}

function toIsoStart(dateYmd: string) {
  return new Date(`${dateYmd}T00:00:00`).toISOString()
}

function toIsoEnd(dateYmd: string) {
  return new Date(`${dateYmd}T23:59:59`).toISOString()
}

export function AmuElectionPage({ supabase }: { supabase: SupabaseClient | null }) {
  const nav = useNavigate()
  const { can, isAdmin } = useOrgSetupContext()
  const canOpenAdmin =
    isAdmin || can('amu_election.manage') || can('internkontroll.manage') || can('ik.manage')
  const {
    canManage,
    elections,
    activeElections,
    loadElections,
    loadActiveElections,
    createElection,
    setError,
    error,
    organizationId,
  } = useAmuElection({ supabase })
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [startYmd, setStartYmd] = useState('')
  const [endYmd, setEndYmd] = useState('')
  const [statusDraft, setStatusDraft] = useState<AmuElectionRow['status']>('draft')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (canManage) void loadElections()
    else void loadActiveElections()
  }, [canManage, loadActiveElections, loadElections, organizationId])

  const statusOptions = useMemo(
    () =>
      [
        { value: 'draft', label: STATUS_LABEL.draft },
        { value: 'nomination', label: STATUS_LABEL.nomination },
        { value: 'voting', label: STATUS_LABEL.voting },
        { value: 'closed', label: STATUS_LABEL.closed },
      ] as { value: AmuElectionRow['status']; label: string }[],
    [],
  )

  const openCreate = useCallback(() => {
    setTitle('')
    setStartYmd('')
    setEndYmd('')
    setStatusDraft('draft')
    setCreateOpen(true)
  }, [])

  const submitCreate = useCallback(async () => {
    if (!title.trim()) {
      setError('Tittel er påkrevd.')
      return
    }
    if (!startYmd || !endYmd) {
      setError('Velg start- og sluttdato.')
      return
    }
    setSaving(true)
    const row = await createElection({
      title: title.trim(),
      status: statusDraft,
      start_date: toIsoStart(startYmd),
      end_date: toIsoEnd(endYmd),
    })
    setSaving(false)
    if (row) {
      setCreateOpen(false)
      nav(`/internkontroll/amu-valg/${row.id}`)
    }
  }, [createElection, endYmd, nav, setError, startYmd, statusDraft, title])

  const rows = canManage ? elections : activeElections

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 md:px-8">
        <WorkplacePageHeading1
          breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'AMU-valg' }]}
          title="AMU-valg"
          description="Gjennomfør valg av representanter i tråd med medvirkningsforskriften kapittel 3."
          headerActions={
            canOpenAdmin ? (
              <Button type="button" variant="secondary" onClick={() => nav('/internkontroll/amu-valg/admin')}>
                <Settings className="h-4 w-4" aria-hidden />
                Innstillinger
              </Button>
            ) : null
          }
        />

        <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
          {error ? (
            <div className="border-b border-neutral-100 px-5 py-4">
              <WarningBox>{error}</WarningBox>
            </div>
          ) : null}

          <LayoutTable1PostingsShell
            wrap={false}
            titleTypography="sans"
            title="Valg"
            description={canManage ? 'Alle valg i organisasjonen.' : 'Aktive og avsluttede valg du kan følge.'}
            headerActions={
              canManage ? (
                <Button type="button" variant="primary" size="sm" onClick={openCreate}>
                  Nytt valg
                </Button>
              ) : null
            }
            toolbar={<span className="text-xs text-neutral-500">{rows.length} registrert</span>}
          >
            {rows.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-neutral-500">Ingen valg å vise ennå.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={TH}>Tittel</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                      <td className="px-5 py-3 font-medium text-neutral-900">{e.title}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(e.status)}>{STATUS_LABEL[e.status]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button type="button" variant="secondary" size="sm" onClick={() => nav(`/internkontroll/amu-valg/${e.id}`)}>
                          Åpne
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </LayoutTable1PostingsShell>
        </div>
      </div>

      <SlidePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleId="amu-create-election-title"
        title="Nytt valg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button type="button" variant="primary" disabled={saving} onClick={() => void submitCreate()}>
              {saving ? 'Oppretter…' : 'Opprett'}
            </Button>
          </div>
        }
      >
        <div className="space-y-0">
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-create-title">
              Tittel
            </label>
            <StandardInput id="amu-create-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Status</span>
            <SearchableSelect
              value={statusDraft}
              onChange={(v) => setStatusDraft(v as AmuElectionRow['status'])}
              options={statusOptions}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-create-start">
              Startdato
            </label>
            <StandardInput id="amu-create-start" type="date" value={startYmd} onChange={(e) => setStartYmd(e.target.value)} />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-create-end">
              Sluttdato
            </label>
            <StandardInput id="amu-create-end" type="date" value={endYmd} onChange={(e) => setEndYmd(e.target.value)} />
          </div>
        </div>
      </SlidePanel>
    </div>
  )
}
