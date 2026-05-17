// Settings-tab section that lets a draft's author invite specific people to
// see and comment on the document before it's published. Persists to the
// new wiki_page_draft_collaborators table; visibility is widened by an
// additive RLS policy on wiki_pages so invited users can read the draft
// even if they wouldn't normally see it via space grants.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Button } from '../ui/Button'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'

export type DraftCollaboratorRole = 'contributor' | 'reviewer'

type Collaborator = {
  id: string
  userId: string
  role: DraftCollaboratorRole
  displayName: string
  invitedAt: string
}

type DbRow = {
  id: string
  user_id: string
  role: string
  created_at: string
}

type Props = {
  pageId: string
  pageStatus: 'draft' | 'published' | 'archived'
  /** Org admin or document.manage / edit — gates the picker UI. */
  canManage: boolean
}

const ROLE_LABEL: Record<DraftCollaboratorRole, string> = {
  contributor: 'Bidragsyter',
  reviewer: 'Gjennomgår',
}

export function DocumentDraftCollaborators({ pageId, pageStatus, canManage }: Props) {
  const { supabase, organization, user, orgProfiles } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rows, setRows] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<DraftCollaboratorRole>('contributor')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !pageId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wiki_page_draft_collaborators')
        .select('id, user_id, role, created_at')
        .eq('organization_id', orgId)
        .eq('page_id', pageId)
        .order('created_at', { ascending: true })
      if (error) {
        if (!String(error.message).toLowerCase().includes('does not exist')) {
          setErr(error.message)
        }
        setRows([])
        return
      }
      const displayMap = new Map(orgProfiles.map((p) => [p.id, p.display_name]))
      setRows(
        (data ?? []).map((r: DbRow) => ({
          id: r.id,
          userId: r.user_id,
          role: r.role === 'reviewer' ? 'reviewer' : 'contributor',
          displayName: displayMap.get(r.user_id) ?? r.user_id.slice(0, 8),
          invitedAt: r.created_at,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, pageId, orgProfiles])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const existing = useMemo(() => new Set(rows.map((r) => r.userId)), [rows])
  const userOptions = useMemo((): SelectOption[] => {
    return [
      { value: '', label: 'Velg en kollega…' },
      ...orgProfiles
        .filter((p) => p.id !== user?.id && !existing.has(p.id))
        .map((p) => ({ value: p.id, label: p.display_name })),
    ]
  }, [orgProfiles, user?.id, existing])

  async function add() {
    if (!supabase || !orgId || !selectedUser) return
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.from('wiki_page_draft_collaborators').insert({
        organization_id: orgId,
        page_id: pageId,
        user_id: selectedUser,
        role: selectedRole,
        invited_by: user?.id ?? null,
      })
      if (error) throw error
      setSelectedUser('')
      setSelectedRole('contributor')
      setPickerOpen(false)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kunne ikke legge til.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(rowId: string) {
    if (!supabase || !orgId) return
    const { error } = await supabase
      .from('wiki_page_draft_collaborators')
      .delete()
      .eq('id', rowId)
      .eq('organization_id', orgId)
    if (error) {
      setErr(error.message)
      return
    }
    await refresh()
  }

  if (pageStatus !== 'draft') {
    return (
      <p className="text-xs text-neutral-500">
        Samarbeidere kan kun legges til mens dokumentet er utkast. Etter publisering styres tilgang av mappetillatelsene.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Ingen samarbeidere ennå. Inviter kolleger til å lese og kommentere før du publiserer.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
            >
              <span className="font-medium text-neutral-800">{r.displayName}</span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-600">
                {ROLE_LABEL[r.role]}
              </span>
              <span className="ml-auto text-[10px] text-neutral-400">
                {new Date(r.invitedAt).toLocaleDateString('nb-NO')}
              </span>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="inline-flex h-5 w-5 items-center justify-center rounded p-0 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                  aria-label={`Fjern ${r.displayName}`}
                  onClick={() => void remove(r.id)}
                >
                  <X className="size-3" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        pickerOpen ? (
          <div className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <SearchableSelect value={selectedUser} options={userOptions} onChange={setSelectedUser} />
              <SearchableSelect
                value={selectedRole}
                onChange={(v) => setSelectedRole(v === 'reviewer' ? 'reviewer' : 'contributor')}
                options={[
                  { value: 'contributor', label: 'Bidragsyter' },
                  { value: 'reviewer', label: 'Gjennomgår' },
                ]}
              />
            </div>
            {err ? <p className="text-red-600">{err}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" size="sm" disabled={busy || !selectedUser} onClick={() => void add()}>
                {busy ? 'Legger til…' : 'Legg til'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPickerOpen(false)
                  setSelectedUser('')
                  setErr(null)
                }}
              >
                Avbryt
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="size-3.5" aria-hidden />}
            onClick={() => setPickerOpen(true)}
            disabled={loading}
          >
            Inviter samarbeider
          </Button>
        )
      ) : null}
    </div>
  )
}
