import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { WHISTLE_CATEGORY_OPTIONS } from '../types/whistleblowing'

const R = 'rounded-none'

export function PublicWhistlePage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = getSupabaseBrowserClient()
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loadingOrg, setLoadingOrg] = useState(!!slug)
  const [category, setCategory] = useState(WHISTLE_CATEGORY_OPTIONS[0]?.value ?? 'other')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [www, setWww] = useState('')
  const [occurred, setOccurred] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [contact, setContact] = useState('')
  const [fileHint, setFileHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ accessKey: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadOrg = useCallback(async () => {
    if (!supabase || !slug) {
      setLoadingOrg(false)
      return
    }
    setLoadingOrg(true)
    const { data, error: e } = await supabase.rpc('public_whistleblowing_org_lookup', { p_slug: slug })
    if (e || !data || !(data as { name?: string }).name) {
      setOrgName(null)
    } else {
      setOrgName((data as { name: string }).name)
    }
    setLoadingOrg(false)
  }, [supabase, slug])

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrg()
    })
  }, [loadOrg])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !slug) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('public_submit_whistleblowing', {
      p_org_slug: slug,
      p_category: category,
      p_title: title,
      p_description: description,
      p_who_what_where: www,
      p_occurred_at_text: occurred,
      p_is_anonymous: anonymous,
      p_reporter_contact: contact,
      p_captcha_token: null,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    const row = data as { accessKey?: string }
    if (row?.accessKey) setDone({ accessKey: row.accessKey })
    else setError('Uventet svar fra server.')
  }

  if (!slug) {
    return <p className="p-8 text-neutral-600">Ugyldig lenke.</p>
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <h1 className="font-serif text-2xl font-semibold text-[#1a3d32]">Varsle (anonymt mulig)</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Dette skjemaet krever ikke innlogging. Du får en <strong>saksnøkkel</strong> etter innsending — oppbevar den trygt for
          å sjekke status senere.
        </p>
        {loadingOrg ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" /> Laster…
          </p>
        ) : !orgName ? (
          <p className="mt-6 text-sm text-red-700">Fant ikke virksomhet for denne lenken.</p>
        ) : done ? (
          <div className={`${R} mt-8 border border-emerald-200 bg-white p-6`}>
            <p className="font-medium text-emerald-900">Varsel mottatt</p>
            <p className="mt-2 text-sm text-neutral-700">
              Din saksnøkkel (oppbevar trygt):{' '}
              <code className="break-all rounded bg-neutral-100 px-1 py-0.5 text-xs">{done.accessKey}</code>
            </p>
            <Link to={`/varsle/status?key=${encodeURIComponent(done.accessKey)}`} className="mt-4 inline-block text-sm font-medium text-[#1a3d32] underline">
              Sjekk status →
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className={`${R} mt-8 space-y-4 border border-neutral-200 bg-white p-6`}>
            <p className="text-sm text-neutral-600">
              Virksomhet: <strong>{orgName}</strong>
            </p>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
              >
                {WHISTLE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Tittel / kort sammendrag</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Beskrivelse</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Hvem / hva / hvor</label>
              <textarea
                rows={3}
                value={www}
                onChange={(e) => setWww(e.target.value)}
                className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Tidspunkt (fritekst)</label>
              <input value={occurred} onChange={(e) => setOccurred(e.target.value)} className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`} />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-[10px] font-bold uppercase text-neutral-600">Anonymitet</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={anonymous} onChange={() => setAnonymous(true)} />
                Varsle anonymt
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!anonymous} onChange={() => setAnonymous(false)} />
                Jeg oppgir kontakt (navn/e-post/telefon)
              </label>
            </fieldset>
            {!anonymous ? (
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-600">Kontakt</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`} />
              </div>
            ) : null}
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Vedlegg (beskrivelse — opplasting kommer)</label>
              <input
                value={fileHint}
                onChange={(e) => setFileHint(e.target.value)}
                placeholder="F.eks. skjermbilde_1.png"
                className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`${R} w-full bg-[#1a3d32] py-3 text-sm font-semibold text-white disabled:opacity-50`}
            >
              {busy ? 'Sender…' : 'Send varsel'}
            </button>
          </form>
        )}
        <p className="mt-8 text-center text-xs text-neutral-500">
          <Link to="/login" className="underline">
            Tilbake til innlogging
          </Link>
        </p>
      </div>
    </div>
  )
}
