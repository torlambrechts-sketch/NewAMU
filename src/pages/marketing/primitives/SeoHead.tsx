// Per-route head mutation without react-helmet.
// Mutates <title>, description, canonical, OG, Twitter and optional JSON-LD.
// Snapshots prior values on mount and restores them on unmount so a route
// without <SeoHead> never inherits the previous page's meta.

import { useEffect, useMemo } from 'react'

type SeoHeadProps = {
  title: string
  description: string
  canonical: string
  ogImage?: string
  jsonLd?: Record<string, unknown>
}

const BASE_OG_IMAGE = 'https://app.klarert.com/og-image.svg'
const SITE = 'Klarert'

const META_SELECTORS = [
  { selector: 'meta[name="description"]', attr: 'content' },
  { selector: 'link[rel="canonical"]', attr: 'href' },
  { selector: 'meta[property="og:title"]', attr: 'content' },
  { selector: 'meta[property="og:description"]', attr: 'content' },
  { selector: 'meta[property="og:url"]', attr: 'content' },
  { selector: 'meta[property="og:image"]', attr: 'content' },
  { selector: 'meta[property="og:site_name"]', attr: 'content' },
  { selector: 'meta[name="twitter:title"]', attr: 'content' },
  { selector: 'meta[name="twitter:description"]', attr: 'content' },
  { selector: 'meta[name="twitter:image"]', attr: 'content' },
] as const

function upsertMetaOrLink(selector: string, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    const isLink = selector.startsWith('link[')
    el = document.createElement(isLink ? 'link' : 'meta')
    const [, attrName, attrValue] = selector.match(/\[([^=]+)="([^"]+)"\]/) ?? []
    if (attrName && attrValue) el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

export function SeoHead({ title, description, canonical, ogImage, jsonLd }: SeoHeadProps) {
  const jsonLdString = useMemo(() => (jsonLd ? JSON.stringify(jsonLd) : null), [jsonLd])

  useEffect(() => {
    const prevTitle = document.title
    const prevValues = META_SELECTORS.map(({ selector, attr }) => ({
      selector,
      attr,
      value: document.head.querySelector(selector)?.getAttribute(attr) ?? null,
    }))

    const image = ogImage ?? BASE_OG_IMAGE
    document.title = title
    upsertMetaOrLink('meta[name="description"]', 'content', description)
    upsertMetaOrLink('link[rel="canonical"]', 'href', canonical)
    upsertMetaOrLink('meta[property="og:title"]', 'content', title)
    upsertMetaOrLink('meta[property="og:description"]', 'content', description)
    upsertMetaOrLink('meta[property="og:url"]', 'content', canonical)
    upsertMetaOrLink('meta[property="og:image"]', 'content', image)
    upsertMetaOrLink('meta[property="og:site_name"]', 'content', SITE)
    upsertMetaOrLink('meta[name="twitter:title"]', 'content', title)
    upsertMetaOrLink('meta[name="twitter:description"]', 'content', description)
    upsertMetaOrLink('meta[name="twitter:image"]', 'content', image)

    let script: HTMLScriptElement | null = null
    if (jsonLdString) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-seo-head', 'route')
      script.textContent = jsonLdString
      document.head.appendChild(script)
    }

    return () => {
      document.title = prevTitle
      for (const { selector, attr, value } of prevValues) {
        const el = document.head.querySelector(selector)
        if (el && value !== null) el.setAttribute(attr, value)
      }
      if (script && script.parentNode) script.parentNode.removeChild(script)
    }
  }, [title, description, canonical, ogImage, jsonLdString])

  return null
}
