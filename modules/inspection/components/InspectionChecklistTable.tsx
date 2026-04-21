import { useMemo, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  ModuleChecklistCard,
  type ModuleChecklistItem as SharedChecklistItem,
  type ModuleChecklistResponseMap,
} from '../../../src/components/module/ModuleChecklistCard'
import type { HmsCategory, InspectionChecklistItem, InspectionFieldType, InspectionItemRow } from '../types'

const CATEGORY_LABELS: Record<HmsCategory, string> = {
  fysisk: 'Fysisk arbeidsmiljø',
  ergonomi: 'Ergonomi og tilrettelegging',
  kjemikalier: 'Kjemikalier og farlige stoffer',
  psykososialt: 'Psykososialt arbeidsmiljø',
  brann: 'Brann og rømning',
  maskiner: 'Maskiner og teknisk utstyr',
  annet: 'Annet',
}

function mapFieldType(ft: InspectionFieldType | undefined): SharedChecklistItem['fieldType'] {
  switch (ft) {
    case 'text':
      return 'text'
    case 'number':
      return 'number'
    case 'photo':
    case 'photo_required':
    case 'signature':
      return 'readonly'
    case 'yes_no_na':
    default:
      return 'yes_no_na'
  }
}

export type InspectionChecklistTableProps = {
  checklistItems: InspectionChecklistItem[]
  roundItems: InspectionItemRow[] | undefined
  readOnly: boolean
  onSaveResponse: (key: string, value: string, notes: string | null) => Promise<void>
  onRegisterFinding: (itemKey: string) => void
  /** Optional banner shown between the card header and the progress row. */
  activationBanner?: ReactNode
  /** Optional extras rendered on the right of the progress strip (e.g. GPS chip). */
  toolbarExtras?: ReactNode
}

/**
 * Thin module-specific adapter around the shared {@link ModuleChecklistCard}.
 * All checklist chrome (green banner, progress bar, status circles, answer
 * controls, action icon) lives in the shared primitive; this file only
 * translates the inspection domain types (checklist definition + round-item
 * rows) into the generic `items`/`responses` shape.
 */
export function InspectionChecklistTable({
  checklistItems,
  roundItems,
  readOnly,
  onSaveResponse,
  onRegisterFinding,
  activationBanner,
  toolbarExtras,
}: InspectionChecklistTableProps) {
  const items: SharedChecklistItem[] = useMemo(
    () =>
      checklistItems.map((item) => ({
        key: item.key,
        label: item.label,
        required: item.required,
        helpText: item.helpText,
        lawRef: item.lawRef,
        fieldType: mapFieldType(item.fieldType),
        categoryLabel: item.hmsCategory ? CATEGORY_LABELS[item.hmsCategory] : 'Generelt',
      })),
    [checklistItems],
  )

  const responses = useMemo<ModuleChecklistResponseMap>(() => {
    const map: ModuleChecklistResponseMap = {}
    for (const row of roundItems ?? []) {
      const value = typeof row.response?.value === 'string' ? row.response.value : ''
      map[row.checklist_item_key] = { value, notes: row.notes }
    }
    return map
  }, [roundItems])

  const loading = roundItems === undefined

  return (
    <ModuleChecklistCard
      title="IK-forskriften § 5 — sjekkliste"
      description={
        <p>
          Gå gjennom punktene og registrer svar. Bruk handlingsikonet for å registrere avvik på et
          enkeltpunkt.
        </p>
      }
      items={items}
      responses={responses}
      readOnly={readOnly}
      loading={loading}
      alertBanner={activationBanner}
      toolbarExtras={toolbarExtras}
      onChange={(key, next) => onSaveResponse(key, next.value, next.notes ?? null)}
      secondaryAction={{
        icon: <AlertCircle className="h-4 w-4 text-neutral-400 hover:text-red-600" />,
        label: 'Registrer avvik',
        onClick: onRegisterFinding,
        hidden: readOnly,
      }}
    />
  )
}
