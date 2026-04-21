import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Plus, Search, Settings } from 'lucide-react'
import { FormModal } from '../../src/template'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleRecordsTableShell } from '../../src/components/module/ModuleRecordsTableShell'
import {
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../src/components/module/moduleTableKit'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { AmuDetailView } from './AmuDetailView'
import { useAmu } from './useAmu'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { WarningBox } from '../../src/components/ui/AlertBox'
import type { AmuMeeting } from './types'

const LIST_PATH = '/council/amu'
const AMU_ADMIN_PATH = '/council/amu/admin'

function statusBadgeVariant(status: AmuMeeting['status']): BadgeVariant {
  if (status === 'scheduled') return 'info'
  if (status === 'active') return 'warning'
  if (status === 'signed') return 'success'
  return 'neutral'
}

function statusLabel(status: AmuMeeting['status']): string {
  if (status === 'scheduled') return 'Planlagt'
  if (status === 'active') return 'Aktivt'
  if (status === 'completed') return 'Fullført'
  if (status === 'signed') return 'Signert'
  return status
}

function todayIso() {
  const d = new Date()
  const n = d.getDate()
  const m = d.getMonth() + 1
  const y = d.getFullYear()
  return `${y}-${m < 10 ? `0${m}` : m}-${n < 10 ? `0${n}` : n}`
}

export function AmuPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const amu = useAmu()

  const [listSearch, setListSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('AMU-møte')
  const [newDate, setNewDate] = useState(todayIso)
  const [newLocation, setNewLocation] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return amu.meetings
    return amu.meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.date.includes(q) ||
        m.location.toLowerCase().includes(q) ||
        statusLabel(m.status).toLowerCase().includes(q),
    )
  }, [amu.meetings, listSearch])

  const kpiItems = useMemo(() => {
    let scheduled = 0
    let active = 0
    let signed = 0
    for (const m of amu.meetings) {
      if (m.status === 'scheduled') scheduled++
      else if (m.status === 'active') active++
      else if (m.status === 'signed') signed++
    }
    return [
      { big: String(amu.meetings.length), title: 'Totalt møter', sub: 'Alle AMU-møter' },
      { big: String(scheduled), title: 'Planlagt', sub: 'Ikke startet' },
      { big: String(active), title: 'Aktivt', sub: 'Saksbehandling pågår' },
      { big: String(signed), title: 'Signert', sub: 'Referat låst' },
    ]
  }, [amu.meetings])

  const onCreate = useCallback(async () => {
    setCreating(true)
    const m = await amu.createMeeting({
      title: newTitle.trim() || 'AMU-møte',
      date: newDate,
      location: newLocation,
      status: 'scheduled',
    })
    setCreating(false)
    if (m) {
      setCreateOpen(false)
      navigate(`${LIST_PATH}/${m.id}`)
    }
  }, [amu, newTitle, newDate, newLocation, navigate])

  if (meetingId) {
    return <AmuDetailView amu={amu} meetingId={meetingId} listPath={LIST_PATH} />
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Samarbeid' }, { label: 'AMU' }]}
      title="Arbeidsmiljøutvalg (AMU)"
      description="Møter, saksbehandling og signert referat etter arbeidsmiljøloven kapittel 7. Velg et møte eller opprett et nytt."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {amu.canManage ? (
            <Link to={AMU_ADMIN_PATH}>
              <Button type="button" variant="secondary" icon={<Settings className="h-4 w-4" />}>
                <span className="hidden sm:inline">Innstillinger</span>
              </Button>
            </Link>
          ) : null}
          {amu.canManage ? (
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Nytt møte
            </Button>
          ) : null}
        </div>
      }
    >
      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      <ModuleRecordsTableShell
        kpiItems={kpiItems}
        title="Møter"
        description="Alle AMU-møter i virksomheten — sortert etter dato."
        headerActions={
          <Button type="button" variant="secondary" size="sm" onClick={() => void amu.refresh()}>
            Oppdater
          </Button>
        }
        toolbar={
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              className="py-2 pl-10"
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Søk i tittel, dato, sted, status…"
            />
          </div>
        }
        footer={
          <span className="text-neutral-500">
            {listSearch.trim() ? `${filtered.length} treff` : `Viser ${filtered.length} møter`}
          </span>
        }
      >
        <table className="w-full min-w-[640px] border-collapse text-left text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className={MODULE_TABLE_TH}>Dato</th>
              <th className={MODULE_TABLE_TH}>Tittel</th>
              <th className={MODULE_TABLE_TH}>Sted</th>
              <th className={MODULE_TABLE_TH}>Status</th>
              <th className={`w-8 ${MODULE_TABLE_TH}`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm whitespace-normal text-neutral-400"
                >
                  {amu.loading
                    ? 'Laster møter…'
                    : 'Ingen møter. Opprett et møte for å starte saksbehandling.'}
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr
                  key={m.id}
                  className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                  onClick={() => navigate(`${LIST_PATH}/${m.id}`)}
                >
                  <td className="px-5 py-4 align-middle text-neutral-800">
                    {new Date(`${m.date}T12:00:00`).toLocaleDateString('nb-NO')}
                  </td>
                  <td className="px-5 py-4 align-middle font-medium text-neutral-900">
                    {m.title}
                  </td>
                  <td className="px-5 py-4 align-middle text-neutral-600">
                    {m.location || '—'}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <Badge variant={statusBadgeVariant(m.status)}>{statusLabel(m.status)}</Badge>
                  </td>
                  <td className="w-8 px-3 py-4 align-middle text-neutral-300">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ModuleRecordsTableShell>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleId="amu-create"
        title="Nytt AMU-møte"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={creating || !newTitle.trim()}
              onClick={() => void onCreate()}
            >
              {creating ? 'Oppretter…' : 'Opprett møte'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className={WPSTD_FORM_FIELD_LABEL}>Tittel *</span>
            <StandardInput
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="F.eks. Q1 AMU-møte"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className={WPSTD_FORM_FIELD_LABEL}>Dato</span>
              <StandardInput
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={WPSTD_FORM_FIELD_LABEL}>Sted</span>
              <StandardInput
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Møterom / Teams"
              />
            </label>
          </div>
        </div>
      </FormModal>
    </ModulePageShell>
  )
}
