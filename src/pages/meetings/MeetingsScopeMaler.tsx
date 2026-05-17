// Settings-hub wrapper for the Møter "Maler" tab. Mirrors the
// `TemplatesTab` internal function in `MeetingsAdminPage.tsx:192` so
// the unified settings shell can render it via React.lazy.

import { useMemo, useState } from 'react'
import { ClipboardList, Edit3, Layers, Pin, Plus } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import {
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../components/module/moduleTableKit'
import { useMeetings } from '../../../modules/meetings'
import {
  MEETING_CADENCE_LABEL,
  frameworkLabel,
} from '../../../modules/meetings/meetingsLabels'
import type { MeetingOrgTemplateRow } from '../../../modules/meetings/types'
import { MeetingFrameworkIcon } from '../../../modules/meetings/MeetingFrameworkIcon'
import { MeetingsTemplateEditorPanel } from './MeetingsTemplateEditorPanel'

export default function MeetingsScopeMaler() {
  const meetings = useMeetings()
  const { orgSettings } = meetings
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MeetingOrgTemplateRow | null>(null)

  const settingsById = useMemo(() => {
    const m = new Map<string, (typeof orgSettings)[number]>()
    for (const s of orgSettings) m.set(s.system_template_id, s)
    return m
  }, [orgSettings])

  const categoryOptions = useMemo(
    () => [
      { value: '', label: '— Uten kategori —' },
      ...meetings.categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [meetings.categories],
  )

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of meetings.categories) m.set(c.id, c.name)
    return m
  }, [meetings.categories])

  function openCreate() {
    setEditTarget(null)
    setEditorOpen(true)
  }
  function openEdit(template: MeetingOrgTemplateRow) {
    setEditTarget(template)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="!p-0">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Egne maler</h2>
              <p className="mt-0.5 text-sm text-neutral-600">
                Organisasjonsspesifikke maler. Disse vises sammen med systemmalene i hovedsiden.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            type="button"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={openCreate}
          >
            Ny mal
          </Button>
        </div>
        {meetings.orgTemplates.length === 0 ? (
          <p className="px-5 py-5 text-sm text-neutral-600">
            Ingen egne maler ennå. Trykk «Ny mal» for å bygge en organisasjonsspesifikk mal med egen agenda og roller.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {meetings.orgTemplates.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => openEdit(t)}
                    className="flex h-auto min-w-0 flex-1 items-start justify-start gap-3 rounded-none p-0 text-left font-normal hover:bg-transparent"
                  >
                    <div className="mt-0.5 shrink-0 rounded-md border border-neutral-200 bg-white p-2">
                      <MeetingFrameworkIcon framework={t.framework} className="h-4 w-4 text-[#1a3d32]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">{t.name}</span>
                        <Badge variant="info">{frameworkLabel(t.framework)}</Badge>
                        {t.cadence_hint ? (
                          <Badge variant="neutral">{MEETING_CADENCE_LABEL[t.cadence_hint]}</Badge>
                        ) : null}
                        {!t.is_active ? <Badge variant="neutral">Inaktiv</Badge> : null}
                        {t.category_id ? (
                          <Badge variant="neutral">{categoryNameById.get(t.category_id) ?? '—'}</Badge>
                        ) : null}
                      </div>
                      {t.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                      ) : null}
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    size="sm"
                    icon={<Edit3 className="h-3.5 w-3.5" />}
                    onClick={() => openEdit(t)}
                  >
                    Rediger
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>

      <ModuleSectionCard className="!p-0">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Systemmaler</h2>
              <p className="mt-0.5 text-sm text-neutral-600">
                Systemmaler kan slås av per organisasjon, knyttes til kategorier og festes i sidemenyen.
              </p>
            </div>
          </div>
          <span className="text-xs text-neutral-500">{meetings.systemTemplates.length} maler</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-neutral-50/60">
              <tr>
                <th className={MODULE_TABLE_TH}>Mal</th>
                <th className={MODULE_TABLE_TH}>Rammeverk</th>
                <th className={MODULE_TABLE_TH}>Kadens</th>
                <th className={MODULE_TABLE_TH}>Kategori</th>
                <th className={MODULE_TABLE_TH}>Aktiv</th>
                <th className={MODULE_TABLE_TH}>Festet</th>
              </tr>
            </thead>
            <tbody>
              {meetings.systemTemplates.map((t) => {
                const setting = settingsById.get(t.id)
                const enabled = setting?.enabled ?? true
                const pinned = setting?.nav_pinned ?? false
                const categoryId = setting?.category_id ?? ''
                return (
                  <tr key={t.id} className={MODULE_TABLE_TR_BODY}>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <MeetingFrameworkIcon
                          framework={t.framework}
                          className="h-4 w-4 shrink-0 text-[#1a3d32]/60"
                        />
                        <div>
                          <div className="font-medium text-neutral-900">
                            {setting?.override_name ?? t.label}
                          </div>
                          {t.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <Badge variant="info">{frameworkLabel(t.framework)}</Badge>
                    </td>
                    <td className="px-5 py-4 align-middle text-xs text-neutral-600">
                      {t.cadence_hint ? MEETING_CADENCE_LABEL[t.cadence_hint] : '—'}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <SearchableSelect
                        value={categoryId}
                        options={categoryOptions}
                        onChange={(val) => void meetings.setTemplateCategory(t.id, val || null)}
                        triggerClassName="py-1.5 text-xs"
                      />
                    </td>
                    <td className="px-5 py-4 align-middle text-center">
                      <StandardInput
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => void meetings.setTemplateEnabled(t.id, e.target.checked)}
                        aria-label={`Aktiv: ${t.label}`}
                      />
                    </td>
                    <td className="px-5 py-4 align-middle text-center">
                      <Button
                        variant={pinned ? 'primary' : 'ghost'}
                        size="icon"
                        type="button"
                        aria-label={`Fest ${t.label} i sidemenyen`}
                        onClick={() => void meetings.setTemplatePinned(t.id, !pinned)}
                        className="h-8 w-8"
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ModuleSectionCard>

      <MeetingsTemplateEditorPanel
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editTarget={editTarget}
      />
    </div>
  )
}
