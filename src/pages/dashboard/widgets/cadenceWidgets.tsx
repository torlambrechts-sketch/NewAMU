// Cadence-konfigurasjons-widgets:
// - TimelineWidget: årshjul-svømmebaner pr HMS-kategori
// - TaskTemplateDetailWidget: dypdykk i én oppgavemal
// - DelegationRulesWidget: regler for ferieavløsning, lederbytte, habilitet
// - GovernanceModelWidget: 3-prinsipp + modenhetstrappen
//
// Alle leser fra useDashboardData() — fall back på sensible defaults når
// cadence-planen er tom.

import { useMemo, useState } from 'react'
import { ClipboardCheck, Users } from 'lucide-react'
import {
  cadenceHintToTimeline,
  useDashboardData,
  type DashboardPlanModuleRow,
} from '../useDashboardData'
import { Button } from '../../../components/ui/Button'
import { Avatar, Chip, EmptyState, KpiStrip, LawRef, WidgetCard } from './widgetShared'

const MONTHS_NB = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

// ── Timeline ────────────────────────────────────────────────────────────────

const FALLBACK_TIMELINE_GROUPS = [
  { group_label: 'A · Systematisk HMS', law: 'IK § 5', items: ['Mål & policy', 'Risikoanalyse', 'Systemrevisjon'] },
  { group_label: 'B · Vernetjeneste & AMU', law: 'FOR-1355 § 3-16', items: ['AMU Q1', 'AMU Q2', 'AMU Q3', 'AMU Q4'] },
  { group_label: 'C · Arbeidsmiljø — fysisk', law: 'AML § 3-1', items: ['Vernerunde Q1', 'Vernerunde Q2', 'Vernerunde Q3', 'Vernerunde Q4'] },
  { group_label: 'D · Psykososialt', law: 'AML § 4-3', items: ['STAMI vår', 'STAMI høst', 'Tiltaksplan'] },
  { group_label: 'E · BHT', law: 'BHT-forskriften', items: ['BHT-plan', 'Konsult', 'Konsult', 'BHT-rapport'] },
  { group_label: 'F · Sykefravær', law: 'AML § 4-6', items: ['Oppfølging'] },
  { group_label: 'G · Drøftingsplikt', law: 'AML § 8-2', items: ['Drøfting'] },
]

export function TimelineWidget() {
  const data = useDashboardData()

  const grouped = useMemo(() => {
    if (data.modules.length === 0) {
      return FALLBACK_TIMELINE_GROUPS.map((g) => ({
        group_label: g.group_label,
        law_refs: [g.law],
        sub: `${g.items.length} hendelser/år`,
        modules: g.items.map((label, i) => ({
          module_id: `__fallback_${g.group_label}_${i}`,
          name: label,
          group_label: g.group_label,
          tier: 'recommended' as const,
          law_refs: [g.law],
          volume: 1,
          frequency: g.items.length === 4 ? 'Kvartalsvis' : g.items.length === 2 ? 'Halvårlig' : 'Årlig',
          cadence_hint: g.items.length === 4 ? 'kvartalsvis' : g.items.length === 2 ? 'halvarlig' : 'arlig',
          description: null,
        }) as DashboardPlanModuleRow),
      }))
    }
    const m = new Map<string, DashboardPlanModuleRow[]>()
    for (const mod of data.modules) {
      const key = mod.group_label ?? 'Annet'
      const arr = m.get(key) ?? []
      arr.push(mod)
      m.set(key, arr)
    }
    return Array.from(m.entries()).map(([group_label, mods]) => ({
      group_label,
      law_refs: Array.from(new Set(mods.flatMap((mm) => mm.law_refs).filter(Boolean))).slice(0, 3),
      sub: `${mods.length} modul${mods.length === 1 ? '' : 'er'} · ${mods.reduce((s, mm) => s + mm.volume, 0)} hendelser/år`,
      modules: mods,
    }))
  }, [data.modules])

  const isFallback = data.modules.length === 0

  return (
    <WidgetCard
      title="Tidslinje for året"
      subtitle={isFallback ? 'Forhåndsforslag (ingen cadence iverksatt ennå)' : `${data.plan?.name ?? 'Aktiv plan'} · ${data.plan?.snapshot_headcount ?? '?'} ansatte`}
      rightSlot={<Chip tone="paper">Mai = nå</Chip>}
      bodyPad={false}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[220px_repeat(12,1fr)] border-b border-neutral-100 bg-neutral-50">
            <div className="border-r border-neutral-100 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
              Kategori
            </div>
            {MONTHS_NB.map((m, i) => (
              <div
                key={m}
                className={`border-r border-neutral-100 px-2 py-2.5 text-center text-[11px] font-semibold ${i === 4 ? 'bg-[#0A1628] text-white' : 'text-neutral-700'}`}
              >
                {m}
              </div>
            ))}
          </div>
          {grouped.map((g) => (
            <div key={g.group_label} className="grid grid-cols-[220px_1fr] border-b border-neutral-100 last:border-b-0">
              <div className="border-r border-neutral-100 bg-neutral-50 px-4 py-3">
                <div className="font-serif text-[13.5px] font-medium leading-tight">{g.group_label}</div>
                <div className="mt-0.5 text-[10.5px] text-neutral-500">{g.sub}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {g.law_refs.map((law) => (
                    <LawRef key={law} code={law} />
                  ))}
                </div>
              </div>
              <div
                className="relative"
                style={{
                  background: 'repeating-linear-gradient(to right, transparent 0, transparent calc(8.333% - 1px), #EAE5DA calc(8.333% - 1px), #EAE5DA 8.333%)',
                  minHeight: 64,
                }}
              >
                {g.modules.flatMap((m) =>
                  cadenceHintToTimeline(m.cadence_hint).map((pos, idx) => (
                    <span
                      key={`${m.module_id}-${idx}`}
                      title={`${m.name} — ${m.frequency ?? m.cadence_hint ?? ''}`}
                      className={`absolute top-3 flex h-6 items-center rounded px-2 text-[10.5px] font-semibold text-white ${barColor(m.cadence_hint, m.tier)}`}
                      style={{ left: `${pos.leftPct}%`, width: `${Math.max(5, pos.widthPct)}%` }}
                    >
                      {pos.label}
                    </span>
                  )),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[11px] text-neutral-700">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#BA0C2F]" />AMU / lovkrav</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#142339]" />Repeterende kontroll</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#3F6B4F]" />Rapport</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#B8761F]" />Lovbestemt frist</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#5A2F6F]" />Psykososial</span>
      </div>
    </WidgetCard>
  )
}

function barColor(hint: string | null | undefined, tier: 'required' | 'recommended' | 'optional'): string {
  if (tier === 'required' && hint === 'kvartalsvis') return 'bg-[#BA0C2F]'
  if (hint === 'kvartalsvis') return 'bg-[#142339]'
  if (hint === 'halvarlig') return 'bg-[#5A2F6F]'
  if (hint === 'arlig') return 'bg-[#3F6B4F]'
  if (hint === 'manedlig' || hint === 'ukentlig') return 'bg-[#3B5BDB]'
  return 'bg-[#B8761F]'
}

// ── TaskTemplate detail ─────────────────────────────────────────────────────

export function TaskTemplateDetailWidget() {
  const data = useDashboardData()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const candidate = useMemo(() => {
    if (data.modules.length === 0) return null
    const picked = pickedId ? data.modules.find((m) => m.module_id === pickedId) : null
    return picked ?? data.modules[0]
  }, [data.modules, pickedId])

  if (!candidate) {
    return (
      <WidgetCard title="Oppgavemal — detalj" subtitle="Velg en cadence-modul">
        <EmptyState
          Icon={ClipboardCheck}
          title="Ingen cadence-moduler ennå"
          body="Iverksett en cadence-plan via /cadence-veiviseren for å se modulmaler her."
        />
      </WidgetCard>
    )
  }

  return (
    <div className="space-y-3">
      <WidgetCard
        title={candidate.name}
        subtitle={`Mal ${candidate.module_id} · ${candidate.group_label ?? 'Ukategorisert'}`}
        rightSlot={
          <div className="flex flex-wrap gap-1.5">
            {candidate.law_refs.slice(0, 3).map((law) => (
              <LawRef key={law} code={law} />
            ))}
          </div>
        }
      >
        <KpiStrip
          items={[
            { label: 'Foreslått frekvens', value: candidate.frequency ?? '—', sub: `Cadence: ${candidate.cadence_hint ?? 'ad_hoc'}` },
            { label: 'Forventet volum', value: candidate.volume, sub: 'oppgaver/år' },
            { label: 'Tier', value: candidate.tier, sub: candidate.tier === 'required' ? 'Lovpålagt' : candidate.tier === 'recommended' ? 'Anbefalt' : 'Valgfritt' },
            { label: 'Lov-mapping', value: candidate.law_refs.length, sub: 'paragrafer dekket', tone: 'dark' },
          ]}
        />
        {candidate.description ? (
          <p className="mt-4 text-[13px] leading-relaxed text-neutral-700">{candidate.description}</p>
        ) : null}
      </WidgetCard>

      <WidgetCard title="Påminnelser" subtitle="Varsler før og etter frist">
        <div className="space-y-2 text-[12.5px]">
          {[
            { when: '−14 d', label: 'Mykt varsel til ansvarlig', tone: 'success' as const },
            { when: '−7 d', label: 'Påminnelse + kopi til godkjenner', tone: 'success' as const },
            { when: '−1 d', label: 'Siste varsel', tone: 'warn' as const },
            { when: '+1 d', label: 'Eskalering starter (E01)', tone: 'danger' as const },
          ].map((r) => (
            <div key={r.when} className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-b-0">
              <span className="flex items-center gap-2">
                <code className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-700">{r.when}</code>
                <span>{r.label}</span>
              </span>
              <Chip tone={r.tone}>{r.tone === 'danger' ? 'Auto' : 'På'}</Chip>
            </div>
          ))}
        </div>
      </WidgetCard>

      {data.modules.length > 1 && (
        <WidgetCard title="Andre moduler" subtitle="Klikk for å bytte fokus">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {data.modules
              .filter((m) => m.module_id !== candidate.module_id)
              .slice(0, 8)
              .map((m) => (
                <Button
                  key={m.module_id}
                  variant="ghost"
                  type="button"
                  onClick={() => setPickedId(m.module_id)}
                  className="flex h-auto flex-col items-stretch rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left font-normal normal-case transition-colors hover:bg-neutral-100"
                >
                  <span className="block text-[12.5px] font-semibold text-neutral-900">{m.name}</span>
                  <span className="mt-0.5 block font-mono text-[10.5px] text-neutral-500">{m.module_id} · {m.frequency ?? m.cadence_hint}</span>
                </Button>
              ))}
          </div>
        </WidgetCard>
      )}
    </div>
  )
}

// ── Delegation rules ────────────────────────────────────────────────────────

const DELEGATION_RULES = [
  {
    title: 'Ferieavløsning',
    desc: 'Når noen registrerer fravær, omdirigeres oppgaver til oppgitt stedfortreder.',
    tag: 'Aktiv',
    tone: 'success' as const,
    flow: ['Person fraværende', 'Varighet ≥ 3 dager?', 'Søk fallback-kjede', 'Tildel første tilgjengelige'],
  },
  {
    title: 'Lovpålagt fast rolle (verneombud)',
    desc: 'Verneombud kan ikke omdirigeres til vilkårlig person — krav om gyldig kompetanse.',
    tag: 'Lovbestemt',
    tone: 'danger' as const,
    flow: ['Verneombud fraværende', 'Stedfortredende VO?', 'Eskaler til HVO', 'Logg & varsle AMU'],
    law: ['AML § 6-1', 'FOR-1355 § 3-1'],
  },
  {
    title: 'Lederbytte / rollendring',
    desc: 'Når en rolle får ny innehaver, overføres oppgaver med 7 dager overlapp.',
    tag: 'Aktiv',
    tone: 'success' as const,
    flow: ['Ny person i rolle', 'Overlappsperiode 7 d', 'Eksisterende oppgaver?', 'Migrér med varsel'],
  },
  {
    title: 'Overbelastning',
    desc: 'Hvis en person har > 5 åpne forfalte oppgaver, foreslår systemet omfordeling.',
    tag: 'Anbefalt',
    tone: 'warn' as const,
    flow: ['Ny oppgave', 'Mottaker har > 5 forfalte?', 'Foreslå alternativ', 'Be om bekreftelse'],
  },
  {
    title: 'Kompetansebasert ruting',
    desc: 'Maskinverning og elektrosjekk krever sertifisert kompetanse. Sjekker register før tildeling.',
    tag: 'Pilot',
    tone: 'info' as const,
    flow: ['Sertifiseringsoppgave', 'Mottaker kvalifisert?', 'Filtrer kandidater', 'Tildel + dokumenter'],
  },
  {
    title: 'Habilitet i varslingssaker',
    desc: 'Varslingsmottaker kan ikke behandle saker hen selv er involvert i. Omdirigeres automatisk.',
    tag: 'Lovbestemt',
    tone: 'danger' as const,
    flow: ['Varsel mottatt', 'Habilitetskonflikt?', 'Aktivér ekstern kanal', 'BHT eller advokat'],
    law: ['AML § 2A-3'],
  },
]

export function DelegationRulesWidget() {
  const data = useDashboardData()
  return (
    <div className="space-y-3">
      <WidgetCard title="Aktive regler" subtitle="Slik flyttes oppgaver når en rolle er fraværende eller endres">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {DELEGATION_RULES.map((r) => (
            <div key={r.title} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-serif text-[15px] font-medium leading-tight text-neutral-900">{r.title}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{r.desc}</p>
                </div>
                <Chip tone={r.tone}>{r.tag}</Chip>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-md bg-neutral-50 p-2.5 text-[11px]">
                {r.flow.map((node, idx) => (
                  <span key={idx} className="flex items-center gap-1.5">
                    <span className={`rounded border px-2 py-1 ${idx === 0 ? 'border-neutral-700 bg-neutral-900 text-white' : idx === r.flow.length - 1 ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-neutral-200 bg-white text-neutral-700'}`}>
                      {node}
                    </span>
                    {idx < r.flow.length - 1 ? <span className="font-mono text-neutral-300">→</span> : null}
                  </span>
                ))}
              </div>
              {r.law ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.law.map((l) => <LawRef key={l} code={l} />)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </WidgetCard>

      <WidgetCard title="Fallback-rangering på rollenivå" subtitle="Rekkefølge systemet følger når en rolle ikke kan utføre">
        {data.roles.length === 0 ? (
          <EmptyState
            Icon={Users}
            title="Ingen rolle-tildelinger ennå"
            body="Roller defineres i steg 4 av Cadence-veiviseren. Iverksett en plan for å se fallback-kjedene her."
          />
        ) : (
          <div className="space-y-2">
            {data.roles.map((r) => (
              <div key={r.role_key} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <span className="min-w-[200px] font-serif text-[14px] font-medium">{r.role_label}</span>
                <span className="text-neutral-300">→</span>
                {r.person_name ? <><Avatar name={r.person_name} userId={r.person_user_id ?? undefined} /><span className="text-[12.5px] font-medium">{r.person_name}</span></> : <Chip tone="warn">Ikke tildelt</Chip>}
                {r.fallback_name ? (
                  <>
                    <span className="text-neutral-300">→</span>
                    <Avatar name={r.fallback_name} userId={r.fallback_user_id ?? undefined} size="sm" />
                    <span className="text-[12px] text-neutral-500">{r.fallback_name} (fallback)</span>
                  </>
                ) : null}
                {r.law_ref ? <span className="ml-auto"><LawRef code={r.law_ref} /></span> : null}
              </div>
            ))}
          </div>
        )}
      </WidgetCard>
    </div>
  )
}

// ── Governance model ────────────────────────────────────────────────────────

export function GovernanceModelWidget() {
  const data = useDashboardData()
  const totalModules = data.modules.length
  const requiredModules = data.modules.filter((m) => m.tier === 'required').length
  const optionalModules = totalModules - requiredModules
  const rolesDefined = data.roles.length
  const tasksOpen = data.tasks.filter((t) => t.status !== 'closed' && t.status !== 'cancelled').length

  const maturity: 'D' | 'C' | 'B' | 'B+' | 'A' | 'A+' = useMemo(() => {
    if (totalModules === 0) return 'D'
    if (totalModules < 5) return 'C'
    if (data.plan?.status === 'active' && rolesDefined >= 5) return 'B+'
    if (data.plan?.status === 'active') return 'B'
    return 'C'
  }, [totalModules, rolesDefined, data.plan?.status])

  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: 'Aktive maler', value: totalModules, sub: `${requiredModules} lovpålagt · ${optionalModules} frivillig` },
          { label: 'Roller definert', value: rolesDefined, sub: `${data.profiles.size} personer i org` },
          { label: 'Oppgaver i kø', value: tasksOpen, sub: 'ikke lukket' },
          { label: 'Modenhet', value: maturity, sub: maturityLabel(maturity), tone: 'dark' },
        ]}
      />

      <WidgetCard title="De tre prinsippene" subtitle="Styringsfilosofien dashboardet bygger på">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { num: 'PRINSIPP 01', title: 'Loven er gulvet.', body: 'Arbeidsmiljøloven og forskriftene definerer minstekadens. Du kan stramme inn — aldri løsne. Når lovkravene strammes, strammes ditt minimum automatisk.', laws: ['AML § 1-9', 'IK § 5'], topBar: 'bg-[#BA0C2F]' },
            { num: 'PRINSIPP 02', title: 'Roller bærer ansvar — personer utfører.', body: 'Verneombudet er en rolle, ikke en person. Når innehaveren skifter, fortsetter rollen. Det gir kontinuitet og overlevelse av kompetanse.', laws: ['AML § 6-1', 'FOR-1355 § 3-1'], topBar: 'bg-[#3B5BDB]' },
            { num: 'PRINSIPP 03', title: 'Alt etterlater spor.', body: 'Hver endring i cadence, tildeling, og signering lagres uforanderlig i 7 år. Et levende dokument som kan vises Arbeidstilsynet på 12 sekunder.', laws: ['IK § 5 nr. 4-8', 'GDPR art. 30'], topBar: 'bg-[#3F6B4F]' },
          ].map((p) => (
            <div key={p.num} className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-5">
              <span className={`absolute left-0 top-0 h-1 w-full ${p.topBar}`} aria-hidden />
              <div className="font-mono text-[10.5px] tracking-wider text-neutral-500">{p.num}</div>
              <div className="mt-1.5 font-serif text-[17px] font-medium leading-tight">{p.title}</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-500">{p.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
                {p.laws.map((l) => <LawRef key={l} code={l} />)}
              </div>
            </div>
          ))}
        </div>
      </WidgetCard>

      <WidgetCard title="Modenhetstrappen" subtitle="Hvor moden er HMS-styringen?">
        <div className="space-y-2">
          {[
            { code: 'D', label: 'Reaktiv', body: 'Brannslukking. Oppgaver gjøres når noen ringer fra Arbeidstilsynet.', tone: 'rust' as const, bar: 'border-[#A03826] bg-[#F0D9D2]', text: 'text-[#A03826]' },
            { code: 'C', label: 'Lovlydig', body: 'Minstekrav følges, mest manuelt. AMU møtes 4× per år.', tone: 'amber' as const, bar: 'border-[#B8761F] bg-[#F4E8D2]', text: 'text-[#B8761F]' },
            { code: 'B+', label: 'Systematisert', body: 'Cadence og styring er digital. Auto-tildeling. Eskalering fanger svikt.', tone: 'moss' as const, bar: 'border-[#3F6B4F] bg-[#E4ECDF]', text: 'text-[#3F6B4F]', highlight: true },
            { code: 'A', label: 'Lærende', body: 'Cadence justeres basert på data. Systemet foreslår endringer.', tone: 'accent' as const, bar: 'border-[#3B5BDB] bg-[#E1E7F7]', text: 'text-[#1F3A99]' },
            { code: 'A+', label: 'Bransjeledende · ISO 45001-klar', body: 'Hele systemet kan revideres mot ISO 45001 uten endring.', tone: 'ink' as const, bar: 'border-neutral-700 bg-neutral-100', text: 'text-neutral-700' },
          ].map((s) => (
            <div
              key={s.code}
              className={`flex items-center gap-4 rounded-lg border-l-4 px-4 py-3 ${s.bar} ${s.code === maturity ? 'ring-2 ring-[#3F6B4F]/40' : ''}`}
            >
              <div className={`w-12 text-center font-serif text-2xl font-medium ${s.text}`}>{s.code}</div>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-[15px] font-medium">{s.label}</div>
                <div className="mt-0.5 text-[12px] text-neutral-500">{s.body}</div>
              </div>
              {s.code === maturity ? <Chip tone="norge">Dere er her</Chip> : null}
            </div>
          ))}
        </div>
      </WidgetCard>

      <WidgetCard title="Hva skiller dette fra et Excel-ark" subtitle="">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { num: '01', title: 'Loven holder seg oppdatert selv', body: 'Når AML endres får ditt minimum nye krav samme dag. Du varsles og maler tilpasses.', color: 'text-[#BA0C2F]' },
            { num: '02', title: 'Mennesker forsvinner — roller består', body: 'Når en rolle bytter innehaver omdirigeres oppgaver automatisk via fallback-kjeden.', color: 'text-[#3B5BDB]' },
            { num: '03', title: 'Sporet kan ikke endres i etterkant', body: 'Hver hendelse hashes. Når noe må forklares er fortellingen vanntett.', color: 'text-[#3F6B4F]' },
          ].map((p) => (
            <div key={p.num} className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
              <div className={`font-serif text-4xl font-light tracking-tight leading-none ${p.color}`}>{p.num}</div>
              <div className="mt-2 font-serif text-[15px] font-medium">{p.title}</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-500">{p.body}</p>
            </div>
          ))}
        </div>
      </WidgetCard>
    </div>
  )
}

function maturityLabel(m: 'D' | 'C' | 'B' | 'B+' | 'A' | 'A+'): string {
  switch (m) {
    case 'D': return 'Reaktiv'
    case 'C': return 'Lovlydig'
    case 'B': return 'Bygger system'
    case 'B+': return 'Systematisert'
    case 'A': return 'Lærende'
    case 'A+': return 'Bransjeledende'
  }
}

