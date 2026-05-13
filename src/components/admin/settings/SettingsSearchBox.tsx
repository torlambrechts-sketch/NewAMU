// Settings search input.
//
// Reads `?q=` from the URL, debounces user typing, and on Enter navigates
// to the first matching (scope, section) pair found in the registry.
// Matching is case-insensitive against scope label, section label, and
// section `searchKeywords`.

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { StandardInput } from '../../ui/Input'
import {
  canSeePermAny,
  type SettingsScope,
  type SettingsSection,
} from '../../../lib/settings/settingsRegistry'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type Match = { scope: SettingsScope; section: SettingsSection }

interface SettingsSearchBoxProps {
  scopes: SettingsScope[]
  onMatch: (scopeId: string, sectionId: string) => void
}

export function SettingsSearchBox({ scopes, onMatch }: SettingsSearchBoxProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const [value, setValue] = useState(initialQ)
  const { can, isAdmin } = useOrgSetupContext()

  useEffect(() => {
    if (initialQ !== value) setValue(initialQ)
    // Intentionally only react to URL changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ])

  const matches = useMemo<Match[]>(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    const out: Match[] = []
    for (const scope of scopes) {
      if (!canSeePermAny(scope.permAny, can, isAdmin)) continue
      for (const section of scope.sections) {
        if (!canSeePermAny(section.permAny ?? scope.permAny, can, isAdmin)) continue
        const hay = [
          scope.label,
          section.label,
          ...(section.searchKeywords ?? []),
        ]
          .join(' ')
          .toLowerCase()
        if (hay.includes(q)) out.push({ scope, section })
      }
    }
    return out
  }, [scopes, value, can, isAdmin])

  const onEnter = () => {
    const first = matches[0]
    if (!first) return
    onMatch(first.scope.scopeId, first.section.id)
  }

  const onChange = (next: string) => {
    setValue(next)
    const params = new URLSearchParams(searchParams)
    if (next.trim()) params.set('q', next)
    else params.delete('q')
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        aria-hidden="true"
      />
      <StandardInput
        type="text"
        placeholder="Søk i innstillinger…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter()
        }}
        className="pl-9"
        aria-label="Søk i innstillinger"
      />
      {value && matches.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
          {matches.slice(0, 8).map((m) => (
            <button
              key={`${m.scope.scopeId}/${m.section.id}`}
              type="button"
              onClick={() => onMatch(m.scope.scopeId, m.section.id)}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              <span className="text-neutral-900">{m.section.label}</span>
              <span className="text-xs text-neutral-500">{m.scope.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
