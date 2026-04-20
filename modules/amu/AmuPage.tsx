import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Search, Settings } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
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

  const [newTitle, setNewTitle] = useState('AMU-møte')
  const [newDate, setNewDate] = useState(todayIso)
  const [newLocation, setNewLocation] = useState('')
  const [listSearch, setListSearch] = useState('')

  const filtered = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return amu.meetings
    return amu.meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) || m.date.includes(q) || m.location.toLowerCase().includes(q) || statusLabel(m.status).toLowerCase().includes(q),
    )
  }, [amu.meetings, listSearch])

  const onCreate = useCallback(async () => {
    const m = await amu.createMeeting({
      title: newTitle.trim() || 'AMU-møte',
      date: newDate,
      location: newLocation,
      status: 'scheduled',
    })
    if (m) {
      navigate(`${LIST_PATH}/${m.id}`)
    }
  }, [amu, newTitle, newDate, newLocation, navigate])

  if (meetingId) {
    return <AmuDetailView amu={amu} meetingId={meetingId} listPath={LIST_PATH} />
  }

  return (
    <div className="flex min-h-0 w-full min-h-full flex-col p-4 md:p-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Council' }, { label: 'AMU' }]}
        title="Arbeidsmiljøutvalg (AMU)"
        description="Møter, saksbehandling og signert referat etter arbeidsmiljøloven kapittel 7. Velg et møte eller opprett et nytt."
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {amu.canManage ? (
              <Link to={AMU_ADMIN_PATH}>
                <Button type="button" variant="secondary" icon={<Settings className="h-4 w-4" />}>
                  Innstillinger
                </Button>
              </Link>
            ) : null}
            {amu.canManage ? (
              <Button type="button" variant="primary" onClick={() => void onCreate()} icon={<Plus className="h-4 w-4" />}>
                Nytt møte
              </Button>
            ) : null}
          </div>
        }
      />

      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      {amu.canManage && (
        <div className={`mb-6 ${WORKPLACE_MODULE_CARD} p-5`} style={WORKPLACE_MODULE_CARD_SHADOW}>
          <h2 className="text-sm font-semibold text-neutral-900">Opprett møte</h2>
          <p className="mt-1 text-sm text-neutral-600">Dato, sted og tittel — du kan fylle ut resten i planleggingsfanen.</p>
          <div className="mt-4 space-y-4">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <div className={WPSTD_FORM_FIELD_LABEL}>Grunnopplysninger</div>
                <p className="text-sm text-neutral-600">Datoen brukes for innkalling og referatarkiv.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-new-title">Tittel</label>
                  <StandardInput id="amu-new-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-new-date">Dato</label>
                  <StandardInput id="amu-new-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-new-loc">Sted</label>
                  <StandardInput
                    id="amu-new-loc"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="F.eks. Møterom / Teams"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end">
              <Button
                type="button"
                variant="primary"
                onClick={() => void onCreate()}
                disabled={amu.loading}
                icon={<Plus className="h-4 w-4" />}
              >
                Opprett møte
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={WORKPLACE_MODULE_CARD} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <div className="p-0">
          <LayoutTable1PostingsShell
            title="Møter"
            description="Alle møter i valgt virksomhet. Åpne et møte for saksbehandling og møterom."
            headerActions={
              <Button type="button" variant="secondary" size="sm" onClick={() => void amu.refresh()}>
                Oppdater
              </Button>
            }
            wrap={false}
            toolbar={
              <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <StandardInput
                  className="min-w-0 flex-1"
                  type="search"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Søk i tittel, dato, sted, status…"
                />
              </div>
            }
          >
            {filtered.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-neutral-600">Ingen møter. Opprett møtet ditt for å starte saksbehandling.</p>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Dato</th>
                    <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tittel</th>
                    <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sted</th>
                    <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Status</th>
                    <th className="bg-neutral-50 px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b border-neutral-100 transition-colors hover:bg-neutral-50">
                      <td className="px-5 py-3 text-neutral-800">
                        {new Date(`${m.date}T12:00:00`).toLocaleDateString('nb-NO')}
                      </td>
                      <td className="px-5 py-3 font-medium text-neutral-900">{m.title}</td>
                      <td className="px-5 py-3 text-neutral-600">{m.location || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(m.status)}>{statusLabel(m.status)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          to={`${LIST_PATH}/${m.id}`}
                          className="text-sm font-medium text-[#1a3d32] underline decoration-[#1a3d32]/30 underline-offset-2 hover:decoration-[#1a3d32]"
                        >
                          Åpne
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </LayoutTable1PostingsShell>
        </div>
      </div>
    </div>
  )
}
