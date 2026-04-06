import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useHrCompliance } from '../../hooks/useHrCompliance'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

export function HrConsultationPage() {
  const hr = useHrCompliance()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  return (
    <div className={PAGE_WRAP}>
      <Link to="/hr" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1a3d32] hover:underline">
        <ArrowLeft className="size-4" /> Til HR-hub
      </Link>

      <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
        Informasjon og drøfting (AML kap. 8)
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">
        For virksomheter over 50 ansatte: dokumenter når informasjon ble gitt og hva tillitsvalgte svarte. Invitasjon av
        deltakere og eksport av protokoll kommer i neste iterasjon.
      </p>

      {hr.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hr.error}</p>
      )}

      {hr.canConsultation && (
        <form
          className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            void hr.createConsultationCase(title, desc)
            setTitle('')
            setDesc('')
          }}
        >
          <h2 className="font-semibold text-neutral-900">Ny drøftingssak</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tittel"
            required
            className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Bakgrunn og foreslått beslutning (utkast)"
            rows={4}
            className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <button type="submit" className="mt-4 rounded-xl bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white">
            Opprett
          </button>
        </form>
      )}

      <ul className="mt-8 space-y-3">
        {hr.cases.map((c) => (
          <li key={c.id} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <span className="font-medium text-neutral-900">{c.title}</span>
            <span className="ml-2 text-xs text-neutral-500">{c.status}</span>
            {c.description && <p className="mt-1 text-sm text-neutral-600">{c.description}</p>}
          </li>
        ))}
      </ul>
      {hr.cases.length === 0 && !hr.loading && (
        <p className="mt-6 text-sm text-neutral-500">Ingen saker ennå.</p>
      )}
    </div>
  )
}
