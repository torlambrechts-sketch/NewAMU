// SurveyLeverandorerTab — vendor master record CRUD for the org. Used as
// the recipient picker for vendor-pack surveys (XOR profile_id/vendor_id
// in survey_invitations).
//
// Mirrors SurveyPakkerTab's layout style but adds create + soft-delete
// alongside edit.

import { useMemo, useState } from 'react'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { Tabs, type TabItem } from '../../../src/components/ui/Tabs'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { useVendors } from '../useVendors'
import { VENDOR_STATUS_LABEL, type VendorRow, type VendorStatus } from '../types'
import { SurveyVendorEditorPanel } from './SurveyVendorEditorPanel'

type Props = {
  supabase: SupabaseClient | null
}

type StatusFilter = 'active' | 'all'

const STATUS_TABS: TabItem[] = [
  { id: 'active', label: 'Aktive' },
  { id: 'all', label: 'Alle' },
]

const STATUS_BADGE: Record<VendorStatus, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  inactive: 'neutral',
  offboarded: 'warning',
}

export function SurveyLeverandorerTab({ supabase }: Props) {
  const { vendors, error, createVendor, updateVendor, softDeleteVendor } = useVendors({ supabase })
  const [filter, setFilter] = useState<StatusFilter>('active')
  const [editing, setEditing] = useState<VendorRow | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const filtered = useMemo(() => {
    if (filter === 'all') return vendors
    return vendors.filter((v) => v.status === 'active' && v.is_active)
  }, [vendors, filter])

  return (
    <div className="space-y-6">
      {error ? <WarningBox>{error}</WarningBox> : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Leverandører</h2>
              <p className="mt-1.5 text-sm text-neutral-600">
                Mottakere for leverandørundersøkelser — egen masterliste med
                org.nr, kontaktperson og e-post. Brukes når en undersøkelse skal
                sendes til en organisasjon i stedet for ansatte.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreatingNew(true)}
          >
            Ny leverandør
          </Button>
        </div>

        <div className="mt-4">
          <Tabs
            items={STATUS_TABS}
            activeId={filter}
            onChange={(id) => setFilter(id as StatusFilter)}
          />
        </div>

        <div className="mt-4">
          <LayoutTable1PostingsShell
            wrap={false}
            title="Leverandørregister"
            description={`${filtered.length} ${filtered.length === 1 ? 'leverandør' : 'leverandører'}`}
            toolbar={null}
          >
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                {filter === 'active'
                  ? 'Ingen aktive leverandører ennå. Opprett den første med «Ny leverandør».'
                  : 'Ingen leverandører ennå.'}
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Navn</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Org.nr</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kontakt</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>E-post</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                      <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v) => (
                      <tr key={v.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <span className="font-medium text-neutral-900">{v.display_name}</span>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <span className="font-mono text-xs text-neutral-600">
                            {v.org_number ?? '—'}
                          </span>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>{v.contact_name ?? '—'}</td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>{v.primary_email ?? '—'}</td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <Badge variant={STATUS_BADGE[v.status]}>
                            {VENDOR_STATUS_LABEL[v.status]}
                          </Badge>
                        </td>
                        <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                          <div className="inline-flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(v)}
                              aria-label={`Rediger ${v.display_name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                if (
                                  typeof window !== 'undefined' &&
                                  !window.confirm(
                                    `Slette «${v.display_name}»? Tidligere undersøkelser bevares men leverandøren vil ikke kunne velges på nye.`,
                                  )
                                ) {
                                  return
                                }
                                void softDeleteVendor(v.id)
                              }}
                              aria-label={`Slett ${v.display_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LayoutTable1PostingsShell>
        </div>
      </ModuleSectionCard>

      {creatingNew ? (
        <SurveyVendorEditorPanel
          vendor={null}
          onClose={() => setCreatingNew(false)}
          onCreate={createVendor}
          onUpdate={updateVendor}
        />
      ) : null}

      {editing ? (
        <SurveyVendorEditorPanel
          vendor={editing}
          onClose={() => setEditing(null)}
          onCreate={createVendor}
          onUpdate={updateVendor}
        />
      ) : null}
    </div>
  )
}
