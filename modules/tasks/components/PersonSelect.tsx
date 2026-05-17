// PersonSelect — combobox that lists org members with "Annet" free-text fallback.
// Used for metadata fields of kind='person' (involvert, melder, verifikator, etc.)

import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import type { AssignableUser } from '../../../src/hooks/useAssignableUsers'

type Props = {
  value: string
  onChange: (val: string) => void
  users: AssignableUser[]
  placeholder?: string
}

export function PersonSelect({ value, onChange, users, placeholder = 'Velg person…' }: Props) {
  const isKnown = value === '' || users.some((u) => u.displayName === value)
  const [freeText, setFreeText] = useState(!isKnown ? value : '')
  const [showingFree, setShowingFree] = useState(!isKnown && value !== '')
  const freeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showingFree) freeRef.current?.focus()
  }, [showingFree])

  const handleSelect = (v: string) => {
    if (v === '__other__') {
      setShowingFree(true)
      onChange(freeText)
    } else {
      setShowingFree(false)
      onChange(v)
    }
  }

  if (showingFree) {
    return (
      <div className="flex gap-1.5">
        <StandardInput
          ref={freeRef}
          value={freeText}
          onChange={(e) => { setFreeText(e.target.value); onChange(e.target.value) }}
          placeholder="Skriv navn…"
          className="flex-1 focus:border-[#c2410c] focus:ring-[#c2410c]/20"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => { setShowingFree(false); onChange(''); setFreeText('') }}
        >
          Tilbake
        </Button>
      </div>
    )
  }

  return (
    <SearchableSelect
      value={value}
      options={[
        { value: '', label: placeholder },
        ...users.map((u) => ({ value: u.displayName, label: u.displayName })),
        { value: '__other__', label: 'Annet / skriv inn navn…' },
      ]}
      onChange={handleSelect}
    />
  )
}
