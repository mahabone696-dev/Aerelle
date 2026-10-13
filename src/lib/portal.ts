import { useSyncExternalStore } from 'react'

// Which side of Aerelle the signed-in person chose: the student portal (booking classes) or the studio
// portal (running a studio). Set by the sign-in page they used, so a studio owner who signs in as a
// student books classes like everyone else instead of landing in the admin.
export type Portal = 'student' | 'studio'
const KEY = 'aerelle-portal'
const listeners = new Set<() => void>()

function read(): Portal {
  try {
    return localStorage.getItem(KEY) === 'student' ? 'student' : 'studio'
  } catch {
    return 'studio'
  }
}

export function setPortal(p: Portal) {
  try {
    localStorage.setItem(KEY, p)
  } catch {
    // Private mode: the choice lasts until the page reloads.
  }
  current = p
  listeners.forEach((l) => l())
}

let current: Portal = typeof window === 'undefined' ? 'studio' : read()

export function usePortal(): Portal {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
