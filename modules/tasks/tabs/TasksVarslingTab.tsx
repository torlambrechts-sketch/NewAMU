import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, Lock, Plus } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import {
  MODULE_TABLE_TD,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../../src/components/module/moduleTableKit'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { YesNoToggle } from '../../../src/components/ui/FormToggles'
import { InfoBox, WarningBox } from '../../../src/components/ui/AlertBox'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { useWhistleblowing, acknowledgementUrgency } from '../../../src/hooks/useWhistleblowing'
import {
  WHISTLE_CATEGORY_OPTIONS,
  type WhistleblowingCaseStatus,
} from '../../../src/types/whistleblowing'

const STATUS_LABELS: Record<WhistleblowingCaseStatus, string> = {
  received: 'Mottatt',
  triage: 'Vurdering',
  investigation: 'Undersøkelse',
  internal_review: 'Intern revisjon',
  closed: 'Avsluttet',
}

const STATUS_OPTIONS: ReadonlyArray<{ value: WhistleblowingCaseStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Alle statuser' },
  { value: 'received', label: STATUS_LABELS.received },
  { value: 'triage', label: STATUS_LABELS.triage },
  { value: 'investigation', label: STATUS_LABELS.investigation },
  { value: 'internal_review', label: STATUS_LABELS.internal_review },
  { value: 'closed', label: STATUS_LABELS.closed },
]

function statusBadgeVariant(status: WhistleblowingCaseStatus) {
  if (status === 'closed') return 'success' as const
  if (status === 'received') return 'warning' as const
  return 'info' as const
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '—'
  return t.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Whistleblowing (varsling) cases — list, status updates, new case panel.
 *
 * AML §§ 2 A-1 to 2 A-7: arbeidsgiver skal ha rutiner for varsling og gi
 * skriftlig tilbakemelding innen rimelig tid. The case row exposes
 * `acknowledgement_due_at` so this view shows how urgent that timer is.
 */
export function TasksVarslingTab() {
  const wb = useWhistleblowing()
  const [statusFilter, setStatusFilter] = useState<WhistleblowingCaseStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [submitting, setSubmitting] = useState(false)
  const [createdAccessKey, setCreatedAccessKey] = useState<string | null>(null)

  const stats = useMemo(() => {
    const open = wb.cases.filter((c) => c.status !== 'closed')
    const overdue = open.filter((c) => acknowledgementUrgency(c.acknowledgement_due_at) === 'overdue')
    const soon = open.filter((c) => acknowledgementUrgency(c.acknowledgement_due_at) === 'soon')
    return [
      { big: String(open.length), title: 'Åpne saker', sub: 'Krever oppfølging' },
      { big: String(overdue.length), title: 'Forfalt bekreftelse', sub: 'AML § 2 A-3 — innen rimelig tid' },
      { big: String(soon.length), title: 'Snart forfalt', sub: 'Innen 2 dager' },
      { big: String(wb.cases.filter((c) => c.status === 'closed').length), title: 'Avsluttet', sub: 'Med skriftlig konklusjon' },
    ]
  }, [wb.cases])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return wb.cases.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      )
    })
  }, [wb.cases, statusFilter, search])

  const submit = useCallback(async () => {
    if (!draft.title.trim() || !draft.description.trim()) return
    setSubmitting(true)
    const result = await wb.createCase({
      category: draft.category,
      title: draft.title,
      description: draft.description,
      whoWhatWhere: draft.whoWhatWhere,
      occurredAtText: draft.occurredAt,
      isAnonymous: draft.isAnonymous,
      reporterContact: draft.reporterContact,
      attachmentHints: [],
    })
    setSubmitting(false)
    if (result) {
      setCreatedAccessKey(result.accessKey)
      setDraft(emptyDraft())
      setCreateOpen(false)
    }
  }, [draft, wb])

  if (!wb.canAccessVault) {
    return (
      <ModuleSectionCard className="p-6">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 text-neutral-500" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Begrenset tilgang</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Innholdet i varslingsmottaket er kun tilgjengelig for varslingskomiteen og
              administratorer (AML § 2 A-4 og personopplysningsloven). Ta kontakt med admin
              dersom du trenger tilgang.
            </p>
          </div>
        </div>
      </ModuleSectionCard>
    )
  }

  return (
    <div className="space-y-4">
      <LayoutScoreStatRow items={stats} columns={4} />

      {wb.error ? <WarningBox>{wb.error}</WarningBox> : null}

      {createdAccessKey ? (
        <InfoBox>
          Saken er opprettet. Tilgangsnøkkel: <code className="rounded bg-neutral-100 px-1">{createdAccessKey}</code>
          {' '}— gi denne til varsleren slik at hen kan følge saken på <code>/varsle/status</code>.
          <button
            type="button"
            onClick={() => setCreatedAccessKey(null)}
            className="ml-2 text-xs font-medium underline"
          >
            Lukk
          </button>
        </InfoBox>
      ) : null}

      <ModuleSectionCard className="p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold text-neutral-800">Varslingsmottak</h3>
          <div className="flex flex-wrap items-center gap-2">
            <StandardInput
              type="search"
              placeholder="Søk i tittel, kategori, beskrivelse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-72"
            />
            <div className="w-full md:w-48">
              <SearchableSelect
                value={statusFilter}
                options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(v) => setStatusFilter(v as WhistleblowingCaseStatus | 'all')}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Ny sak
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={MODULE_TABLE_TH}>Tittel</th>
                <th className={MODULE_TABLE_TH}>Kategori</th>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH}>Mottatt</th>
                <th className={MODULE_TABLE_TH}>Bekreftelse innen</th>
                <th className={MODULE_TABLE_TH}>Anonym</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border-t border-neutral-100 px-3 py-10 text-center text-sm text-neutral-500">
                    {wb.loading ? 'Laster saker…' : 'Ingen saker matcher filteret.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const urgency = acknowledgementUrgency(c.acknowledgement_due_at)
                  return (
                    <tr key={c.id} className={MODULE_TABLE_TR_BODY}>
                      <td className={MODULE_TABLE_TD}>
                        <p className="font-medium text-neutral-900">{c.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{c.description}</p>
                      </td>
                      <td className={MODULE_TABLE_TD}>
                        {WHISTLE_CATEGORY_OPTIONS.find((o) => o.value === c.category)?.label ?? c.category}
                      </td>
                      <td className={MODULE_TABLE_TD}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={statusBadgeVariant(c.status)}>{STATUS_LABELS[c.status]}</Badge>
                          <select
                            aria-label="Endre status"
                            value={c.status}
                            onChange={(e) => void wb.updateStatus(c.id, e.target.value as WhistleblowingCaseStatus)}
                            className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-xs"
                          >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className={MODULE_TABLE_TD}>{formatDate(c.received_at)}</td>
                      <td className={MODULE_TABLE_TD}>
                        <span
                          className={
                            urgency === 'overdue'
                              ? 'inline-flex items-center gap-1 font-semibold text-red-600'
                              : urgency === 'soon'
                                ? 'font-semibold text-amber-700'
                                : ''
                          }
                        >
                          {urgency === 'overdue' ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
                          {formatDate(c.acknowledgement_due_at)}
                        </span>
                      </td>
                      <td className={MODULE_TABLE_TD}>
                        {c.is_anonymous ? <Badge variant="info">Anonym</Badge> : <span className="text-xs text-neutral-500">Identifisert</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </ModuleSectionCard>

      <SlidePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ny varslingssak"
        titleId="varsling-create"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => void submit()}
              disabled={submitting || !draft.title.trim() || !draft.description.trim()}
            >
              {submitting ? 'Sender…' : 'Opprett'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Kategori</span>
            <SearchableSelect
              value={draft.category}
              options={WHISTLE_CATEGORY_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vw-title">
              Tittel <span className="text-red-500">*</span>
            </label>
            <StandardInput
              id="vw-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Kort beskrivelse"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vw-desc">
              Hva har skjedd? <span className="text-red-500">*</span>
            </label>
            <StandardTextarea
              id="vw-desc"
              rows={5}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vw-www">
              Hvem / hvor / når
            </label>
            <StandardTextarea
              id="vw-www"
              rows={2}
              value={draft.whoWhatWhere}
              onChange={(e) => setDraft((d) => ({ ...d, whoWhatWhere: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vw-occurred">
                Tidspunkt
              </label>
              <StandardInput
                id="vw-occurred"
                value={draft.occurredAt}
                onChange={(e) => setDraft((d) => ({ ...d, occurredAt: e.target.value }))}
                placeholder="F.eks. mars 2026"
              />
            </div>
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Anonym</span>
              <YesNoToggle value={draft.isAnonymous} onChange={(v) => setDraft((d) => ({ ...d, isAnonymous: v }))} />
            </div>
          </div>
          {!draft.isAnonymous ? (
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vw-contact">
                Kontaktinformasjon
              </label>
              <StandardInput
                id="vw-contact"
                value={draft.reporterContact}
                onChange={(e) => setDraft((d) => ({ ...d, reporterContact: e.target.value }))}
                placeholder="E-post / telefon"
              />
            </div>
          ) : null}
        </div>
      </SlidePanel>
    </div>
  )
}

type Draft = {
  category: string
  title: string
  description: string
  whoWhatWhere: string
  occurredAt: string
  isAnonymous: boolean
  reporterContact: string
}

function emptyDraft(): Draft {
  return {
    category: WHISTLE_CATEGORY_OPTIONS[0]?.value ?? 'other',
    title: '',
    description: '',
    whoWhatWhere: '',
    occurredAt: '',
    isAnonymous: true,
    reporterContact: '',
  }
}
