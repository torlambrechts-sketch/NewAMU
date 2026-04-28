import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
} from '../components/layout/WorkplaceStandardFormPanel'
import { ModulePageShell } from '../components/module'
import { WarningBox } from '../components/ui/AlertBox'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect'
import { StandardTextarea } from '../components/ui/Textarea'
import { YesNoToggle } from '../components/ui/FormToggles'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useSurvey } from '../../modules/survey'
import {
  TEMPLATE_CATEGORIES,
  type CatalogQuestionType,
  type CatalogTemplateQuestion,
} from '../../modules/survey/surveyTemplateCatalogTypes'

const CATALOG_TYPE_OPTIONS: { value: CatalogQuestionType; label: string }[] = [
  { value: 'text', label: 'Fritekst' },
  { value: 'likert_5', label: 'Likert 1–5' },
  { value: 'likert_7', label: 'Likert 1–7' },
  { value: 'scale_10', label: 'Skala 0–10' },
  { value: 'yes_no', label: 'Ja / nei' },
  { value: 'single_select', label: 'Enkeltvalg' },
  { value: 'multi_select', label: 'Flervalg (flere)' },
  { value: 'multiple_choice', label: 'Flervalg (knapper)' },
]

function newQuestion(): CatalogTemplateQuestion {
  return {
    id:
      typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `q-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    text: '',
    type: 'likert_5',
    required: true,
  }
}

export function SurveyOrgTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const [searchParams] = useSearchParams()
  const fromId = searchParams.get('from')
  const navigate = useNavigate()
  const { can, isAdmin, supabase } = useOrgSetupContext()
  const canManage = isAdmin || can('survey.manage')

  const hook = useSurvey({ supabase })

  const isNew = templateId === 'new'

  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('custom')
  const [audience, setAudience] = useState<'internal' | 'external' | 'both'>('internal')
  const [questions, setQuestions] = useState<CatalogTemplateQuestion[]>([])
  const [saving, setSaving] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    void hook.loadTemplateCatalog()
  }, [hook.loadTemplateCatalog])

  const categoryOptions: SelectOption[] = useMemo(
    () => TEMPLATE_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
    [],
  )

  const audienceOptions: SelectOption[] = useMemo(
    () => [
      { value: 'internal', label: 'Ansatte' },
      { value: 'external', label: 'Leverandør' },
      { value: 'both', label: 'Begge' },
    ],
    [],
  )

  const typeSelectOptions: SelectOption[] = useMemo(
    () => CATALOG_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  )

  useEffect(() => {
    if (hook.templateCatalogLoading) return
    if (!templateId) {
      setInitError('Mangler mal-ID.')
      return
    }

    if (isNew) {
      if (fromId) {
        const src = hook.templateCatalog.find((t) => t.id === fromId)
        if (!src) {
          setInitError('Fant ikke malen som skulle kopieres.')
          return
        }
        setName(`${src.name} (kopi)`)
        setShortName(src.short_name ?? '')
        setDescription(src.description ?? '')
        setCategory(src.category)
        setAudience(src.audience)
        setQuestions(
          (src.body?.questions ?? []).map((q, index) => ({
            ...q,
            id:
              q.id ||
              (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
                ? globalThis.crypto.randomUUID()
                : `q-${Date.now()}-${index}`),
          })),
        )
      }
      setInitError(null)
      return
    }

    const t = hook.templateCatalog.find((x) => x.id === templateId)
    if (!t) {
      setInitError('Fant ikke malen. Oppdater siden eller gå tilbake til Maler.')
      return
    }
    if (t.is_system) {
      setInitError('system')
      return
    }
    setName(t.name)
    setShortName(t.short_name ?? '')
    setDescription(t.description ?? '')
    setCategory(t.category)
    setAudience(t.audience)
    setQuestions([...(t.body?.questions ?? [])])
    setInitError(null)
  }, [hook.templateCatalog, hook.templateCatalogLoading, templateId, isNew, fromId])

  const moveQuestion = useCallback((index: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]!
      next[index] = next[j]!
      next[j] = tmp
      return next
    })
  }, [])

  const updateQuestion = useCallback((index: number, patch: Partial<CatalogTemplateQuestion>) => {
    setQuestions((prev) => {
      const next = [...prev]
      const cur = next[index]
      if (!cur) return prev
      next[index] = { ...cur, ...patch } as CatalogTemplateQuestion
      return next
    })
  }, [])

  const removeQuestion = useCallback((index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSave = useCallback(async () => {
    if (!name.trim() || questions.length === 0) return
    const validQs = questions.filter((q) => q.text.trim())
    if (validQs.length === 0) return
    setSaving(true)
    const body = { version: 1 as const, questions: validQs }
    const row = await hook.saveOrgTemplate({
      id: isNew ? undefined : templateId,
      name: name.trim(),
      shortName: shortName.trim() || null,
      description: description.trim() || null,
      category,
      audience,
      body,
    })
    setSaving(false)
    if (row) {
      navigate('/survey?tab=maler')
    }
  }, [name, shortName, description, category, audience, questions, isNew, templateId, hook, navigate])

  const handleDelete = useCallback(async () => {
    if (isNew || !templateId) return
    if (typeof window !== 'undefined' && !window.confirm('Slette denne organisasjonsmalen permanent?')) return
    await hook.deleteOrgTemplate(templateId)
    navigate('/survey?tab=maler')
  }, [isNew, templateId, hook, navigate])

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Undersøkelser', to: '/survey' },
          { label: 'Mal' },
        ]}
        title="Rediger mal"
        description="Organisasjonsmaler for undersøkelser."
      >
        <WarningBox>Du har ikke tilgang. Krever «survey.manage» eller administrator.</WarningBox>
      </ModulePageShell>
    )
  }

  if (initError === 'system') {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Undersøkelser', to: '/survey' },
          { label: 'Mal' },
        ]}
        title="Systemmal"
        description="Systemmaler kan ikke endres direkte."
        headerActions={
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey?tab=maler')}>
            <ArrowLeft className="h-4 w-4" />
            Til Maler
          </Button>
        }
      >
        <WarningBox>
          Denne malen er en systemmal. Opprett en kopi under Maler ved å velge «Ny mal fra …» eller bruk «Bruk mal» og
          lagre som egen mal fra byggeren.
        </WarningBox>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={() => navigate(`/survey/templates/org/new?from=${encodeURIComponent(templateId!)}`)}>
            Ny mal basert på denne
          </Button>
        </div>
      </ModulePageShell>
    )
  }

  if (initError) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Undersøkelser', to: '/survey' },
          { label: 'Mal' },
        ]}
        title="Mal"
        description="Organisasjonsmal for undersøkelser."
        headerActions={
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey?tab=maler')}>
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Button>
        }
      >
        <WarningBox>{initError}</WarningBox>
      </ModulePageShell>
    )
  }

  const needsOptions = (t: CatalogQuestionType) =>
    t === 'single_select' || t === 'multi_select' || t === 'multiple_choice'

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Undersøkelser', to: '/survey' },
        { label: 'Maler', to: '/survey?tab=maler' },
        { label: isNew ? 'Ny mal' : 'Rediger mal' },
      ]}
      title={isNew ? 'Ny organisasjonsmal' : 'Rediger organisasjonsmal'}
      description="Spørsmålene lagres i malbiblioteket og kan brukes når dere oppretter nye undersøkelser."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey?tab=maler')}>
            <ArrowLeft className="h-4 w-4" />
            Avbryt
          </Button>
          {!isNew && templateId ? (
            <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDelete()}>
              <Trash2 className="h-4 w-4" />
              Slett mal
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={saving || !name.trim() || questions.filter((q) => q.text.trim()).length === 0}
            onClick={() => void handleSave()}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Lagrer…' : 'Lagre mal'}
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {hook.error ? <WarningBox>{hook.error}</WarningBox> : null}

        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="tpl-name">
              Navn <span className="text-red-500">*</span>
            </label>
            <StandardInput id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Årlig trivselsundersøkelse" />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="tpl-short">
              Kortnavn (valgfritt)
            </label>
            <StandardInput id="tpl-short" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="Vises som forkortelse i lister" />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="tpl-desc">
              Beskrivelse
            </label>
            <StandardTextarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="tpl-cat">
                Kategori
              </label>
              <SearchableSelect value={category} options={categoryOptions} onChange={setCategory} />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="tpl-aud">
                Målgruppe
              </label>
              <SearchableSelect
                value={audience}
                options={audienceOptions}
                onChange={(v) => setAudience(v as 'internal' | 'external' | 'both')}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Spørsmål</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setQuestions((p) => [...p, newQuestion()])}
            >
              <Plus className="h-4 w-4" />
              Legg til spørsmål
            </Button>
          </div>
          {questions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/80 p-6 text-sm text-neutral-600">
              Ingen spørsmål ennå. Klikk «Legg til spørsmål» eller åpne en kopi av en eksisterende mal.
            </p>
          ) : (
            <ul className="space-y-4">
              {questions.map((q, index) => (
                <li key={q.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-500">Spørsmål {index + 1}</span>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Flytt opp"
                        disabled={index === 0}
                        onClick={() => moveQuestion(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Flytt ned"
                        disabled={index >= questions.length - 1}
                        onClick={() => moveQuestion(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="text-red-600" aria-label="Fjern" onClick={() => removeQuestion(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`q-type-${q.id}`}>
                        Type
                      </label>
                      <SearchableSelect
                        value={q.type}
                        options={typeSelectOptions}
                        onChange={(v) => updateQuestion(index, { type: v as CatalogQuestionType })}
                      />
                    </div>
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`q-text-${q.id}`}>
                        Tekst <span className="text-red-500">*</span>
                      </label>
                      <StandardTextarea
                        id={`q-text-${q.id}`}
                        value={q.text}
                        onChange={(e) => updateQuestion(index, { text: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div>
                      <span className={WPSTD_FORM_FIELD_LABEL}>Obligatorisk</span>
                      <div className="mt-2 max-w-xs">
                        <YesNoToggle value={q.required} onChange={(v) => updateQuestion(index, { required: v })} />
                      </div>
                    </div>
                    {needsOptions(q.type) ? (
                      <div>
                        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`q-opt-${q.id}`}>
                          Alternativer (ett per linje)
                        </label>
                        <StandardTextarea
                          id={`q-opt-${q.id}`}
                          value={(q.options ?? []).join('\n')}
                          onChange={(e) => {
                            const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean)
                            updateQuestion(index, { options: lines.length > 0 ? lines : undefined })
                          }}
                          rows={4}
                          placeholder={'Alternativ 1\nAlternativ 2'}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModulePageShell>
  )
}
