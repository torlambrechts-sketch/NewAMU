import { Link } from 'react-router-dom'
import { ArrowLeft, GitBranch } from 'lucide-react'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

export function HrORosPage() {
  return (
    <div className={PAGE_WRAP}>
      <Link to="/hr" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1a3d32] hover:underline">
        <ArrowLeft className="size-4" /> Til HR-hub
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#1a3d32]/10 text-[#1a3d32]">
          <GitBranch className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Organisatorisk ROS (O-ROS)
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
            I internkontroll-ROS: velg kategori <strong>«Organisatorisk endring»</strong> for forhåndsdefinerte farer
            (kompetansetap, rolleuklarhet, fryktkultur). Tabellen <code className="rounded bg-neutral-100 px-1 text-xs">hr_ros_org_signoffs</code>{' '}
            holder tvungen AMU/VO-signatur før godkjenning — kobles til arbeidsflyt i neste steg.
          </p>
          <p className="mt-4 text-sm text-neutral-600">
            Gå til <Link className="font-medium text-[#1a3d32] underline" to="/internal-control?tab=ros">Internkontroll → ROS</Link> for
            analyser.
          </p>
        </div>
      </div>
    </div>
  )
}
