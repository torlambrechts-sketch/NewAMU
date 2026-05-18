// Klarert Studio — hub page ("Hva vil du bygge i dag?").
//
// Shows a grid of content type cards matching the mockup. Only the
// Spørreundersøkelse card is active for now; others render a "Kommer snart"
// badge. "Importer" and "Alle filer" are placeholder buttons.

import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  FileText,
  Grid3X3,
  Megaphone,
  Table2,
  Upload,
  Workflow,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'

type ContentType = {
  key: string
  title: string
  description: string
  exampleLabel: string
  icon: React.ComponentType<{ className?: string }>
  /** Where clicking the card navigates (list/hub page) */
  href?: string
  /** Where "Bygg ny →" navigates (create-new page); defaults to href */
  newHref?: string
  soon?: boolean
  bgColor?: string
}

const CONTENT_TYPES: ContentType[] = [
  {
    key: 'arbeidsflyt',
    title: 'Arbeidsflyt',
    description: 'Kobler hendelser i Klarert til automatiske handlinger — varsler, oppgaver, ROS-…',
    exampleLabel: 'Kritisk avvik + AMU + ROS',
    icon: Workflow,
    soon: true,
    bgColor: 'bg-neutral-100',
  },
  {
    key: 'mal',
    title: 'Mal',
    description: 'Forhåndsdefinerte skjemaer og dokumenter — vernerunde, SJA, ROS-…',
    exampleLabel: 'Vernerunde · standard',
    icon: Grid3X3,
    soon: true,
    bgColor: 'bg-[#f0f7f4]',
  },
  {
    key: 'dokument',
    title: 'Dokument',
    description: 'HMS-håndbok, prosedyrer, instrukser. Rik tekst med blokker, tabeller og lovverk-…',
    exampleLabel: 'HMS-håndbok 2026',
    icon: FileText,
    soon: true,
    bgColor: 'bg-neutral-50',
  },
  {
    key: 'elaering',
    title: 'E-læringskurs',
    description: 'Moduler med video, tekst, quiz og sertifikat. AML-systemkurs og egne kurs.',
    exampleLabel: 'Førstegangopplæring HMS',
    icon: BookOpen,
    soon: true,
    bgColor: 'bg-neutral-900',
  },
  {
    key: 'survey',
    title: 'Spørreundersøkelse',
    description: 'Spørsmål med forgrening, distribusjon og analyse. Integrert mot AMU.',
    exampleLabel: 'Arbeidsmiljø Q2 2026',
    icon: Megaphone,
    href: '/studio/survey',
    newHref: '/studio/survey/new',
    bgColor: 'bg-[#f0f7f4]',
  },
  {
    key: 'register',
    title: 'Register',
    description: 'Egendefinerte tabeller — kjemikalier, utstyr, leverandører. Med felter, validering, eksport.',
    exampleLabel: 'Kjemikalieregister',
    icon: Table2,
    soon: true,
    bgColor: 'bg-amber-50',
  },
  {
    key: 'dashboard',
    title: 'Dashboard',
    description: 'Widget-baserte oversikter med KPI-er, trender og lister på tvers av modulene.',
    exampleLabel: 'AMU månedsoversikt',
    icon: BarChart3,
    soon: true,
    bgColor: 'bg-neutral-50',
  },
]

function ContentTypeCard({ type }: { type: ContentType }) {
  const navigate = useNavigate()
  const Icon = type.icon
  const canClick = !!type.href && !type.soon

  return (
    <div
      className={[
        'group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition',
        canClick ? 'cursor-pointer hover:shadow-md' : 'opacity-90',
      ].join(' ')}
      onClick={() => canClick && navigate(type.href!)}
    >
      {/* Thumbnail */}
      <div
        className={`relative flex h-44 items-center justify-center ${type.bgColor ?? 'bg-neutral-50'}`}
      >
        <Icon
          className={[
            'h-16 w-16 transition',
            canClick ? 'text-neutral-700 group-hover:scale-105' : 'text-neutral-400',
          ].join(' ')}
        />
        {type.soon && (
          <span className="absolute right-3 top-3 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
            Kommer snart
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">{type.title}</h3>
        </div>
        <p className="line-clamp-2 text-xs text-neutral-500">{type.description}</p>
        <p className="mt-auto pt-2 text-[11px] text-neutral-400">{type.exampleLabel}</p>

        <button
          type="button"
          disabled={type.soon}
          onClick={(e) => {
            e.stopPropagation()
            const dest = type.newHref ?? type.href
            if (dest) navigate(dest)
          }}
          className={[
            'flex items-center gap-1 text-xs font-medium transition',
            canClick
              ? 'text-[#1a3d32] hover:underline'
              : 'cursor-default text-neutral-300',
          ].join(' ')}
        >
          Bygg ny
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function KlarertStudioPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full bg-[#f5f4f0]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              KLARERT · STUDIO
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">
              Hva vil du bygge i dag?
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-500">
              Lag og rediger maler, arbeidsflyter, dokumenter, e-læringskurs, undersøkelser,
              registre og dashboarder — på ett sted. Dra-og-slipp i Enkel modus, full kontroll i
              Avansert.
            </p>
          </div>

          {/* Placeholder action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="gap-1.5 opacity-50"
              title="Kommer snart"
            >
              <Upload className="h-3.5 w-3.5" />
              Importer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="gap-1.5 opacity-50"
              title="Kommer snart"
            >
              Alle filer
            </Button>
          </div>
        </div>

        {/* Content type grid */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">START FRA BLANK</h2>
            <button
              type="button"
              className="text-xs text-neutral-400 hover:text-neutral-600"
              disabled
            >
              Se alle typer →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {CONTENT_TYPES.map((type) => (
              <ContentTypeCard key={type.key} type={type} />
            ))}
          </div>
        </section>

        {/* Quick-start for surveys */}
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">SPØRREUNDERSØKELSER</h2>
            <button
              type="button"
              onClick={() => navigate('/studio/survey')}
              className="text-xs text-[#1a3d32] hover:underline"
            >
              Se alle →
            </button>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-neutral-600">
              Bygg spørreundersøkelser med drag-and-drop blokker — seksjoner, enkeltvalg, skalaer,
              fritekst og forgrening. Publish direkte til ansatte eller lenk til AMU-agenda.
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/studio/survey/new')}
                className="bg-[#1a3d32] hover:bg-[#1a3d32]/90"
              >
                Ny undersøkelse
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/studio/survey')}
              >
                Alle maler
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
