import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GitBranch, Loader2, SlidersHorizontal, Users } from 'lucide-react'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { ModuleAdminShell } from '../components/layout/ModuleAdminShell'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../components/layout/layoutTable1PostingsKit'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { AMU_ELECTION_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowRuleFactory'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useAmuElection } from '../../modules/amu_election/useAmuElection'
import type { AmuElectionCommitteeMember, AmuElectionModuleSettings } from '../../modules/amu_election/types'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { WarningBox } from '../components/ui/AlertBox'
import { InfoBox } from '../components/ui/AlertBox'
import { Tabs, type TabItem } from '../components/ui/Tabs'

const TH = `${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`

type AdminTab = 'generelt' | 'valgstyre' | 'arbeidsflyt'

const TAB_ICONS: Record<AdminTab, ElementType> = {
  generelt: SlidersHorizontal,
  valgstyre: Users,
  arbeidsflyt: GitBranch,
}

export function AmuElectionAdminPage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('amu_election.manage') || can('internkontroll.manage') || can('ik.manage')
  const {
    error,
    setError,
    moduleSettings,
    settingsLoading,
    loadModuleSettings,
    loadAssignableUsersList,
    saveModuleSettings,
    assignableUsers,
  } = useAmuElection({ supabase })
  const [tab, setTab] = useState<AdminTab>('generelt')
  const [minDaysDraft, setMinDaysDraft] = useState('3')
  const [committeeDraft, setCommitteeDraft] = useState<AmuElectionCommitteeMember[]>([])
  const [pickUserId, setPickUserId] = useState('')
  const [pickRole, setPickRole] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    if (!canManage) return
    void loadModuleSettings()
    void loadAssignableUsersList()
  }, [canManage, loadAssignableUsersList, loadModuleSettings])

  useEffect(() => {
    setMinDaysDraft(String(moduleSettings.minimum_voting_days))
    setCommitteeDraft(moduleSettings.election_committee)
  }, [moduleSettings])

  const shellTabs = useMemo(
    () => [
      { key: 'generelt', label: 'Generelt', icon: <SlidersHorizontal className="h-4 w-4" /> },
      { key: 'valgstyre', label: 'Valgstyre', icon: <Users className="h-4 w-4" /> },
      { key: 'arbeidsflyt', label: 'Arbeidsflyt', icon: <GitBranch className="h-4 w-4" /> },
    ],
    [],
  )

  const tabsUiItems = useMemo<TabItem[]>(
    () =>
      shellTabs.map((t) => ({
        id: t.key,
        label: t.label,
        icon: TAB_ICONS[t.key as AdminTab],
      })),
    [shellTabs],
  )

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of assignableUsers) m.set(u.id, u.displayName)
    return m
  }, [assignableUsers])

  const persistSettings = useCallback(
    async (partial: Partial<AmuElectionModuleSettings>) => {
      const next: AmuElectionModuleSettings = {
        minimum_voting_days: partial.minimum_voting_days ?? moduleSettings.minimum_voting_days,
        election_committee: partial.election_committee ?? moduleSettings.election_committee,
      }
      setSavingSettings(true)
      const ok = await saveModuleSettings(next)
      setSavingSettings(false)
      return ok
    },
    [moduleSettings, saveModuleSettings],
  )

  const onSaveGenerelt = useCallback(async () => {
    const n = Number.parseInt(minDaysDraft, 10)
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      setError(getSupabaseErrorMessage('Minimum antall døgn må være mellom 1 og 365.'))
      return
    }
    await persistSettings({ minimum_voting_days: n, election_committee: committeeDraft })
  }, [committeeDraft, minDaysDraft, persistSettings, setError])

  const onSaveValgstyre = useCallback(async () => {
    await persistSettings({
      minimum_voting_days: moduleSettings.minimum_voting_days,
      election_committee: committeeDraft,
    })
  }, [committeeDraft, moduleSettings.minimum_voting_days, persistSettings])

  const addCommitteeMember = useCallback(() => {
    if (!pickUserId.trim()) {
      setError(getSupabaseErrorMessage('Velg medlem.'))
      return
    }
    if (committeeDraft.some((m) => m.user_id === pickUserId.trim())) {
      setError(getSupabaseErrorMessage('Medlemmet er allerede i valgstyret.'))
      return
    }
    setError(null)
    setCommitteeDraft((prev) => [...prev, { user_id: pickUserId.trim(), role_label: pickRole.trim() }])
    setPickUserId('')
    setPickRole('')
  }, [committeeDraft, pickRole, pickUserId, setError])

  if (!canManage) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] px-4 py-8 md:px-8">
        <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Du har ikke tilgang til modulens innstillinger. Kontakt administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
        <WorkplacePageHeading1
          breadcrumb={[
            { label: 'HMS' },
            { label: 'Internkontroll', to: '/internkontroll' },
            { label: 'AMU-valg', to: '/internkontroll/amu-valg' },
            { label: 'Innstillinger' },
          ]}
          title="AMU-valg — innstillinger"
          description="Regler for stemmeperiode, valgstyre og arbeidsflyt (e-post til alle ved åpning av valglokale m.m.)."
          headerActions={
            <Button type="button" variant="secondary" onClick={() => navigate('/internkontroll/amu-valg')}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Tilbake til valg
            </Button>
          }
        />

        {error ? <WarningBox>{error}</WarningBox> : null}

        <ModuleAdminShell
          title="Administrasjon"
          description="Innstillinger lagres i org_module_payloads (modulnøkkel amu_election) og gjelder hele organisasjonen."
          tabs={shellTabs}
          activeTab={tab}
          onTabChange={(k) => setTab(k as AdminTab)}
          layout="tabsTop"
          tabStrip={<Tabs items={tabsUiItems} activeId={tab} onChange={(id) => setTab(id as AdminTab)} />}
        >
          {tab === 'generelt' && (
            <div className="space-y-4">
              {settingsLoading ? (
                <p className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Laster innstillinger…
                </p>
              ) : null}
              <InfoBox>
                Minimum antall døgn for stemmeperioden brukes som sjekk når et valg settes til «Stemmegivning» (opprettelse
                eller oppdatering). Juster tallet etter virksomhetens praksis og avtaler.
              </InfoBox>
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <div className={WPSTD_FORM_ROW_GRID}>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-admin-min-vote-days">
                    Minimum døgn for stemmeperiode
                  </label>
                  <StandardInput
                    id="amu-admin-min-vote-days"
                    type="number"
                    min={1}
                    max={365}
                    value={minDaysDraft}
                    onChange={(e) => setMinDaysDraft(e.target.value)}
                  />
                </div>
                <div className="flex justify-end border-t border-neutral-100 px-4 py-3">
                  <Button type="button" variant="primary" disabled={savingSettings} onClick={() => void onSaveGenerelt()}>
                    {savingSettings ? 'Lagrer…' : 'Lagre generelt'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === 'valgstyre' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Registrer hvem som inngår i valgstyret (navn hentes fra brukerlisten). Dette er oversikt for
                organisasjonen — koble gjerne arbeidsflyt til hendelser under «Arbeidsflyt».
              </p>
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <div className={`${WPSTD_FORM_ROW_GRID} border-b-0`}>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Legg til medlem</span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        value={pickUserId}
                        onChange={(v) => setPickUserId(v)}
                        options={assignableUsers.map((u) => ({ value: u.id, label: u.displayName }))}
                        placeholder="Velg medarbeider…"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <StandardInput
                        placeholder="Rolle i valgstyret (f.eks. leder)"
                        value={pickRole}
                        onChange={(e) => setPickRole(e.target.value)}
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={addCommitteeMember}>
                      Legg til
                    </Button>
                  </div>
                </div>
              </div>

              {committeeDraft.length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                  Ingen valgstyremedlemmer registrert.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                        <th className={TH}>Medlem</th>
                        <th className={TH}>Rolle</th>
                        <th className={`${TH} text-right`}>Handling</th>
                      </tr>
                    </thead>
                    <tbody>
                      {committeeDraft.map((m, idx) => (
                        <tr key={`${m.user_id}-${idx}`} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                          <td className="px-5 py-3 font-medium text-neutral-900">
                            {nameById.get(m.user_id) ?? m.user_id}
                          </td>
                          <td className="px-5 py-3 text-neutral-700">{m.role_label || '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCommitteeDraft((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              Fjern
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="button" variant="primary" disabled={savingSettings} onClick={() => void onSaveValgstyre()}>
                  {savingSettings ? 'Lagrer…' : 'Lagre valgstyre'}
                </Button>
              </div>
            </div>
          )}

          {tab === 'arbeidsflyt' && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                Automatiser e-post til alle ansatte når valglokale åpner: opprett en regel med hendelsen «Stemmegivning
                åpnet» og handlingen «Send e-post».
              </p>
              <div className="inline-flex flex-wrap items-center gap-1 text-xs text-neutral-500" aria-hidden>
                <GitBranch className="h-3.5 w-3.5" />
                <span>ON_ELECTION_NOMINATION_OPEN · ON_ELECTION_VOTING_OPEN · ON_ELECTION_CLOSED</span>
              </div>
              <WorkflowRulesTab
                supabase={supabase}
                module="amu_election"
                triggerEvents={[...AMU_ELECTION_WORKFLOW_TRIGGER_EVENTS]}
              />
            </div>
          )}
        </ModuleAdminShell>
      </div>
    </div>
  )
}
