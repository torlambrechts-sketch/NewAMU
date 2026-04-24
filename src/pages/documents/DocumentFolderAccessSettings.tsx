import { useCallback, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { WikiSpaceGrantType } from '../../lib/wikiSpaceAccessGrants'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module/moduleTableKit'
import { Button } from '../../components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'

const GRANT_LABEL: Record<WikiSpaceGrantType, string> = {
  user: 'Bruker',
  department: 'Avdeling',
  team: 'Team',
}

const GRANT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'user', label: GRANT_LABEL.user },
  { value: 'department', label: GRANT_LABEL.department },
  { value: 'team', label: GRANT_LABEL.team },
]

type Props = {
  /** When false, hide the whole block (caller handles access message). */
  canManage: boolean
}

export function DocumentFolderAccessSettings({ canManage }: Props) {
  const docs = useDocuments()
  const { user, orgProfiles, departments, teams } = useOrgSetupContext()

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('')
  const [grantType, setGrantType] = useState<WikiSpaceGrantType>('department')
  const [subjectId, setSubjectId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const folderSpaces = useMemo(
    () => docs.spaces.filter((s) => s.status === 'active' && s.category !== 'template_library'),
    [docs.spaces],
  )

  const spaceOptions: SelectOption[] = useMemo(
    () => folderSpaces.map((s) => ({ value: s.id, label: s.title })),
    [folderSpaces],
  )

  const subjectOptions: SelectOption[] = useMemo(() => {
    if (grantType === 'user') {
      return orgProfiles
        .map((p) => ({
          value: p.id,
          label: p.id === user?.id ? `${p.display_name} (meg)` : `${p.display_name}${p.email ? ` · ${p.email}` : ''}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'nb'))
    }
    if (grantType === 'department') {
      return departments.map((d) => ({ value: d.id, label: d.name }))
    }
    return teams.map((t) => ({ value: t.id, label: t.name }))
  }, [grantType, user?.id, orgProfiles, departments, teams])

  const grantsForSpace = useMemo(() => {
    if (!selectedSpaceId) return []
    return docs.wikiSpaceAccessGrants.filter((g) => g.spaceId === selectedSpaceId)
  }, [docs.wikiSpaceAccessGrants, selectedSpaceId])

  const subjectLabel = useCallback(
    (gtype: WikiSpaceGrantType, sid: string) => {
      if (gtype === 'user') {
        const p = orgProfiles.find((x) => x.id === sid)
        if (p) return p.id === user?.id ? `${p.display_name} (meg)` : p.display_name
        return sid
      }
      if (gtype === 'department') {
        return departments.find((d) => d.id === sid)?.name ?? sid
      }
      return teams.find((t) => t.id === sid)?.name ?? sid
    },
    [user?.id, orgProfiles, departments, teams],
  )

  const onAdd = useCallback(async () => {
    if (!canManage || !selectedSpaceId || !subjectId.trim()) {
      setErr('Velg mappe og hvem som skal ha tilgang.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      await docs.addWikiSpaceAccessGrant(selectedSpaceId, grantType, subjectId.trim())
      setSubjectId('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kunne ikke legge til tilgang.')
    } finally {
      setBusy(false)
    }
  }, [canManage, selectedSpaceId, subjectId, grantType, docs])

  const onRemove = useCallback(
    async (id: string) => {
      if (!canManage) return
      setErr(null)
      setBusy(true)
      try {
        await docs.removeWikiSpaceAccessGrant(id)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Kunne ikke fjerne tilgang.')
      } finally {
        setBusy(false)
      }
    },
    [canManage, docs],
  )

  if (!canManage) return null

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-sm font-semibold text-neutral-900">Mappe-tilgang (RBAC)</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Når du legger til minst én regel for en mappe, kan kun oppførte brukere, avdelinger eller team se dokumentene i
        den mappen (i tillegg til organisasjonsadministratorer og personer med «Dokumenter — administrer»). Uten regler
        gjelder vanlig tilgang for alle i organisasjonen.
      </p>

      {err ? (
        <div className="mt-3">
          <WarningBox>{err}</WarningBox>
        </div>
      ) : null}

      {folderSpaces.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">Ingen dokumentmapper ennå. Opprett en mappe under Dokumenter først.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-500">Mappe</label>
              <SearchableSelect
                value={selectedSpaceId}
                options={spaceOptions}
                onChange={(v) => {
                  setSelectedSpaceId(v)
                  setSubjectId('')
                }}
                placeholder="Velg mappe…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Type</label>
              <SearchableSelect
                value={grantType}
                options={GRANT_TYPE_OPTIONS}
                onChange={(v) => {
                  setGrantType(v as WikiSpaceGrantType)
                  setSubjectId('')
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">{GRANT_LABEL[grantType]}</label>
              <SearchableSelect
                value={subjectId}
                options={subjectOptions}
                onChange={(v) => setSubjectId(v)}
                placeholder="Velg…"
                disabled={!selectedSpaceId}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="primary" disabled={busy || !selectedSpaceId || !subjectId} onClick={() => void onAdd()}>
              Legg til tilgang
            </Button>
          </div>

          {selectedSpaceId ? (
            <div className="mt-6 overflow-x-auto">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Regler for «{folderSpaces.find((s) => s.id === selectedSpaceId)?.title ?? selectedSpaceId}»
              </h3>
              {grantsForSpace.length === 0 ? (
                <p className="text-sm text-neutral-600">Ingen begrensning — alle i organisasjonen kan se dokumenter i mappen.</p>
              ) : (
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      <th className={MODULE_TABLE_TH}>Type</th>
                      <th className={MODULE_TABLE_TH}>Hvem</th>
                      <th className={`${MODULE_TABLE_TH} text-right`}>Fjern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grantsForSpace.map((g) => (
                      <tr key={g.id} className={MODULE_TABLE_TR_BODY}>
                        <td className="px-5 py-3 text-neutral-700">{GRANT_LABEL[g.grantType]}</td>
                        <td className="px-5 py-3 font-medium text-neutral-900">{subjectLabel(g.grantType, g.subjectId)}</td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-neutral-500 hover:text-red-700"
                            title="Fjern regel"
                            aria-label="Fjern regel"
                            disabled={busy}
                            onClick={() => void onRemove(g.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </>
      )}
    </ModuleSectionCard>
  )
}
