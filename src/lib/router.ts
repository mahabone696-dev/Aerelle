import { useEffect, useState } from 'react'

// Minimal hash router. Hash routing keeps the build deployable to any static host without rewrite rules.
//   "#/login?next=%2Fs%2Faligne-pilates%2Frating" -> { path: '/login', studio: null, ... }
//   "#/s/aligne-pilates/members?tab=unpaid"        -> { path: '/members', studio: 'aligne-pilates', ... }
// Inside a studio, pages link with short paths ("/members"); navigate() and link() add the studio prefix.

export interface Route {
  /** Path within the current studio ("/members"), or a platform path ("/studios") outside one. */
  path: string
  query: URLSearchParams
  /** Studio slug from "/s/<slug>/...", or null on platform pages. */
  studio: string | null
  /** The full path as it appears in the address bar, without the query. */
  full: string
}

const PLATFORM_PATHS = ['/login', '/signup', '/studio/login', '/studio/signup', '/studios', '/find', '/profile', '/new-studio']
const isPlatformPath = (p: string) => p.startsWith('/s/') || PLATFORM_PATHS.some((x) => p === x || p.startsWith(`${x}?`))

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [full, search = ''] = hash.split('?')
  const m = full.match(/^\/s\/([^/]+)(\/.*)?$/)
  return {
    path: m ? m[2] || '/' : full || '/',
    query: new URLSearchParams(search),
    studio: m ? decodeURIComponent(m[1]) : null,
    full: full || '/',
  }
}

let studioBase = ''
/** Called by the app shell for the studio being shown, so studio-relative links resolve. */
export function setStudioBase(slug: string | null) {
  studioBase = slug ? `/s/${encodeURIComponent(slug)}` : ''
}

const resolve = (to: string) => (to.startsWith('/') && studioBase && !isPlatformPath(to) ? studioBase + to : to)

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(to: string) {
  window.location.hash = resolve(to)
}

/** href for an in-app path, e.g. link('/members') -> "#/s/aligne-pilates/members" inside a studio. */
export const link = (to: string) => `#${resolve(to)}`

/** Only allow in-app redirect targets, so ?next= can't send people to another site. */
export function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
