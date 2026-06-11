// Six stylised HTML/Tailwind compositions, one per product module.
// Used inside BrowserMockup or standalone in feature detail pages.
// No real data — purely a visual that signals what the module looks like.

import type { FeatureModuleSlug } from '../content/features'
import { CREAM, FOREST, FOREST_DEEP, TEAL } from '../theme'

type Props = { slug: FeatureModuleSlug }

export function ModuleMockup({ slug }: Props) {
  switch (slug) {
    case 'oppgaver':
      return <OppgaverMockup />
    case 'sjekklister':
      return <SjekklisterMockup />
    case 'varslinger':
      return <VarslingerMockup />
    case 'dokumenter':
      return <DokumenterMockup />
    case 'laering':
      return <LaeringMockup />
    case 'undersokelser':
      return <UndersokelserMockup />
  }
}

function OppgaverMockup() {
  const tasks = [
    { source: 'Sjekkliste', kind: 'sjekk', title: 'Rette mangel på branndør B2', who: 'NK', due: 'I dag', tone: '#ef4444' },
    { source: 'Varsling', kind: 'varsl', title: 'Følge opp #VAR-2025-014', who: 'AR', due: 'I morgen', tone: '#a855f7' },
    { source: 'ROS', kind: 'ros', title: 'Risikoanalyse kjemikalielager', who: 'LH', due: '3 dager', tone: '#f97316' },
    { source: 'AMU', kind: 'amu', title: 'Innkjøp ergonomistoler avd. Drift', who: 'VB', due: '5 dager', tone: '#22c55e' },
    { source: 'Sykefravær', kind: 'sf', title: 'Dialogmøte 1 — uke 7', who: 'AR', due: '8 dager', tone: '#3b82f6' },
  ]
  return (
    <div className="grid grid-cols-5" style={{ background: FOREST_DEEP }}>
      <div className="col-span-1 space-y-1 border-r p-3" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0d2a1c' }}>
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>Innboks</p>
        {['Alle (24)', 'Mine (8)', 'Kritisk (2)', 'Forsinket (4)'].map((l, i) => (
          <div key={l} className={`rounded px-2 py-1.5 text-xs ${i === 0 ? 'font-semibold' : ''}`}
            style={i === 0 ? { background: 'rgba(45,212,191,0.15)', color: TEAL } : { color: 'rgba(255,255,255,0.5)' }}>
            {l}
          </div>
        ))}
      </div>
      <div className="col-span-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Tverrgående innboks</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(45,212,191,0.15)', color: TEAL }}>
            24 åpne
          </span>
        </div>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.title} className="flex items-center gap-3 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: `${t.tone}22`, color: t.tone }}>
                {t.source}
              </span>
              <span className="flex-1 truncate text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>{t.title}</span>
              <span className="flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: t.tone }}>
                {t.who}
              </span>
              <span className="w-16 text-right text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.due}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SjekklisterMockup() {
  const findings = [
    { name: 'Branndør B2 — selvlukker virker ikke', sev: 'Høy', score: '15', tone: '#ef4444' },
    { name: 'Manglende verneutstyr sveiseplass', sev: 'Kritisk', score: '20', tone: '#b3382a' },
    { name: 'Førstehjelpsskap mangler plaster', sev: 'Lav', score: '4', tone: '#22c55e' },
    { name: 'Nødskilt mangler i lager øst', sev: 'Middels', score: '9', tone: '#f97316' },
  ]
  return (
    <div className="p-4" style={{ background: CREAM }}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Vernerunde — Q1 2026</p>
          <h3 className="text-sm font-bold" style={{ color: FOREST }}>Lokasjon: Oslo Hovedkontor</h3>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: FOREST, color: 'white' }}>
          Signert
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Risikomatrise</p>
          <div className="mt-2 grid grid-cols-5 gap-0.5">
            {Array.from({ length: 25 }).map((_, i) => {
              const row = Math.floor(i / 5)
              const col = i % 5
              const score = (row + 1) * (col + 1)
              const c = score >= 15 ? '#ef4444' : score >= 8 ? '#f97316' : score >= 4 ? '#fbbf24' : '#22c55e'
              const active = [2, 8, 14, 19].includes(i)
              return <div key={i} className="aspect-square rounded-sm" style={{ background: c, opacity: active ? 1 : 0.25 }} />
            })}
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-neutral-500">
            <span>Lav</span><span>Sannsynlighet × Konsekvens</span><span>Kritisk</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {findings.map((f) => (
            <div key={f.name} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
              <span className="flex size-7 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: f.tone }}>
                {f.score}
              </span>
              <div className="flex-1 truncate">
                <p className="truncate text-xs font-medium" style={{ color: FOREST }}>{f.name}</p>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: f.tone }}>{f.sev}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function VarslingerMockup() {
  const cases = [
    { id: 'VAR-2025-018', title: 'Anonym melding om mobbing', kind: 'AML kap. 2A', tone: '#1a3d32', status: 'Bekreftet', sla: '3 dager til frist' },
    { id: 'VAR-2025-017', title: 'Personvernbrudd e-postliste', kind: 'GDPR Art. 33', tone: '#0c1929', status: 'Under utredning', sla: '12 dager igjen' },
    { id: 'VAR-2025-016', title: 'Etisk bekymring — innkjøp', kind: 'Etisk', tone: '#7c3aed', status: 'Lukket', sla: 'Avsluttet' },
  ]
  return (
    <div className="p-4" style={{ background: '#fbf9f3' }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: FOREST }}>Varslingssaker</p>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-neutral-500">2 saker krever oppmerksomhet</span>
        </div>
      </div>
      <div className="space-y-2">
        {cases.map((c) => (
          <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: `${c.tone}18`, color: c.tone }}>
                {c.kind}
              </span>
              <span className="ml-auto text-[10px] font-mono text-neutral-400">{c.id}</span>
            </div>
            <p className="text-sm font-medium" style={{ color: FOREST }}>{c.title}</p>
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span className="text-neutral-500">{c.status}</span>
              <span className="font-medium" style={{ color: c.status === 'Lukket' ? '#22c55e' : '#ef4444' }}>{c.sla}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'rgba(45,212,191,0.12)' }}>
        <span className="text-xs">🔒</span>
        <span className="text-[10px] font-medium" style={{ color: FOREST }}>
          Anonyme felter er ulesbare etter lukking — RLS-håndhevet
        </span>
      </div>
    </div>
  )
}

function DokumenterMockup() {
  const pages = [
    { title: 'HMS-håndbok', rev: 'Rev. 14', space: 'HMS-prosedyrer', due: 'OK', tone: '#22c55e' },
    { title: 'Brann- og evakueringsplan', rev: 'Rev. 7', space: 'Sikkerhet', due: '30d', tone: '#fbbf24' },
    { title: 'Personvernerklæring ansatte', rev: 'Rev. 4', space: 'GDPR', due: 'OK', tone: '#22c55e' },
    { title: 'Innføring av nyansatte', rev: 'Rev. 22', space: 'HR', due: 'Forsinket', tone: '#ef4444' },
    { title: 'Innkjøpsrutiner — kjemi', rev: 'Rev. 3', space: 'Internkontroll', due: '60d', tone: '#fbbf24' },
  ]
  return (
    <div className="grid grid-cols-5" style={{ background: '#ffffff' }}>
      <div className="col-span-2 border-r border-neutral-200 p-3" style={{ background: '#f7f5ee' }}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Rom</p>
        {['📘 HMS-prosedyrer (24)', '🔥 Sikkerhet (12)', '🔒 GDPR (8)', '👤 HR (16)', '⚙️ Internkontroll (19)'].map((s, i) => (
          <div key={s} className={`rounded px-2 py-1.5 text-xs ${i === 0 ? 'font-semibold' : ''}`}
            style={i === 0 ? { background: FOREST, color: 'white' } : { color: '#525252' }}>
            {s}
          </div>
        ))}
      </div>
      <div className="col-span-3 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Sider — neste gjennomgang</p>
        <div className="space-y-1.5">
          {pages.map((p) => (
            <div key={p.title} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: FOREST }}>{p.title}</p>
                <p className="text-[9px] uppercase tracking-wider text-neutral-400">{p.space} · {p.rev}</p>
              </div>
              <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${p.tone}22`, color: p.tone }}>
                {p.due}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LaeringMockup() {
  const courses = [
    { title: 'HMS-grunnopplæring (40 t)', mandatory: 'Lovpålagt', progress: 100, status: 'Sertifisert — utløp 2027', tone: '#22c55e' },
    { title: 'Brann og evakuering', mandatory: 'Årlig', progress: 100, status: 'Sertifisert — utløp 87 dager', tone: '#fbbf24' },
    { title: 'Førstehjelp', mandatory: 'Hvert 3. år', progress: 64, status: 'Pågående', tone: '#3b82f6' },
    { title: 'GDPR-bevissthet', mandatory: 'Ved innføring', progress: 0, status: 'Ikke startet', tone: '#9ca3af' },
  ]
  return (
    <div className="p-4" style={{ background: CREAM }}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full text-base font-bold text-white" style={{ background: TEAL, color: FOREST }}>
          NK
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: FOREST }}>Nils Knutsen — Verneombud</p>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">Kompetanseplan 2026</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold" style={{ color: FOREST }}>3/4</p>
          <p className="text-[9px] uppercase tracking-widest text-neutral-500">Fullført</p>
        </div>
      </div>
      <div className="space-y-2">
        {courses.map((c) => (
          <div key={c.title} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: FOREST }}>{c.title}</p>
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: 'rgba(26,61,50,0.1)', color: FOREST }}>
                {c.mandatory}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: c.tone }} />
            </div>
            <p className="mt-1 text-[10px]" style={{ color: c.tone }}>{c.status}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function UndersokelserMockup() {
  const dims = [
    { label: 'Psykososialt', score: 6.2, prev: 5.8 },
    { label: 'Fysisk arbeidsmiljø', score: 7.4, prev: 7.3 },
    { label: 'Ledelse', score: 5.9, prev: 6.1 },
    { label: 'Utvikling', score: 6.8, prev: 6.5 },
  ]
  return (
    <div className="p-4" style={{ background: '#ffffff' }}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">AMU-puls — Februar 2026</p>
          <h3 className="text-sm font-bold" style={{ color: FOREST }}>Avdeling: Drift (42 ansatte)</h3>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
          🔒 Anonym
        </span>
      </div>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3" style={{ background: '#f7f5ee' }}>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-neutral-500">Svarrate</p>
            <p className="text-2xl font-bold" style={{ color: FOREST }}>87 %</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">36 av 42</p>
            <p className="text-[10px]" style={{ color: '#22c55e' }}>+12 % fra forrige</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {dims.map((d) => (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span style={{ color: FOREST }}>{d.label}</span>
              <span className="font-semibold tabular-nums" style={{ color: FOREST }}>
                {d.score.toFixed(1)} <span className="text-[9px] text-neutral-400">/ 10</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full" style={{ width: `${d.score * 10}%`, background: d.score > d.prev ? '#22c55e' : '#f97316' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
