import { Button } from '../../../src/components/ui/Button'
import { ALL_SURVEY_TEMPLATES } from '../../../src/data/surveyTemplates'

type Props = {
  onUseTemplate: (templateId: string) => void
  canManage: boolean
}

type ExternalTemplate = {
  id: string
  icon: string
  name: string
  badge?: string
  desc: string
  meta: string[]
  recommended?: boolean
  law?: string
}

const EXTERNAL_TEMPLATES: ExternalTemplate[] = [
  {
    id: 'ext-hms-egenerklaring',
    icon: 'HE',
    name: 'HMS-egenerklæring',
    badge: 'Leverandørkrav',
    desc: 'Standardisert egenerklæring leverandører fyller ut årlig. Dokumenterer at de oppfyller HMS-krav, har internkontroll, opplæring og forsikring.',
    meta: ['14 spm.', 'Sikker lenke', 'Filopplasting'],
    law: 'IK-forskriften § 5',
  },
  {
    id: 'ext-underentreprenor',
    icon: 'UL',
    name: 'Underentreprenør · byggeplass',
    badge: 'SHA-plan + ID-kort',
    desc: 'Spørreskjema før oppstart på byggeplass. SHA-plan, ID-kort, lønns- og arbeidsvilkår, allmenngjøring.',
    meta: ['22 spm.', 'Filopplasting'],
    law: 'Byggherreforskriften',
  },
  {
    id: 'ext-apenhetsloven',
    icon: 'RE',
    name: 'Etiske retningslinjer',
    badge: 'Åpenhetsloven § 4–6',
    desc: 'Bekreftelse av etiske retningslinjer, menneskerettigheter og anstendige arbeidsforhold hos leverandør.',
    meta: ['10 spm.', 'Signering'],
    law: 'Åpenhetsloven § 4',
  },
]

const VALIDATED_INTERNAL = ALL_SURVEY_TEMPLATES.filter((t) =>
  ['wellbeing', 'engagement', 'safety'].includes(t.category),
)
const SPECIAL_INTERNAL = ALL_SURVEY_TEMPLATES.filter((t) =>
  t.category === 'performance' || t.category === 'custom',
)

export function SurveyMalerTab({ onUseTemplate, canManage }: Props) {
  return (
    <div className="space-y-6">
      <SectionHeading
        label="Validerte ansattundersøkelser"
        description="Vitenskapelig dokumenterte instrumenter — anbefalt for systematisk kartlegging"
      />
      <TemplateGrid>
        {VALIDATED_INTERNAL.map((t) => (
          <TemplateCard
            key={t.id}
            icon={t.shortName.slice(0, 2).toUpperCase()}
            name={t.name}
            badge={t.source}
            desc={t.description}
            meta={[`${t.questions.length} spm.`, `~${t.estimatedMinutes} min`]}
            recommended={t.id === 'tpl-uwes' || t.id === 'tpl-qps-nordic'}
            canManage={canManage}
            onUse={() => onUseTemplate(t.id)}
          />
        ))}
        {/* QPS Nordic — always shown first even if not in imported list */}
        <QpsNordicCard canManage={canManage} onUse={() => onUseTemplate('tpl-qps-nordic')} />
        <ArkCard canManage={canManage} onUse={() => onUseTemplate('tpl-ark')} />
        <PulseCard canManage={canManage} onUse={() => onUseTemplate('tpl-pulse')} />
      </TemplateGrid>

      {SPECIAL_INTERNAL.length > 0 && (
        <>
          <SectionHeading label="Spesielle ansattundersøkelser" />
          <TemplateGrid>
            {SPECIAL_INTERNAL.map((t) => (
              <TemplateCard
                key={t.id}
                icon={t.shortName.slice(0, 2).toUpperCase()}
                name={t.name}
                badge={t.useCase}
                desc={t.description}
                meta={[`${t.questions.length} spm.`, `~${t.estimatedMinutes} min`]}
                canManage={canManage}
                onUse={() => onUseTemplate(t.id)}
              />
            ))}
            <MobbingCard canManage={canManage} onUse={() => onUseTemplate('tpl-mobbing')} />
            <ExitCard canManage={canManage} onUse={() => onUseTemplate('tpl-exit')} />
            <OnboardingCard canManage={canManage} onUse={() => onUseTemplate('tpl-onboarding')} />
          </TemplateGrid>
        </>
      )}

      <SectionHeading
        label="Leverandør & underleverandører"
        badge="Åpenhetsloven"
      />
      <TemplateGrid>
        {EXTERNAL_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            icon={t.icon}
            name={t.name}
            badge={t.badge}
            desc={t.desc}
            meta={t.meta}
            law={t.law}
            variant="external"
            canManage={canManage}
            onUse={() => onUseTemplate(t.id)}
          />
        ))}
      </TemplateGrid>
    </div>
  )
}

function SectionHeading({ label, description, badge }: { label: string; description?: string; badge?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</h2>
      {badge && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          {badge}
        </span>
      )}
      {description && <span className="text-xs text-neutral-400">{description}</span>}
    </div>
  )
}

function TemplateGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

type CardProps = {
  icon: string
  name: string
  badge?: string
  desc: string
  meta: string[]
  recommended?: boolean
  law?: string
  variant?: 'default' | 'external'
  canManage: boolean
  onUse: () => void
}

function TemplateCard({ icon, name, badge, desc, meta, recommended, law, variant = 'default', canManage, onUse }: CardProps) {
  const iconBg = variant === 'external'
    ? 'bg-amber-50 text-amber-700'
    : 'bg-[#e7efe9] text-[#1a3d32]'

  return (
    <div
      className={[
        'flex flex-col gap-3 rounded-xl border bg-white p-4 transition-all hover:-translate-y-px',
        recommended
          ? 'border-[#1a3d32] ring-2 ring-[#e7efe9]'
          : 'border-neutral-200 hover:border-neutral-300',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">{name}</p>
          {badge && <p className="text-xs text-neutral-500">{badge}</p>}
          {recommended && (
            <p className="text-xs font-semibold text-[#1a3d32]">⭐ Anbefalt</p>
          )}
        </div>
      </div>

      <p className="flex-1 text-xs leading-relaxed text-neutral-600">{desc}</p>

      <div className="flex flex-wrap gap-1.5">
        {meta.map((m) => (
          <span key={m} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
            {m}
          </span>
        ))}
        {law && (
          <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-medium text-[#1a3d32]">
            {law}
          </span>
        )}
      </div>

      {canManage && (
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="primary" size="sm" onClick={onUse}>
            Bruk mal
          </Button>
        </div>
      )}
    </div>
  )
}

function QpsNordicCard({ canManage, onUse }: { canManage: boolean; onUse: () => void }) {
  return (
    <TemplateCard
      icon="QN"
      name="QPS Nordic 34+"
      badge="Bredt brukt i Norden"
      desc="Validert spørreskjema for psykososialt arbeidsmiljø. Dekker jobbkrav, kontroll, sosialt klima, ledelse og forpliktelse. Benchmark-data tilgjengelig."
      meta={['34 spm.', '~7 min', 'Likert 1–5', 'Norsk · EN · PL']}
      recommended
      law="AML § 4-3"
      canManage={canManage}
      onUse={onUse}
    />
  )
}

function ArkCard({ canManage, onUse }: { canManage: boolean; onUse: () => void }) {
  return (
    <TemplateCard
      icon="AR"
      name="ARK Arbeidsmiljø"
      badge="NTNU · evidensbasert"
      desc="Bredt validert instrument for norsk arbeidsliv. Egnet som hovedmåling annethvert år. Inkluderer krav fra § 4-3."
      meta={['52 spm.', '~12 min', 'Likert 1–5']}
      law="AML § 4-3"
      canManage={canManage}
      onUse={onUse}
    />
  )
}

function PulseCard({ canManage, onUse }: { canManage: boolean; onUse: () => void }) {
  return (
    <TemplateCard
      icon="PU"
      name="Pulsmåling 4 spm."
      badge="Mellom hovedmålinger"
      desc="Korte, gjentakende målinger for å fange opp endringer. Anbefalt kvartalsvis mellom de store undersøkelsene."
      meta={['4 spm.', '~1 min', 'Anbefalt kvartalsvis']}
      canManage={canManage}
      onUse={onUse}
    />
  )
}

function MobbingCard({ canManage, onUse }: { canManage: boolean; onUse: () => void }) {
  return (
    <TemplateCard
      icon="MO"
      name="Mobbing & trakassering"
      badge="Fordypning ved røde flagg"
      desc="Brukes når hovedmålingen viser røde flagg. Inneholder spørsmål om opplevelse, hendelser og varsling. Absolutt anonymitet påkrevd."
      meta={['11 spm.', 'Absolutt anonymitet']}
      law="AML § 4-3 (3)"
      canManage={canManage}
      onUse={onUse}
    />
  )
}

function ExitCard({ canManage, onUse }: { canManage: boolean; onUse: () => void }) {
  return (
    <TemplateCard
      icon="SL"
      name="Sluttundersøkelse"
      badge="Trigger ved utmelding"
      desc="Sendes til ansatte som slutter. Kobles til avslutningsdato — gir ledelsen tilbakemelding på årsaker til frafall."
      meta={['9 spm.', 'Trigger ved oppsigelse']}
      canManage={canManage}
      onUse={onUse}
    />
  )
}

function OnboardingCard({ canManage, onUse }: { canManage: boolean; onUse: () => void }) {
  return (
    <TemplateCard
      icon="ON"
      name="Onboarding 30 dager"
      badge="Auto · 30 dg etter start"
      desc="Sendes 30 dager etter ansettelse. Måler opplevd opplæring, mottakelse og integrasjon i virksomheten."
      meta={['7 spm.', 'Automatisk utsending']}
      canManage={canManage}
      onUse={onUse}
    />
  )
}
