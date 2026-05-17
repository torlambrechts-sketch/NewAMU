// Per-route head mutation without react-helmet.
// Mutates <title>, description, canonical, OG, Twitter and optional JSON-LD.
// On unmount restores the baseline values from index.html.

import { useEffect } from 'react'

type SeoHeadProps = {
  title: string
  description: string
  canonical: string
  ogImage?: string
  jsonLd?: Record<string, unknown>
}

const BASE_OG_IMAGE = 'https://app.klarert.com/og-image.png'
const SITE = 'Klarert'

function setMeta(selector: string, attr: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    const [, attrName, attrValue] = selector.match(/\[([^=]+)="([^"]+)"\]/) ?? []
    if (attrName && attrValue) el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
  return el
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  return el
}

export function SeoHead({ title, description, canonical, ogImage, jsonLd }: SeoHeadProps) {
  useEffect(() => {
    const prevTitle = document.title
    const image = ogImage ?? BASE_OG_IMAGE

    document.title = title
    setMeta('meta[name="description"]', 'content', description)
    setLink('canonical', canonical)
    setMeta('meta[property="og:title"]', 'content', title)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', canonical)
    setMeta('meta[property="og:image"]', 'content', image)
    setMeta('meta[property="og:site_name"]', 'content', SITE)
    setMeta('meta[name="twitter:title"]', 'content', title)
    setMeta('meta[name="twitter:description"]', 'content', description)
    setMeta('meta[name="twitter:image"]', 'content', image)

    let script: HTMLScriptElement | null = null
    if (jsonLd) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-seo-head', 'route')
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }

    return () => {
      document.title = prevTitle
      if (script && script.parentNode) script.parentNode.removeChild(script)
    }
  }, [title, description, canonical, ogImage, jsonLd])

  return null
}
