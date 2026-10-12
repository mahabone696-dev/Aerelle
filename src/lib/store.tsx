import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookingError, newId, type State, type User } from './model'
import { createStudio, joinStudio, syncAccounts, type Account, type NewStudioInput, type Platform } from './platform'
import { seedPlatform } from './seed'

// Local-only persistence. Swap load/save for API calls to put this behind a real backend;
// every mutation goes through `run` (platform) or `apply` (one studio), the only write paths.

const STATE_KEY = 'aerelle.platform.v3'
const SESSION_KEY = 'aerelle.session.v1'

function load(): Platform {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Platform) : null
    if (parsed?.version === 3) return parsed
  } catch {
    // Corrupt or blocked storage: fall through to fresh demo data.
  }
  return seedPlatform()
}

function save(p: Platform) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(p))
  } catch {
    // Storage full or blocked; the app keeps working in memory.
  }
}

export async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(`aerelle:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const toError = (e: unknown) => {
  if (e instanceof BookingError) return e.message
  throw e
}

// ---------- Platform: accounts and the list of studios ----------

interface PlatformStore {
  platform: Platform
  account: Account | null
  login: (email: string, password: string) => Promise<string | null>
  signup: (name: string, email: string, password: string) => Promise<string | null>
  logout: () => void
  resetDemo: () => void
  /** Creates a studio owned by the signed-in account; returns its slug, or an error message. */
  createStudio: (input: NewStudioInput) => { slug?: string; error?: string }
  joinStudio: (studioId: string) => void
  /** Runs a model action against one studio; returns an error message instead of throwing. */
  applyTo: (studioId: string, action: (s: State) => State) => string | null
}

const PlatformContext = createContext<PlatformStore | null>(null)

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<Platform>(load)
  const [accountId, setAccountId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => save(platform), [platform])
  useEffect(() => {
    try {
      if (accountId) localStorage.setItem(SESSION_KEY, accountId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
  }, [accountId])

  const findByEmail = useCallback(
    (email: string) => platform.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase()),
    [platform.accounts],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const account = findByEmail(email)
      if (account && !account.passwordHash) return 'A studio added you. Choose "Create account" with this email to set a password.'
      if (!account || account.passwordHash !== (await hashPassword(password))) return 'Email or password is incorrect.'
      setAccountId(account.id)
      return null
    },
    [findByEmail],
  )

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase()
      if (!name.trim()) return 'Enter your name.'
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return 'Enter a valid email.'
      if (password.length < 8) return 'Password must be at least 8 characters.'
      const passwordHash = await hashPassword(password)
      const existing = findByEmail(cleanEmail)
      // People added by a studio have no password yet; signing up claims that account.
      if (existing?.passwordHash) return 'An account with that email exists.'
      if (existing) {
        setPlatform((p) => ({ ...p, accounts: p.accounts.map((a) => (a.id === existing.id ? { ...a, passwordHash } : a)) }))
        setAccountId(existing.id)
        return null
      }
      const account: Account = { id: newId(), name: name.trim(), email: cleanEmail, phone: '', birthday: '', passwordHash, joinedAt: new Date().toISOString() }
      setPlatform((p) => ({ ...p, accounts: [...p.accounts, account] }))
      setAccountId(account.id)
      return null
    },
    [findByEmail],
  )

  const value = useMemo<PlatformStore>(
    () => ({
      platform,
      account: platform.accounts.find((a) => a.id === accountId) ?? null,
      login,
      signup,
      logout: () => setAccountId(null),
      resetDemo: () => {
        setPlatform(seedPlatform())
        setAccountId(null)
      },
      createStudio: (input) => {
        if (!accountId) return { error: 'Sign in to create a studio.' }
        try {
          const { platform: next, slug } = createStudio(platform, accountId, input)
          setPlatform(next)
          return { slug }
        } catch (e) {
          return { error: toError(e) }
        }
      },
      joinStudio: (studioId) => accountId && setPlatform((p) => joinStudio(p, studioId, accountId)),
      applyTo: (studioId, action) => {
        try {
          const current = platform.studios.find((s) => s.studio.id === studioId)
          if (!current) throw new BookingError('Studio not found.')
          const next = action(current)
          setPlatform(syncAccounts({ ...platform, studios: platform.studios.map((s) => (s.studio.id === studioId ? next : s)) }, studioId))
          return null
        } catch (e) {
          return toError(e)
        }
      },
    }),
    [platform, accountId, login, signup],
  )

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform() {
  const p = useContext(PlatformContext)
  if (!p) throw new Error('usePlatform must be used inside PlatformProvider')
  return p
}

// ---------- One studio: what every studio page reads and writes ----------

interface StudioStore {
  state: State
  /** The signed-in person's record in this studio (their role here), or null if they haven't joined. */
  user: User | null
  apply: (action: (s: State) => State) => string | null
  logout: () => void
  resetDemo: () => void
}

const StudioContext = createContext<StudioStore | null>(null)

export function StudioScope({ studio, children }: { studio: State; children: ReactNode }) {
  const { account, applyTo, logout, resetDemo } = usePlatform()
  const id = studio.studio.id
  const value = useMemo<StudioStore>(
    () => ({
      state: studio,
      user: account ? studio.users.find((u) => u.id === account.id) ?? null : null,
      apply: (action) => applyTo(id, action),
      logout,
      resetDemo,
    }),
    [studio, account, applyTo, id, logout, resetDemo],
  )
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStore() {
  const store = useContext(StudioContext)
  if (!store) throw new Error('useStore must be used inside a StudioScope')
  return store
}
