import { useState } from 'react'
import { Shield, ShieldAlert } from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Button } from '../ui/Button'
import { StandardTextarea } from '../ui/Textarea'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { WarningBox } from '../ui/AlertBox'
import type { WikiAccessRequestDuration, WikiAccessRequestScope } from '../../types/wikiAccessRequest'

const SCOPE_OPTIONS: SelectOption[] = [
  { value: 'read', label: 'Kun lese (åpne og lese innhold)' },
  { value: 'edit', label: 'Redigering (krever også rolle «Dokumenter — rediger» etter godkjenning)' },
]

const DURATION_OPTIONS: SelectOption[] = [
  { value: 'session', label: 'Én økt / kortvarig behov' },
  { value: '7d', label: 'Inntil 7 dager' },
  { value: '30d', label: 'Inntil 30 dager' },
  { value: 'permanent', label: 'Varig tilgang (inntil den trekkes tilbake)' },
]

type Props = {
  documentLabel: string
  subLabel?: string
  busy: boolean
  error: string | null
  onSubmit: (input: {
    justification: string
    accessScope: WikiAccessRequestScope
    duration: WikiAccessRequestDuration
  }) => void | Promise<void>
  onCancel?: () => void
  /** When true, skip outer card chrome (for use inside dialogs). */
  embedded?: boolean
}

export function DocumentAccessRequestForm({
  documentLabel,
  subLabel,
  busy,
  error,
  onSubmit,
  onCancel,
  embedded = false,
}: Props) {
  const [justification, setJustification] = useState('')
  const [accessScope, setAccessScope] = useState<WikiAccessRequestScope>('read')
  const [duration, setDuration] = useState<WikiAccessRequestDuration>('session')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const j = justification.trim()
    void onSubmit({
      justification: j,
      accessScope,
      duration,
    })
  }

  const shellClass = embedded
    ? 'overflow-visible rounded-lg border border-neutral-200/90 shadow-sm'
    : 'overflow-visible border border-neutral-200/90 p-0 shadow-sm'

  const inner = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
        <span className="inline-flex items-center gap-1.5 text-emerald-900">
          <Shield className="size-3.5 shrink-0" aria-hidden />
          Tilgangssøknad
        </span>
        <span className="inline-flex items-center gap-1 text-amber-900">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
          Begrenset ressurs
        </span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Ressurs</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{documentLabel}</p>
          {subLabel ? <p className="mt-0.5 text-xs text-neutral-600">{subLabel}</p> : null}
        </div>
        {error ? <WarningBox>{error}</WarningBox> : null}
        <div>
          <span id="access-req-scope-label" className="mb-1 block text-xs font-medium text-neutral-500">
            Ønsket tilgang
          </span>
          <SearchableSelect
            value={accessScope}
            options={SCOPE_OPTIONS}
            onChange={(v) => setAccessScope(v as WikiAccessRequestScope)}
            disabled={busy}
          />
        </div>
        <div>
          <span id="access-req-duration-label" className="mb-1 block text-xs font-medium text-neutral-500">
            Varighet
          </span>
          <SearchableSelect
            value={duration}
            options={DURATION_OPTIONS}
            onChange={(v) => setDuration(v as WikiAccessRequestDuration)}
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="access-req-why">
            Begrunnelse <span className="text-red-600">*</span>
          </label>
          <StandardTextarea
            id="access-req-why"
            rows={4}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Beskriv hvorfor du trenger tilgang (f.eks. arbeidsoppgave, revisjon, AMU-sak) …"
            disabled={busy}
            required
          />
        </div>
        <p className="text-[10px] text-neutral-500">
          Forespørselen logges og kan behandles av administrator eller dokumentansvarlig. Ved godkjenning av
          «Kun lese» får du tilgang til mappen/dokumentet i denne organisasjonen. Redigering forutsetter i tillegg riktig
          rolle i systemet.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-3">
          {onCancel ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
              Avbryt
            </Button>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy || !justification.trim()}>
            {busy ? 'Sender…' : 'Send søknad'}
          </Button>
        </div>
      </form>
    </>
  )

  if (embedded) {
    return <div className={shellClass}>{inner}</div>
  }

  return <ModuleSectionCard className={shellClass}>{inner}</ModuleSectionCard>
}
