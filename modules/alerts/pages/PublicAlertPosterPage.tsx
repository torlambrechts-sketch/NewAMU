// PublicAlertPosterPage — printable poster page reachable at
// /alerts/public/poster/:slug?size=a4|a3&lang=nb|en. Renders the QrPoster
// component using browser print styles; "Print" button opens window.print().

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QrPoster } from '../components/intake/QrPoster'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

export default function PublicAlertPosterPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const size = (searchParams.get('size') ?? 'a4') as 'a3' | 'a4'
  const lang = (searchParams.get('lang') ?? 'nb') as 'nb' | 'en'
  const { supabase } = useOrgSetupContext()
  const [orgName, setOrgName] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !slug) return
      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('alerts_public_slug', slug)
        .maybeSingle()
      if (!cancelled && data && typeof (data as { name?: string }).name === 'string') {
        setOrgName((data as { name: string }).name)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, slug])

  const intakeUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/alerts/public/${slug ?? ''}`
  }, [slug])

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <div className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between print:hidden">
        <h1 className="font-semibold">Plakat (utskrift)</h1>
        <div className="flex gap-2 text-sm">
          <a href={`?size=a4&lang=${lang}`} className={size === 'a4' ? 'font-bold' : 'underline'}>A4</a>
          <a href={`?size=a3&lang=${lang}`} className={size === 'a3' ? 'font-bold' : 'underline'}>A3</a>
          <span className="mx-2">·</span>
          <a href={`?size=${size}&lang=nb`} className={lang === 'nb' ? 'font-bold' : 'underline'}>Norsk</a>
          <a href={`?size=${size}&lang=en`} className={lang === 'en' ? 'font-bold' : 'underline'}>English</a>
          <span className="mx-2">·</span>
          <button onClick={() => window.print()} className="rounded bg-neutral-900 px-3 py-1 text-white">
            Skriv ut
          </button>
        </div>
      </div>
      <div className="py-8 px-4">
        <QrPoster
          intakeUrl={intakeUrl}
          organizationName={orgName || '(ukjent organisasjon)'}
          size={size}
          lang={lang}
        />
      </div>
    </div>
  )
}
