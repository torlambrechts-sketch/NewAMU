import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Copy, ExternalLink, LayoutTemplate } from 'lucide-react'

/* ── Visual constants matching the platform design language ─────────────── */

const CREAM = '#f7f5f0'
const CREAM_DEEP = '#EFE8DC'
const CREAM_STAT = '#f2eee6'
const FOREST = '#1a3d32'
const BORDER = 'rgba(0,0,0,0.10)'
const WHITE = '#ffffff'
const SERIF = "'Libre Baskerville', Georgia, serif"
const SANS = 'Inter, ui-sans-serif, system-ui, sans-serif'

/* ── Template definitions ───────────────────────────────────────────────── */

export type LayoutTemplate = {
  id: string
  name: string
  category: 'full-page' | 'content' | 'dashboard' | 'form' | 'detail'
  description: string
  useCases: string[]
  /** Preview rendered as static HTML-in-JSX (scaled thumbnail) */
  preview: React.ReactNode
  /** Path to open in layout builder with this template pre-selected */
  builderPath?: string
}

/* ── Mini preview components ──────────────────────────────────────────────── */

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: CREAM, fontFamily: SANS, padding: '12px', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function PreviewBreadcrumb() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {['Workspace', 'Modul', 'Side'].map((t, i) => (
        <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {i > 0 && <span style={{ color: '#d4d4d4', fontSize: '9px' }}>›</span>}
          <span style={{ fontSize: '9px', color: '#a3a3a3' }}>{t}</span>
        </span>
      ))}
    </div>
  )
}

function PreviewH1({ text }: { text: string }) {
  return <div style={{ fontFamily: SERIF, fontSize: '14px', fontWeight: 700, color: '#171717', lineHeight: 1.2 }}>{text}</div>
}

function PreviewTabs({ tabs }: { tabs: string[] }) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${BORDER}`, paddingBottom: '4px' }}>
      {tabs.map((t, i) => (
        <div key={t} style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: i === 0 ? FOREST : 'transparent', color: i === 0 ? WHITE : '#737373', fontWeight: 600 }}>{t}</div>
      ))}
    </div>
  )
}

function PreviewStatRow({ n = 3 }: { n?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: '4px' }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ backgroundColor: CREAM_STAT, borderRadius: '4px', padding: '5px 6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#171717' }}>{(i + 1) * 12}</div>
          <div style={{ fontSize: '7px', color: '#525252', marginTop: '1px' }}>Tittel</div>
        </div>
      ))}
    </div>
  )
}

function PreviewTable({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: '4px', overflow: 'hidden', flex: 1 }}>
      <div style={{ backgroundColor: CREAM_DEEP, padding: '4px 6px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '4px' }}>
        {['Navn', 'Status', 'Dato'].map(h => <div key={h} style={{ fontSize: '7px', fontWeight: 700, color: '#525252', textTransform: 'uppercase' }}>{h}</div>)}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ padding: '3px 6px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '4px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: '8px', color: '#171717' }}>Element {i + 1}</div>
          <div style={{ fontSize: '7px', color: '#737373' }}>Aktiv</div>
          <div style={{ fontSize: '7px', color: '#737373' }}>01.04</div>
        </div>
      ))}
    </div>
  )
}

function PreviewCard({ title, accent = FOREST }: { title: string; accent?: string }) {
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '6px', flex: 1 }}>
      <div style={{ width: '100%', height: '2px', backgroundColor: accent, marginBottom: '4px', borderRadius: '1px' }} />
      <div style={{ fontSize: '8px', fontWeight: 700, color: '#171717', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '7px', color: '#737373', lineHeight: 1.4 }}>Innhold vises her. Kan inneholde tekst, tall eller lister.</div>
    </div>
  )
}

function PreviewSidebar({ width = 40 }: { width?: number }) {
  return (
    <div style={{ width, minWidth: width, backgroundColor: CREAM_DEEP, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '5px' }}>
      {['Nav 1', 'Nav 2', 'Nav 3', 'Nav 4'].map((t, i) => (
        <div key={t} style={{ fontSize: '7px', padding: '2px 3px', borderRadius: '2px', backgroundColor: i === 0 ? FOREST : 'transparent', color: i === 0 ? WHITE : '#525252', marginBottom: '1px' }}>{t}</div>
      ))}
    </div>
  )
}

function PreviewNotice({ variant = 'info' }: { variant?: 'info' | 'warning' }) {
  const col = variant === 'warning' ? '#f97316' : '#3b82f6'
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${col}30`, borderRadius: '4px', padding: '5px 6px', display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: `${col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: col }} />
      </div>
      <div>
        <div style={{ fontSize: '7px', fontWeight: 700, color: '#171717' }}>{variant === 'warning' ? 'Advarsel' : 'Informasjon'}</div>
        <div style={{ fontSize: '7px', color: '#737373', marginTop: '1px' }}>Meldingstekst vises her</div>
      </div>
    </div>
  )
}

function PreviewActionBar() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {['+ Ny', 'Importer', 'Eksporter'].map((t, i) => (
        <div key={t} style={{ fontSize: '7px', padding: '3px 7px', borderRadius: '3px', backgroundColor: i === 0 ? FOREST : 'transparent', border: `1px solid ${i === 0 ? FOREST : BORDER}`, color: i === 0 ? WHITE : '#525252', fontWeight: 600 }}>{t}</div>
      ))}
    </div>
  )
}

/* ── Template catalogue ─────────────────────────────────────────────────── */

const TEMPLATES: LayoutTemplate[] = [
  {
    id: 'standard-list',
    name: 'Standard listeside',
    category: 'full-page',
    description: 'Brødsmule → H1 → fanerrad → KPI-rad → handlingsknapper → søk + filter → tabell med paginering.',
    useCases: ['Vernerunder', 'Inspeksjoner', 'Sykefravær', 'Hendelser', 'Opplæringsregister'],
    preview: (
      <PreviewShell>
        <PreviewBreadcrumb />
        <PreviewH1 text="Sideoversikt" />
        <PreviewTabs tabs={['Oversikt', 'Detaljer', 'Innstillinger']} />
        <PreviewStatRow n={3} />
        <PreviewActionBar />
        <PreviewTable rows={4} />
      </PreviewShell>
    ),
  },
  {
    id: 'split-2-1',
    name: '2/3 + 1/3 — tabell og sidepanel',
    category: 'full-page',
    description: 'Tabell med søk og filter i 2/3-kolonnen, kalender eller info-panel i 1/3-kolonnen.',
    useCases: ['Vernerunder + planlegging', 'Oppgaver + tidslinje', 'Saker + detalj'],
    preview: (
      <PreviewShell>
        <PreviewBreadcrumb />
        <PreviewH1 text="Tabell + sidepanel" />
        <PreviewTabs tabs={['Liste', 'Kart', 'Arkiv']} />
        <PreviewStatRow n={3} />
        <div style={{ display: 'flex', gap: '6px', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <PreviewActionBar />
            <PreviewTable rows={3} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <PreviewCard title="Kommende" accent="#3b82f6" />
            <PreviewCard title="Statistikk" accent={FOREST} />
          </div>
        </div>
      </PreviewShell>
    ),
  },
  {
    id: 'dashboard-7030',
    name: 'Dashboard 70/30',
    category: 'dashboard',
    description: 'KPI-rad øverst, deretter hovedinnhold (70%) til venstre og sidekolonne med widgets (30%) til høyre.',
    useCases: ['Prosjektdashboard', 'HMS-oversikt', 'Lederrapport', 'Teamoversikt'],
    preview: (
      <PreviewShell>
        <PreviewBreadcrumb />
        <PreviewH1 text="Dashboard" />
        <PreviewStatRow n={4} />
        <div style={{ display: 'flex', gap: '6px', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 7, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <PreviewTable rows={3} />
          </div>
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <PreviewCard title="Varsler" accent="#f97316" />
            <PreviewCard title="Snarveier" accent={FOREST} />
            <PreviewCard title="Aktivitet" accent="#8b5cf6" />
          </div>
        </div>
      </PreviewShell>
    ),
  },
  {
    id: 'three-kpi-list',
    name: 'KPI + liste (kompakt)',
    category: 'content',
    description: 'Tre KPI-bokser over en kompakt liste. Ingen sidepanel — maksimal plass til innholdet.',
    useCases: ['Tiltak og avvik', 'Revisjonspunkter', 'Åpne saker', 'Oppgaveliste'],
    preview: (
      <PreviewShell>
        <PreviewH1 text="Kompakt oversikt" />
        <PreviewTabs tabs={['Alle', 'Åpne', 'Lukket']} />
        <PreviewStatRow n={3} />
        <PreviewActionBar />
        <PreviewTable rows={5} />
      </PreviewShell>
    ),
  },
  {
    id: 'detail-with-sidebar',
    name: 'Detaljside med sidemeny',
    category: 'detail',
    description: 'Vertikal sidemeny (navigasjon) til venstre, detaljinnhold til høyre. Typisk for saksbehandling.',
    useCases: ['Hendelsesdetalj', 'Kandidatdetalj', 'Inspeksjon detalj', 'Ansattside'],
    preview: (
      <PreviewShell>
        <PreviewBreadcrumb />
        <PreviewH1 text="Detaljvisning" />
        <div style={{ display: 'flex', gap: '6px', flex: 1, overflow: 'hidden', marginTop: '2px' }}>
          <PreviewSidebar width={50} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <PreviewCard title="Hoveddel" accent={FOREST} />
            <PreviewCard title="Historikk" accent="#737373" />
          </div>
        </div>
      </PreviewShell>
    ),
  },
  {
    id: 'form-page',
    name: 'Skjemaside',
    category: 'form',
    description: 'Skjema i midtkolonnen (60%) med konteksthjelp og handlinger i høyre sidepanel (40%).',
    useCases: ['Ny hendelse', 'Innstillinger', 'Registreringsskjema', 'Redigeringsside'],
    preview: (
      <PreviewShell>
        <PreviewBreadcrumb />
        <PreviewH1 text="Nytt element" />
        <div style={{ display: 'flex', gap: '6px', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 3, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {['Tittel', 'Beskrivelse', 'Kategori', 'Dato'].map(f => (
              <div key={f}>
                <div style={{ fontSize: '7px', fontWeight: 700, color: '#525252', marginBottom: '2px' }}>{f}</div>
                <div style={{ height: '10px', backgroundColor: CREAM_DEEP, borderRadius: '2px', border: `1px solid ${BORDER}` }} />
              </div>
            ))}
          </div>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <PreviewNotice variant="info" />
            <PreviewCard title="Veiledning" accent="#3b82f6" />
          </div>
        </div>
      </PreviewShell>
    ),
  },
  {
    id: 'three-columns',
    name: 'Tre like kolonner',
    category: 'content',
    description: 'Tre like brede kolonner for kortbasert innhold. Egner seg til oversikter og statistikk.',
    useCases: ['AMU-oversikt', 'Modul-velger', 'Teamkort', 'Statusoversikt'],
    preview: (
      <PreviewShell>
        <PreviewH1 text="Kortvisning" />
        <PreviewStatRow n={3} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', flex: 1 }}>
          {['Modul A', 'Modul B', 'Modul C'].map((t, i) => (
            <div key={t} style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '6px' }}>
              <div style={{ width: '100%', height: '2px', backgroundColor: [FOREST, '#3b82f6', '#f97316'][i], marginBottom: '4px', borderRadius: '1px' }} />
              <div style={{ fontSize: '8px', fontWeight: 700, color: '#171717', marginBottom: '3px' }}>{t}</div>
              <div style={{ fontSize: '7px', color: '#737373' }}>3 aktive · 1 avvik</div>
            </div>
          ))}
        </div>
      </PreviewShell>
    ),
  },
  {
    id: 'report-with-charts',
    name: 'Rapport med grafer',
    category: 'dashboard',
    description: 'KPI øverst, deretter to parallelle innsiktsgrafer (donut og søyler) over en detaljert liste.',
    useCases: ['HMS-rapport', 'Sykefravær-analyse', 'Risikorapport', 'Årsrapport'],
    preview: (
      <PreviewShell>
        <PreviewH1 text="Rapport" />
        <PreviewStatRow n={4} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          {/* Donut */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `conic-gradient(${FOREST} 0deg 130deg, #3b82f6 130deg 220deg, #f97316 220deg 360deg)`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              {['Kategori A', 'Kategori B', 'Annet'].map((t, i) => (
                <div key={t} style={{ display: 'flex', gap: '3px', alignItems: 'center', marginBottom: '1px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: [FOREST, '#3b82f6', '#f97316'][i] }} />
                  <span style={{ fontSize: '7px', color: '#525252' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Bar */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '6px' }}>
            {[['Kritisk', 0.2, '#ef4444'], ['Høy', 0.6, '#f97316'], ['Middels', 0.9, FOREST]].map(([l, w, c]) => (
              <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                <div style={{ width: '28px', fontSize: '6px', color: '#737373', textAlign: 'right' }}>{l as string}</div>
                <div style={{ flex: 1, height: '5px', backgroundColor: CREAM_DEEP, borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${(w as number) * 100}%`, height: '100%', backgroundColor: c as string, borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <PreviewTable rows={2} />
      </PreviewShell>
    ),
  },
  {
    id: 'notice-content',
    name: 'Varsler og innhold',
    category: 'content',
    description: 'Varsel-boks øverst (info eller advarsel), deretter tabellliste. For sider med viktige meldinger.',
    useCases: ['Compliance-side', 'Lovkrav', 'Frister', 'Bekjentgjøringer'],
    preview: (
      <PreviewShell>
        <PreviewH1 text="Varsler og innhold" />
        <PreviewNotice variant="warning" />
        <PreviewNotice variant="info" />
        <PreviewActionBar />
        <PreviewTable rows={3} />
      </PreviewShell>
    ),
  },
  {
    id: 'wizard-flow',
    name: 'Veiviserflyt (steg)',
    category: 'form',
    description: 'Stegoversikt øverst, skjemainnhold i midten, navigasjonsknapper nederst. For flertrinns arbeidsflyter.',
    useCases: ['Ny vernerunde', 'Onboarding', 'Registreringsprosess', 'Søknadsskjema'],
    preview: (
      <PreviewShell>
        <PreviewH1 text="Ny sak — steg 2 av 4" />
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: i < 2 ? FOREST : i === 2 ? '#3b82f6' : CREAM_DEEP, border: `1px solid ${i <= 2 ? FOREST : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '7px', color: i <= 2 ? WHITE : '#737373', fontWeight: 700 }}>{i}</span>
              </div>
              {i < 4 && <div style={{ width: '12px', height: '1px', backgroundColor: i < 2 ? FOREST : BORDER }} />}
            </div>
          ))}
        </div>
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {['Felt 1', 'Felt 2', 'Felt 3'].map(f => (
            <div key={f}>
              <div style={{ fontSize: '7px', fontWeight: 700, color: '#525252', marginBottom: '2px' }}>{f}</div>
              <div style={{ height: '10px', backgroundColor: CREAM_DEEP, borderRadius: '2px', border: `1px solid ${BORDER}` }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '7px', padding: '3px 8px', border: `1px solid ${BORDER}`, borderRadius: '3px', color: '#525252' }}>Tilbake</div>
          <div style={{ fontSize: '7px', padding: '3px 8px', backgroundColor: FOREST, borderRadius: '3px', color: WHITE, fontWeight: 600 }}>Neste</div>
        </div>
      </PreviewShell>
    ),
  },
]

const CATEGORY_LABELS: Record<LayoutTemplate['category'], string> = {
  'full-page': 'Helside',
  'content': 'Innhold',
  'dashboard': 'Dashboard',
  'form': 'Skjema',
  'detail': 'Detalj',
}

const CATEGORY_COLORS: Record<LayoutTemplate['category'], string> = {
  'full-page': FOREST,
  'content': '#3b82f6',
  'dashboard': '#8b5cf6',
  'form': '#f97316',
  'detail': '#0891b2',
}

/* ── Copy-code panel ──────────────────────────────────────────────────────── */

function CodeTag({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 rounded bg-slate-800 px-2 py-1 font-mono text-xs text-amber-300/90 hover:bg-slate-700"
    >
      {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
      {text}
    </button>
  )
}

/* ── Template card ────────────────────────────────────────────────────────── */

function TemplateCard({ template, onSelect }: { template: LayoutTemplate; onSelect: (t: LayoutTemplate) => void }) {
  const catColor = CATEGORY_COLORS[template.category]
  return (
    <div
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 transition hover:border-white/20 hover:bg-slate-900/80"
      onClick={() => onSelect(template)}
    >
      {/* Preview thumbnail */}
      <div className="relative overflow-hidden" style={{ height: 200, backgroundColor: CREAM }}>
        <div style={{ transform: 'scale(0.72)', transformOrigin: 'top left', width: '139%', height: '139%', pointerEvents: 'none' }}>
          {template.preview}
        </div>
      </div>

      {/* Card footer */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-white">{template.name}</p>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${catColor}25`, color: catColor }}
          >
            {CATEGORY_LABELS[template.category]}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-neutral-400">{template.description}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {template.useCases.map(u => (
            <span key={u} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-500">{u}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Detail panel ─────────────────────────────────────────────────────────── */

function TemplateDetail({ template, onClose }: { template: LayoutTemplate; onClose: () => void }) {
  const navigate = useNavigate()
  const catColor = CATEGORY_COLORS[template.category]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="size-5 text-amber-400/80" />
            <h2 className="text-base font-semibold text-white">{template.name}</h2>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${catColor}25`, color: catColor }}>
              {CATEGORY_LABELS[template.category]}
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white">
            <svg className="size-4" viewBox="0 0 16 16" fill="currentColor"><path d="M3.22 3.22a.75.75 0 0 1 1.06 0L8 6.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          {/* Preview */}
          <div className="overflow-hidden rounded-xl border border-white/10" style={{ height: 280, backgroundColor: CREAM }}>
            <div style={{ transform: 'scale(0.78)', transformOrigin: 'top left', width: '128%', height: '128%', pointerEvents: 'none' }}>
              {template.preview}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Beskrivelse</p>
              <p className="text-sm leading-relaxed text-neutral-300">{template.description}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Bruksområder</p>
              <div className="flex flex-wrap gap-1.5">
                {template.useCases.map(u => (
                  <span key={u} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-neutral-300">{u}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Mal-ID</p>
              <CodeTag text={template.id} />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {template.builderPath && (
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
                  onClick={() => { onClose(); navigate(template.builderPath!) }}
                >
                  <ExternalLink className="size-4" />
                  Åpne i Layout-designer
                </button>
              )}
              <Link
                to="/platform-admin/layout"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5"
                onClick={onClose}
              >
                Gå til Layout-komponenter
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */

const ALL_CATEGORIES = ['all', 'full-page', 'content', 'dashboard', 'form', 'detail'] as const
type FilterCategory = typeof ALL_CATEGORIES[number]

export function PlatformLayoutTemplatesPage() {
  const [selected, setSelected] = useState<LayoutTemplate | null>(null)
  const [filter, setFilter] = useState<FilterCategory>('all')

  const filtered = filter === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === filter)

  return (
    <div className="space-y-8 text-neutral-100">
      {/* Page header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <LayoutTemplate className="size-6 text-amber-400/80" />
          <h1 className="text-2xl font-semibold text-white">Layout-maler</h1>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-neutral-400">
          Ferdige sideoppsett for gjenbruk. Klikk en mal for å se detaljer og koble den til{' '}
          <Link to="/platform-admin/layout" className="text-amber-400/90 hover:underline">Layout-komponenter</Link>{' '}
          eller{' '}
          <Link to="/platform-admin/layout-builder" className="text-amber-400/90 hover:underline">Layout-designer</Link>.
          Malene definerer strukturen — innholdet fylles av moduldata i appen.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === cat
                ? 'bg-amber-500/90 text-slate-950'
                : 'border border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200'
            }`}
          >
            {cat === 'all' ? `Alle (${TEMPLATES.length})` : `${CATEGORY_LABELS[cat as LayoutTemplate['category']]} (${TEMPLATES.filter(t => t.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(t => (
          <TemplateCard key={t.id} template={t} onSelect={setSelected} />
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <TemplateDetail template={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
