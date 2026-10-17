import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookingError, newId, type State, type User } from './model'
import { createStudio, joinStudio, matchesSearch, slugify, syncAccounts, type Account, type NewStudioInput, type Platform, type StudioHit, type CreditSummary, summarizeCredits } from './platform'
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

export interface PlatformStore {
  /** 'demo' keeps everything in this browser with sample studios; 'cloud' uses Firebase. */
  mode: 'demo' | 'cloud'
  /** False until the sign-in state and studio list have loaded. */
  ready: boolean
  platform: Platform
  account: Account | null
  /** Cloud: whether the signed-in email is verified (needed to claim records a studio added). */
  emailVerified: boolean
  login: (email: string, password: string) => Promise<string | null>
  signup: (name: string, email: string, password: string) => Promise<string | null>
  logout: () => void
  resetDemo: () => void
  resetPassword: (email: string) => Promise<string | null>
  resendVerification: () => Promise<string | null>
  /** Creates a studio owned by the signed-in account; returns its slug, or an error message. */
  createStudio: (input: NewStudioInput) => Promise<{ slug?: string; error?: string }>
  joinStudio: (studioId: string) => void
  /** Saves the signed-in person's name, phone and birthday, here and at every studio they belong to. */
  /** Credits left per studio, across every studio this person belongs to (studios with credits only). */
  myCredits: () => Promise<CreditSummary[]>
  saveProfile: (input: { name: string; phone: string; birthday: string }) => Promise<string | null>
  /** The studio's DuitNow QR image (a data URL), or null when it hasn't uploaded one. */
  loadPaymentQr: (studioId: string) => Promise<string | null>
  /** Owners: saves (or with null, removes) the studio's DuitNow QR image. */
  savePaymentQr: (studioId: string, dataUrl: string | null) => Promise<string | null>
  /** Studios whose name has a word starting with each word typed (at least 3 letters). Never a full list. */
  searchStudios: (query: string) => Promise<StudioHit[]>
  /** Runs a model action against one studio; returns an error message instead of throwing. */
  applyTo: (studioId: string, action: (s: State) => State) => string | null
  /** Tells the store which studio is open, so it can load that studio's private records. */
  setActiveStudio: (studioId: string | null) => void
  /** The studio link being viewed, so the store can load that one studio (there is no public list of studios). */
  setViewSlug: (slug: string | null) => void
  /** Student portal: owners load only their own records there, like any member. */
  setStudentView: (on: boolean) => void
  /** The studio link whose lookup has finished (found or not); until it matches the open link, keep waiting. */
  resolvedSlug: string | null
  /** True once the open studio's records (for the signed-in person's role) have loaded. */
  activeReady: boolean
  /** A message from a background save that failed, shown as a banner. */
  notice: string | null
  dismissNotice: () => void
}

export const PlatformContext = createContext<PlatformStore | null>(null)

/** Everything in this browser, with demo studios. Used by `npm run dev` with VITE_DEMO=1 and for trying the app offline. */
export function LocalPlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<Platform>(load)
  // Every demo studio is already in memory, so a link is "looked up" as soon as it's opened.
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null)
  const [qrs, setQrs] = useState<Record<string, string>>({})
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
      mode: 'demo',
      ready: true,
      platform,
      account: platform.accounts.find((a) => a.id === accountId) ?? null,
      emailVerified: true,
      login,
      signup,
      resetPassword: async () => 'Password reset emails are only sent in the live app.',
      resendVerification: async () => null,
      setActiveStudio: () => {},
      setViewSlug: setResolvedSlug,
      setStudentView: () => {},
      resolvedSlug,
      activeReady: true,
      notice: null,
      dismissNotice: () => {},
      logout: () => setAccountId(null),
      resetDemo: () => {
        setPlatform(seedPlatform())
        setAccountId(null)
      },
      createStudio: async (input) => {
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
      myCredits: async () => {
        if (!accountId) return []
        return platform.studios
          .filter((s) => s.users.some((u) => u.id === accountId))
          .map((s) => summarizeCredits({ slug: s.studio.slug, name: s.studio.name, location: s.studio.location }, s.memberPackages.filter((p) => p.userId === accountId)))
          .filter((c) => c.classes > 0)
      },
      saveProfile: async ({ name, phone, birthday }) => {
        if (!accountId) return 'Sign in first.'
        if (!name.trim()) return 'Enter your name.'
        const patch = { name: name.trim(), phone: phone.trim(), birthday }
        setPlatform((p) => ({
          ...p,
          accounts: p.accounts.map((a) => (a.id === accountId ? { ...a, ...patch } : a)),
          studios: p.studios.map((s) => ({ ...s, users: s.users.map((u) => (u.id === accountId ? { ...u, ...patch } : u)) })),
        }))
        return null
      },
      loadPaymentQr: async (sid) => qrs[sid] ?? null,
      savePaymentQr: async (sid, dataUrl) => {
        setQrs(({ [sid]: _old, ...rest }) => (dataUrl ? { ...rest, [sid]: dataUrl } : rest))
        return null
      },
      searchStudios: async (q) =>
        slugify(q).replace(/-/g, '').length < 3
          ? []
          : platform.studios.filter((s) => matchesSearch(s.studio.name, q)).slice(0, 10).map((s) => ({ slug: s.studio.slug, name: s.studio.name, location: s.studio.location })),
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
    [platform, accountId, login, signup, resolvedSlug, qrs],
  )

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

/** Firebase in the deployed app; the in-browser demo when built with VITE_DEMO=1. */
export const DEMO = import.meta.env.VITE_DEMO === '1'

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
