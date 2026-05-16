// LocationSelect — select from org locations + "Annet" free-text fallback.

import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'

type Props = {
  value: string
  onChange: (val: string) => void
  locationNames: string[]
  placeholder?: string
}

export function LocationSelect({ value, onChange, locationNames, placeholder = 'Velg sted…' }: Props) {
  const isKnown = value === '' || locationNames.includes(value)
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
          placeholder="Beskriv stedet…"
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
        ...locationNames.map((loc) => ({ value: loc, label: loc })),
        { value: '__other__', label: 'Annet sted / skriv inn…' },
      ]}
      onChange={handleSelect}
    />
  )
}
