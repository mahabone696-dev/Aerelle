import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookingError, newId, type State, type User } from './model'
import { seedState } from './seed'

// Local-only persistence. Swap load/save for API calls to put this behind a real backend;
// every mutation already goes through `apply`, which is the single write path.

const STATE_KEY = 'aerelle.state.v2'
const SESSION_KEY = 'aerelle.session.v1'

function load(): State {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    const parsed = raw ? (JSON.parse(raw) as State) : null
    if (parsed?.version === 2) return parsed
  } catch {
    // Corrupt or blocked storage: fall through to fresh demo data.
  }
  return seedState()
}

function save(state: State) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked; the app keeps working in memory.
  }
}

export async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(`aerelle:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface Store {
  state: State
  user: User | null
  /** Runs a model action; returns an error message instead of throwing. */
  apply: (action: (s: State) => State) => string | null
  login: (email: string, password: string) => Promise<string | null>
  signup: (name: string, email: string, password: string) => Promise<string | null>
  logout: () => void
  resetDemo: () => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)
  const [userId, setUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => save(state), [state])
  useEffect(() => {
    try {
      if (userId) localStorage.setItem(SESSION_KEY, userId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
  }, [userId])

  const apply = useCallback(
    (action: (s: State) => State) => {
      try {
        setState(action(state))
        return null
      } catch (e) {
        if (e instanceof BookingError) return e.message
        throw e
      }
    },
    [state],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      if (user && !user.passwordHash) return 'Your studio added you. Choose "Create account" with this email to set a password.'
      if (!user || user.passwordHash !== (await hashPassword(password))) return 'Email or password is incorrect.'
      setUserId(user.id)
      return null
    },
    [state.users],
  )

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase()
      if (!name.trim()) return 'Enter your name.'
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return 'Enter a valid email.'
      if (password.length < 8) return 'Password must be at least 8 characters.'
      const passwordHash = await hashPassword(password)
      const existing = state.users.find((u) => u.email.toLowerCase() === cleanEmail)
      // Members added at the front desk have no password yet; signing up claims that record.
      if (existing?.passwordHash) return 'An account with that email exists.'
      if (existing) {
        setState((s) => ({ ...s, users: s.users.map((u) => (u.id === existing.id ? { ...u, passwordHash } : u)) }))
        setUserId(existing.id)
        return null
      }
      const user: User = {
        id: newId(),
        name: name.trim(),
        email: cleanEmail,
        phone: '',
        birthday: '',
        passwordHash,
        role: 'member',
        joinedAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, users: [...s.users, user] }))
      setUserId(user.id)
      return null
    },
    [state.users],
  )

  const value = useMemo<Store>(
    () => ({
      state,
      user: state.users.find((u) => u.id === userId) ?? null,
      apply,
      login,
      signup,
      logout: () => setUserId(null),
      resetDemo: () => {
        setState(seedState())
        setUserId(null)
      },
    }),
    [state, userId, apply, login, signup],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}
