import { useEffect, useState } from 'react'

// Minimal hash router: "#/login?next=%2Frating" → { path: '/login', query: { next: '/rating' } }.
// Hash routing keeps the build deployable to any static host without rewrite rules.

export interface Route {
  path: string
  query: URLSearchParams
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [path, search = ''] = hash.split('?')
  return { path: path || '/', query: new URLSearchParams(search) }
}

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
  window.location.hash = to
}

/** Only allow in-app redirect targets, so ?next= can't send people to another site. */
export function safeNext(next: string | null, fallback = '/schedule') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
