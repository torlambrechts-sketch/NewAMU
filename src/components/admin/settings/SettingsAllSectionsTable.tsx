// Flat "Alle innstillinger" table for the settings hub.
//
// Mirrors the documents "Sider — alle mapper" view: shows every visible
// section across every scope in one table. Clicking a row routes to that
// scope/section. Lives next to `SettingsLeftRail` in the documents-style
// shell.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { ModuleRecordsTableShell } from '../../module/ModuleRecordsTableShell'
import {
  MODULE_TABLE_TD,
  MODULE_TABLE_TD_ACTION,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../module/moduleTableKit'
import { WIKI_FOLDER_ICON_CLASS } from '../../module/ModuleWikiFolderNavRow'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { canSeePermAny, type SettingsScope } from '../../../lib/settings/settingsRegistry'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

const GROUP_LABEL: Record<SettingsScope['group'], string> = {
  org: 'Organisasjon',
  module: 'Modul',
  system: 'System',
}

interface SettingsAllSectionsTableProps {
  scopes: SettingsScope[]
  onOpenSection: (scopeId: string, sectionId: string) => void
}

export function SettingsAllSectionsTable({
  scopes,
  onOpenSection,
}: SettingsAllSectionsTableProps) {
  const { can, isAdmin } = useOrgSetupContext()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const out: Array<{
      scope: SettingsScope
      section: SettingsScope['sections'][number]
    }> = []
    for (const scope of scopes) {
      if (!canSeePermAny(scope.permAny, can, isAdmin)) continue
      for (const section of scope.sections) {
        if (!canSeePermAny(section.permAny ?? scope.permAny, can, isAdmin)) continue
        out.push({ scope, section })
      }
    }
    return out
  }, [scopes, can, isAdmin])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(({ scope, section }) => {
      const hay = [
        scope.label,
        section.label,
        GROUP_LABEL[scope.group],
        ...(section.searchKeywords ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query])

  return (
    <ModuleRecordsTableShell
      wrapInCard={false}
      title="Innstillinger — alle områder"
      titleTypography="sans"
      description={`${filteredRows.length} seksjoner på tvers av områder`}
      toolbar={
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              type="search"
              className="w-full py-2 pl-10"
              placeholder="Søk i seksjoner…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Søk i seksjoner"
            />
          </div>
        </div>
      }
      footer={<span className="text-sm text-neutral-500">{filteredRows.length} treff</span>}
    >
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>
              Område
            </th>
            <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>
              Seksjon
            </th>
            <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>
              Kategori
            </th>
            <th className={`${MODULE_TABLE_TH} text-right text-sm normal-case font-semibold tracking-normal`}>
              Åpne
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-12 text-center text-sm text-neutral-500">
                Ingen seksjoner matcher søket.
              </td>
            </tr>
          ) : null}
          {filteredRows.map(({ scope, section }) => {
            const Icon = section.icon
            return (
              <tr key={`${scope.scopeId}/${section.id}`} className={MODULE_TABLE_TR_BODY}>
                <td className={`${MODULE_TABLE_TD} text-sm text-neutral-600`}>
                  <span className="inline-flex items-center gap-2">
                    {scope.accent ? (
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: scope.accent }}
                      />
                    ) : (
                      <span className={WIKI_FOLDER_ICON_CLASS} aria-hidden />
                    )}
                    {scope.label}
                  </span>
                </td>
                <td className={`${MODULE_TABLE_TD} text-sm text-neutral-900`}>
                  <button
                    type="button"
                    className="inline-flex min-w-0 items-center gap-2 text-left hover:underline"
                    onClick={() => {
                      onOpenSection(scope.scopeId, section.id)
                      navigate(`/admin/settings/${scope.scopeId}/${section.id}`)
                    }}
                  >
                    {Icon ? <Icon className="h-4 w-4 text-neutral-500" aria-hidden /> : null}
                    <span className="truncate font-medium">{section.label}</span>
                  </button>
                </td>
                <td className={`${MODULE_TABLE_TD}`}>
                  <Badge variant="neutral" className="scale-95">
                    {GROUP_LABEL[scope.group]}
                  </Badge>
                </td>
                <td className={`${MODULE_TABLE_TD_ACTION}`}>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      title="Åpne seksjon"
                      aria-label={`Åpne ${section.label}`}
                      onClick={() => {
                        onOpenSection(scope.scopeId, section.id)
                        navigate(`/admin/settings/${scope.scopeId}/${section.id}`)
                      }}
                      icon={<ChevronRight className="h-4 w-4" aria-hidden />}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ModuleRecordsTableShell>
  )
}
