import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword,
  signOut, updateProfile, type User as FbUser,
} from 'firebase/auth'
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, runTransaction, setDoc, where, writeBatch, type DocumentData, type Query,
  type Unsubscribe, type WriteBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import {
  BookingError, claimWaitlistSpot, spotsLeft, waitlist, type Booking, type ClassType, type MemberPackage, type Order,
  type PackageOption, type PromoCode, type Rating, type Session, type Staff, type State, type Studio, type User,
} from './model'
import { createStudio as buildStudio, matchesSearch, searchTokens, slugify, type Account, type CreditSummary, type Platform, type StudioHit, summarizeCredits } from './platform'
import { PlatformContext, type PlatformStore } from './store'

// Firebase-backed store. The booking rules in model.ts stay pure: every change is computed on a State
// assembled from Firestore, then the difference is written back in one atomic batch that firestore.rules
// checks. Members only ever load their own records plus the public timetable; other people's spots appear
// as anonymous placeholders so "spots left" and waitlist positions still work.
//
// Privacy: there is no list of studios. The app loads only the studio whose link is open (looked up by its
// link name) and the studios the signed-in person belongs to; the rules refuse listing studios or timetables.

interface StudioDoc extends Studio {
  classTypes: ClassType[]
  staff: Staff[]
  packageOptions: PackageOption[]
  ownerUids: string[]
}
type SessionDoc = Session & { booked: string[]; waitlist: string[] }

const OTHER = '~other' // userId of anonymous placeholder bookings in a member's view
const COLLECTIONS = ['members', 'bookings', 'packages', 'orders', 'promos'] as const
type Coll = (typeof COLLECTIONS)[number]

// ---------- conversions ----------

const STUDIO_FIELDS = ['id', 'slug', 'name', 'location', 'currency', 'cancelHours', 'email', 'phone', 'description'] as const
const toStudio = (d: StudioDoc): Studio => ({
  ...(Object.fromEntries(STUDIO_FIELDS.map((k) => [k, d[k] ?? ''])) as unknown as Studio),
  ...(d.duitnowEnabled ? { duitnowEnabled: true } : {}),
  ...(d.duitnowName ? { duitnowName: d.duitnowName } : {}),
})
const strip = <T,>(data: DocumentData, drop: string[] = []): T => {
  const out = { ...data }
  for (const k of ['studioId', ...drop]) delete out[k]
  return out as T
}
const toSession = (d: SessionDoc): Session => strip<Session>(d, ['booked', 'waitlist'])
// The app never sees passwords; a non-empty passwordHash just marks "has signed in to Aerelle" (claimed),
// which the Members page uses for its "No login" badge.
const toUser = (d: DocumentData): User => ({ ...strip<User>(d, ['claimed']), passwordHash: d.claimed ? 'account' : '' })
const memberDoc = (u: User) => ({ id: u.id, name: u.name, email: u.email.toLowerCase(), phone: u.phone, birthday: u.birthday, role: u.role, joinedAt: u.joinedAt })

/**
 * Firestore batches hold at most 500 writes. Small changes (every member action) stay one atomic batch,
 * which the rules rely on; a big owner change, like new credits for a year of classes, is split.
 */
async function commitInChunks(fill: (batch: WriteBatch) => void, size = 450) {
  const ops: ((b: WriteBatch) => void)[] = []
  const recorder = {
    set: (...a: unknown[]) => { ops.push((b) => (b.set as (...x: unknown[]) => void)(...a)); return recorder },
    update: (...a: unknown[]) => { ops.push((b) => (b.update as (...x: unknown[]) => void)(...a)); return recorder },
    delete: (...a: unknown[]) => { ops.push((b) => (b.delete as (...x: unknown[]) => void)(...a)); return recorder },
  }
  fill(recorder as unknown as WriteBatch)
  for (let i = 0; i < ops.length; i += size) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + size)) op(batch)
    await batch.commit()
  }
}

/** Stable JSON for change detection: sorted keys, undefined dropped. */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val).sort().filter((k) => val[k] !== undefined).map((k) => [k, val[k]]))
      : val,
  )
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code.includes('permission-denied')) return "That change couldn't be saved. The class may have just filled up, or your access has changed. Please try again."
  if (code.includes('unavailable')) return "You're offline. Changes will save when you reconnect."
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email or password is incorrect.'
  if (code === 'auth/email-already-in-use') return 'An account with that email exists. Sign in, or reset your password.'
  if (code === 'auth/weak-password') return 'Password must be at least 8 characters.'
  if (code === 'auth/invalid-email') return 'Enter a valid email.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment, or reset your password.'
  if (code === 'auth/network-request-failed') return 'No connection. Check your internet and try again.'
  return 'Something went wrong. Please try again.'
}

/** Keeps the stored order of taken spots, drops released ones and appends new ones (oldest first). */
function nextIds(current: string[], bookings: Booking[], status: Booking['status']) {
  const want = bookings.filter((b) => b.status === status).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const wantIds = new Set(want.map((b) => b.id))
  const kept = current.filter((id) => wantIds.has(id))
  return [...kept, ...want.map((b) => b.id).filter((id) => !kept.includes(id))]
}

// ---------- provider ----------

interface Active {
  sid: string
  owner: boolean
  data: Partial<Record<Coll, DocumentData[]>>
}

export function CloudPlatformProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FbUser | null>(null)
  const [verified, setVerified] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [accountDoc, setAccountDoc] = useState<Account | null>(null)
  const [studios, setStudios] = useState<Record<string, StudioDoc>>({})
  const [sessions, setSessions] = useState<Record<string, SessionDoc[]>>({})
  // Studios whose profile has arrived (or turned out not to exist), so the app knows loading is done.
  const [seen, setSeen] = useState<Record<string, true>>({})
  const [ratings, setRatings] = useState<Record<string, Rating[]>>({})
  const [mine, setMine] = useState<Record<string, User> | null>(null)
  // Which account `mine` belongs to. Right after signing in, `mine` still holds the signed-out value for one
  // render; without this the app would route the new account as if it had no studios.
  const [mineUid, setMineUid] = useState<string | null>(null)
  const [activeSid, setActiveSid] = useState<string | null>(null)
  // The studio link being viewed ("aligne-pilates"), and the studio id it resolves to (undefined while looking it up).
  const [viewSlug, setViewSlug] = useState<string | null>(null)
  // True in the student portal: owners then load only their own records, like any member.
  const [studentView, setStudentView] = useState(false)
  const [slugSid, setSlugSid] = useState<{ slug: string; sid: string | null } | null>(null)
  const [active, setActive] = useState<Active | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const uid = fbUser?.uid ?? null

  // Sign-in state. Verification status lives in the ID token, which the security rules read.
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setFbUser(u)
        setVerified(!!u?.emailVerified)
        setAuthReady(true)
      }),
    [],
  )
  // After someone clicks the verification link in their email, pick it up when they return to the tab.
  useEffect(() => {
    const check = async () => {
      const u = auth.currentUser
      if (!u) return
      if (u.emailVerified) return setVerified(true)
      await u.reload().catch(() => {})
      if (auth.currentUser?.emailVerified) {
        await auth.currentUser.getIdToken(true)
        setVerified(true)
      }
    }
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  // The studio link being viewed: look up which studio it belongs to.
  useEffect(() => {
    if (!viewSlug) return
    let cancelled = false
    getDoc(doc(db, 'slugs', viewSlug))
      .then((d) => !cancelled && setSlugSid({ slug: viewSlug, sid: d.exists() ? (d.data().studioId as string) : null }))
      .catch(() => !cancelled && setSlugSid({ slug: viewSlug, sid: null }))
    return () => {
      cancelled = true
    }
  }, [viewSlug])
  const viewSid = viewSlug && slugSid?.slug === viewSlug ? slugSid.sid : null
  const slugPending = !!viewSlug && slugSid?.slug !== viewSlug

  // Load only the studios this person needs: the one whose link is open, plus their own.
  const wanted = useMemo(() => [...new Set([...(viewSid ? [viewSid] : []), ...Object.keys(mine ?? {})])].sort(), [viewSid, mine])
  // Studios whose full timetable history this person needs (owners in the studio portal, for reports).
  // Everyone else loads classes from the last 180 days onward, which keeps phones fast.
  const fullHistory = useMemo(
    () => (studentView ? [] : Object.entries(mine ?? {}).filter(([, u]) => u.role === 'owner').map(([sid]) => sid)).sort(),
    [mine, studentView],
  )
  const wantedKey = wanted.join(',') + '|' + fullHistory.join(',')
  useEffect(() => {
    const subs: Unsubscribe[] = []
    for (const sid of wanted) {
      subs.push(
        onSnapshot(
          doc(db, 'studios', sid),
          (d) => {
            setStudios((all) => {
              const next = { ...all }
              if (d.exists()) next[sid] = d.data() as StudioDoc
              else delete next[sid]
              return next
            })
            setSeen((all) => ({ ...all, [sid]: true }))
          },
          () => setSeen((all) => ({ ...all, [sid]: true })),
        ),
        onSnapshot(
          fullHistory.includes(sid)
            ? collection(db, `studios/${sid}/sessions`)
            : query(collection(db, `studios/${sid}/sessions`), where('start', '>=', new Date(Date.now() - 180 * 86_400_000).toISOString())),
          (snap) => setSessions((all) => ({ ...all, [sid]: snap.docs.map((x) => x.data() as SessionDoc) })),
          () => setSessions((all) => ({ ...all, [sid]: [] })),
        ),
        onSnapshot(collection(db, `studios/${sid}/ratings`), (snap) =>
          setRatings((all) => ({ ...all, [sid]: snap.docs.map((x) => strip<Rating>(x.data())) })),
        ),
      )
    }
    // Forget studios no longer needed (e.g. after signing out).
    const keep = new Set(wanted)
    const prune = <T,>(all: Record<string, T>) => Object.fromEntries(Object.entries(all).filter(([k]) => keep.has(k)))
    setStudios(prune)
    setSessions(prune)
    setRatings(prune)
    // Also forget that dropped studios had loaded, so signing in again waits for them to load afresh
    // (otherwise the app routed before your studios arrived and sent you to the wrong place).
    setSeen(prune)
    return () => subs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey])
  const studiosLoaded = wanted.every((sid) => seen[sid] && (!studios[sid] || sessions[sid] !== undefined))

  // The signed-in person's profile and studio memberships.
  useEffect(() => {
    setAccountDoc(null)
    setMine(uid ? null : {})
    // Signed out: forget whose memberships these were, so signing back in (even as the same account)
    // waits for that account's studios instead of routing on the empty signed-out list.
    if (!uid) {
      setMineUid(null)
      return
    }
    const subs = [
      onSnapshot(doc(db, 'accounts', uid), (d) => setAccountDoc(d.exists() ? (d.data() as Account) : null)),
      onSnapshot(
        query(collectionGroup(db, 'members'), where('id', '==', uid)),
        (snap) => {
          setMine(Object.fromEntries(snap.docs.map((d) => [d.ref.parent.parent!.id, toUser(d.data())])))
          setMineUid(uid)
        },
        (e) => {
          // Never leave the app waiting: carry on without memberships and say so.
          setMine({})
          setMineUid(uid)
          setNotice(friendly(e))
        },
      ),
    ]
    return () => subs.forEach((u) => u())
  }, [uid])

  // Private records of the open studio: everything for owners, only their own for members.
  const ownerOfActive = !!(uid && activeSid && !studentView && studios?.[activeSid]?.ownerUids?.includes(uid))
  useEffect(() => {
    setActive(null)
    if (!uid || !activeSid || !studios?.[activeSid]) return
    const sid = activeSid
    const base = `studios/${sid}`
    const sources: [Coll, Query][] = ownerOfActive
      ? COLLECTIONS.map((c) => [c, query(collection(db, `${base}/${c}`))])
      : [
          ['bookings', query(collection(db, `${base}/bookings`), where('userId', '==', uid))],
          ['packages', query(collection(db, `${base}/packages`), where('userId', '==', uid))],
          ['orders', query(collection(db, `${base}/orders`), where('userId', '==', uid))],
          ['promos', query(collection(db, `${base}/promos`))],
        ]
    setActive({ sid, owner: ownerOfActive, data: {} })
    const subs = sources.map(([c, q]) =>
      onSnapshot(
        q,
        (snap) => setActive((a) => (a && a.sid === sid ? { ...a, data: { ...a.data, [c]: snap.docs.map((d) => d.data()) } } : a)),
        () => setActive((a) => (a && a.sid === sid ? { ...a, data: { ...a.data, [c]: [] } } : a)),
      ),
    )
    return () => subs.forEach((u) => u())
    // studios is only needed to know the studio exists; ownership changes are covered by ownerOfActive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, activeSid, ownerOfActive, !!studios?.[activeSid ?? '']])

  const account: Account | null = useMemo(() => {
    if (!fbUser) return null
    return (
      accountDoc ?? {
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Member',
        email: (fbUser.email ?? '').toLowerCase(),
        phone: '',
        birthday: '',
        passwordHash: '',
        joinedAt: fbUser.metadata.creationTime ? new Date(fbUser.metadata.creationTime).toISOString() : new Date().toISOString(),
      }
    )
  }, [fbUser, accountDoc])

  /** One studio as the booking rules expect it, limited to what this person may see. */
  const buildState = useCallback(
    (sid: string): State => {
      const meta = studios![sid]
      const sessDocs = sessions?.[sid] ?? []
      const isActive = active?.sid === sid
      const data = isActive ? active!.data : {}
      const ownBookings = (data.bookings ?? []).map((d) => strip<Booking>(d))
      let bookings = ownBookings
      if (!(isActive && active!.owner)) {
        // Other people's spots, without who they are (also for visitors who haven't signed in).
        const ownIds = new Set(ownBookings.map((b) => b.id))
        const others: Booking[] = []
        for (const s of sessDocs) {
          for (const id of s.booked ?? []) if (!ownIds.has(id)) others.push({ id, userId: OTHER, sessionId: s.id, status: 'booked', createdAt: '' })
          const list = s.waitlist ?? []
          const anchor = list.findIndex((id) => ownIds.has(id))
          const anchorTime = anchor >= 0 ? new Date(ownBookings.find((b) => b.id === list[anchor])!.createdAt).getTime() : 0
          list.forEach((id, i) => {
            if (!ownIds.has(id)) {
              others.push({ id, userId: OTHER, sessionId: s.id, status: 'waitlisted', createdAt: new Date(anchorTime + (i - Math.max(anchor, 0)) * 1000).toISOString() })
            }
          })
        }
        bookings = [...ownBookings, ...others]
      }
      const users = isActive && active!.owner ? (data.members ?? []).map(toUser) : mine?.[sid] ? [mine[sid]] : []
      return {
        version: 2,
        studio: toStudio(meta),
        classTypes: meta.classTypes ?? [],
        staff: meta.staff ?? [],
        packageOptions: meta.packageOptions ?? [],
        users,
        sessions: sessDocs.map(toSession),
        bookings,
        ratings: ratings[sid] ?? [],
        memberPackages: (data.packages ?? []).map((d) => strip<MemberPackage>(d)),
        orders: (data.orders ?? []).map((d) => strip<Order>(d)),
        promoCodes: (data.promos ?? []).map((d) => strip<PromoCode>(d)),
      }
    },
    [studios, sessions, ratings, mine, active],
  )

  const platform: Platform = useMemo(
    () => ({ version: 3, accounts: account ? [account] : [], studios: studios ? Object.keys(studios).map(buildState) : [] }),
    [studios, buildState, account],
  )

  /** Adds the writes that turn `prev` into `next` to a batch. */
  const diffInto = useCallback(
    (batch: WriteBatch, sid: string, prev: State, next: State) => {
      const base = `studios/${sid}`
      const owner = active?.sid === sid && active.owner
      const metaOf = (s: State) => ({ ...s.studio, classTypes: s.classTypes, staff: s.staff, packageOptions: s.packageOptions })
      if (canon(metaOf(prev)) !== canon(metaOf(next))) batch.update(doc(db, base), metaOf(next))

      const sync = <T extends { id: string }>(coll: Coll | 'ratings', before: T[], after: T[], toDoc: (x: T) => object) => {
        const old = new Map(before.map((x) => [x.id, x]))
        for (const x of after) {
          const was = old.get(x.id)
          if (!was || canon(was) !== canon(x)) batch.set(doc(db, `${base}/${coll}/${x.id}`), { ...toDoc(x), studioId: sid })
          old.delete(x.id)
        }
        for (const id of old.keys()) batch.delete(doc(db, `${base}/${coll}/${id}`))
      }
      const real = (bs: Booking[]) => bs.filter((b) => b.userId !== OTHER)
      const claimed = new Map((active?.data.members ?? []).map((m) => [m.id as string, m.claimed as boolean | undefined]))
      sync('members', prev.users, next.users, (u) => ({ ...memberDoc(u), claimed: claimed.get(u.id) ?? u.id === uid }))
      sync('bookings', real(prev.bookings), real(next.bookings), (b) => b)
      sync('packages', prev.memberPackages, next.memberPackages, (p) => p)
      sync('orders', prev.orders, next.orders, (o) => o)
      sync('ratings', prev.ratings, next.ratings, (r) => r)
      sync('promos', prev.promoCodes, next.promoCodes, (p) => p)

      // Timetable: session details (owners) and the lists of taken spots (anyone, for their own bookings).
      const docs = new Map((sessions?.[sid] ?? []).map((s) => [s.id, s]))
      const before = new Map(prev.sessions.map((s) => [s.id, s]))
      for (const s of next.sessions) {
        const cur = docs.get(s.id)
        const mineHere = next.bookings.filter((b) => b.sessionId === s.id)
        const booked = nextIds(cur?.booked ?? [], mineHere, 'booked')
        const wait = nextIds(cur?.waitlist ?? [], mineHere, 'waitlisted')
        const was = before.get(s.id)
        if (!was || canon(was) !== canon(s)) {
          if (owner) batch.set(doc(db, `${base}/sessions/${s.id}`), { ...s, studioId: sid, booked, waitlist: wait })
        } else if (canon(booked) !== canon(cur?.booked ?? []) || canon(wait) !== canon(cur?.waitlist ?? [])) {
          batch.update(doc(db, `${base}/sessions/${s.id}`), { booked, waitlist: wait })
        }
        before.delete(s.id)
      }
      for (const id of before.keys()) batch.delete(doc(db, `${base}/sessions/${id}`))
    },
    [active, sessions, uid],
  )

  const applyTo = useCallback(
    (sid: string, action: (s: State) => State) => {
      if (!studios?.[sid]) return 'Studio not found.'
      try {
        const prev = buildState(sid)
        const next = action(prev)
        commitInChunks((batch) => diffInto(batch, sid, prev, next)).catch((e) => setNotice(friendly(e)))
        return null
      } catch (e) {
        if (e instanceof BookingError) return e.message
        throw e
      }
    },
    [studios, buildState, diffInto],
  )

  // Members: when you're first in line and a spot opens, your device claims it.
  const attempted = useRef(new Set<string>())
  const joining = useRef(new Set<string>())

  // Owners keep their studio findable by name: one small entry per search key (searchIndex/{key}/studios/{sid}).
  // Each key can only be read by someone who types it, so studios still can't be listed.
  useEffect(() => {
    if (!uid || !active?.owner) return
    const sid = active.sid
    const meta = studios?.[sid] as (StudioDoc & { searchTokens?: string[]; indexedName?: string }) | undefined
    if (!meta?.name) return
    const tokens = searchTokens(meta.name)
    const entry = `${meta.name}|${meta.location}|${meta.slug}`
    if (meta.indexedName === entry) return
    const batch = writeBatch(db)
    for (const t of tokens) batch.set(doc(db, `searchIndex/${t}/studios/${sid}`), { sid, slug: meta.slug, name: meta.name, location: meta.location ?? '' })
    for (const t of meta.searchTokens ?? []) if (!tokens.includes(t)) batch.delete(doc(db, `searchIndex/${t}/studios/${sid}`))
    batch.update(doc(db, 'studios', sid), { searchTokens: tokens, indexedName: entry })
    batch.commit().catch(() => {})
  }, [uid, active?.owner, active?.sid, studios])
  useEffect(() => {
    if (!uid || !active || active.owner || !studios?.[active.sid] || !active.data.bookings || !active.data.packages) return
    const state = buildState(active.sid)
    const now = new Date()
    for (const b of state.bookings) {
      if (b.userId !== uid || b.status !== 'waitlisted') continue
      const s = state.sessions.find((x) => x.id === b.sessionId)
      if (!s || new Date(s.start) <= now || spotsLeft(state, s) === 0 || waitlist(state, s.id)[0]?.id !== b.id) continue
      const key = `${b.id}:${(sessions?.[active.sid] ?? []).find((x) => x.id === s.id)?.booked.length}`
      if (attempted.current.has(key)) continue
      attempted.current.add(key)
      const err = applyTo(active.sid, (st) => claimWaitlistSpot(st, uid, s.id, now))
      if (!err) setNotice(`Good news: a spot opened up and you're now booked into ${s.title}.`)
    }
  }, [uid, active, studios, sessions, buildState, applyTo])

  // Records a studio added for you before you signed up (same, verified email) become yours.
  useEffect(() => {
    if (!uid || !verified || !account?.email) return
    let cancelled = false
    ;(async () => {
      try {
        // Right after verifying, the database may not have the new "verified" sign-in token yet: refresh and retry once.
        const lookup = () => getDocs(query(collectionGroup(db, 'members'), where('email', '==', account.email.toLowerCase())))
        const found = await lookup().catch(async (e) => {
          if (!String((e as { code?: string })?.code).includes('permission-denied')) throw e
          await auth.currentUser?.getIdToken(true)
          await new Promise((r) => setTimeout(r, 1500))
          return lookup()
        })
        for (const m of found.docs) {
          const data = m.data()
          if (cancelled || data.id === uid || data.claimed) continue
          const sid = m.ref.parent.parent!.id
          const batch = writeBatch(db)
          for (const coll of ['bookings', 'packages', 'orders', 'ratings']) {
            const recs = await getDocs(query(collection(db, `studios/${sid}/${coll}`), where('userId', '==', data.id)))
            recs.forEach((r) => batch.update(r.ref, { userId: uid }))
          }
          batch.set(doc(db, `studios/${sid}/members/${uid}`), { ...data, id: uid, role: 'member', claimed: true, studioId: sid }, { merge: true })
          batch.delete(m.ref)
          await batch.commit()
        }
      } catch (e) {
        if (!cancelled) setNotice(friendly(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uid, verified, account?.email])

  const ready = authReady && !slugPending && (!uid || (!!mine && mineUid === uid)) && studiosLoaded
  const activeReady =
    !activeSid || !uid || !studios?.[activeSid]
      ? true
      : !!active && active.sid === activeSid && (active.owner ? COLLECTIONS : (['bookings', 'packages', 'orders', 'promos'] as Coll[])).every((c) => active.data[c])

  const value = useMemo<PlatformStore>(
    () => ({
      mode: 'cloud',
      ready,
      platform,
      account,
      emailVerified: verified,
      login: async (email, password) => {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password)
          return null
        } catch (e) {
          return friendly(e)
        }
      },
      signup: async (name, email, password) => {
        const clean = email.trim().toLowerCase()
        if (!name.trim()) return 'Enter your name.'
        if (!/^\S+@\S+\.\S+$/.test(clean)) return 'Enter a valid email.'
        if (password.length < 8) return 'Password must be at least 8 characters.'
        try {
          const cred = await createUserWithEmailAndPassword(auth, clean, password)
          await updateProfile(cred.user, { displayName: name.trim() })
          const acc: Account = { id: cred.user.uid, name: name.trim(), email: clean, phone: '', birthday: '', passwordHash: '', joinedAt: new Date().toISOString() }
          const { passwordHash: _omit, ...profile } = acc
          await setDoc(doc(db, 'accounts', cred.user.uid), profile)
          await sendEmailVerification(cred.user).catch(() => {})
          return null
        } catch (e) {
          return friendly(e)
        }
      },
      logout: () => void signOut(auth),
      resetDemo: () => {},
      resetPassword: async (email) => {
        try {
          await sendPasswordResetEmail(auth, email.trim())
          return null
        } catch (e) {
          return friendly(e)
        }
      },
      resendVerification: async () => {
        try {
          if (auth.currentUser) await sendEmailVerification(auth.currentUser)
          return null
        } catch (e) {
          return friendly(e)
        }
      },
      createStudio: async (input) => {
        if (!account || !uid) return { error: 'Sign in to create a studio.' }
        try {
          const { platform: next, slug } = buildStudio(platform, uid, input)
          const created = next.studios.at(-1)!
          const sid = created.studio.id
          const first = writeBatch(db)
          first.set(doc(db, 'slugs', slug), { studioId: sid, createdBy: uid })
          first.set(doc(db, 'studios', sid), {
            ...created.studio, classTypes: created.classTypes, staff: created.staff, packageOptions: created.packageOptions,
            ownerUids: [uid], createdAt: new Date().toISOString(),
          })
          await first.commit()
          await setDoc(doc(db, `studios/${sid}/members/${uid}`), { ...memberDoc(created.users[0]), claimed: true, studioId: sid })
          return { slug }
        } catch (e) {
          if (e instanceof BookingError) return { error: e.message }
          const code = (e as { code?: string })?.code ?? ''
          return { error: code.includes('permission-denied') ? 'That studio name is taken. Try a slightly different one.' : friendly(e) }
        }
      },
      myCredits: async () => {
        if (!uid) return []
        // Only the signed-in person's own packages, across their studios (allowed by the rules).
        const snap = await getDocs(query(collectionGroup(db, 'packages'), where('userId', '==', uid)))
        const bySid = new Map<string, MemberPackage[]>()
        for (const d of snap.docs) {
          const sid = d.ref.parent.parent!.id
          bySid.set(sid, [...(bySid.get(sid) ?? []), strip<MemberPackage>(d.data())])
        }
        const out: CreditSummary[] = []
        for (const [sid, pkgs] of bySid) {
          const meta = studios[sid] ?? (await getDoc(doc(db, 'studios', sid))).data()
          if (!meta) continue
          const c = summarizeCredits({ slug: meta.slug, name: meta.name, location: meta.location ?? '' }, pkgs)
          if (c.classes > 0) out.push(c)
        }
        return out.sort((a, b) => a.name.localeCompare(b.name))
      },
      saveProfile: async ({ name, phone, birthday }) => {
        if (!uid || !auth.currentUser || !account) return 'Sign in first.'
        if (!name.trim()) return 'Enter your name.'
        const patch = { name: name.trim(), phone: phone.trim(), birthday }
        try {
          const { passwordHash: _omit, ...profile } = { ...account, ...patch }
          await setDoc(doc(db, 'accounts', uid), profile, { merge: true })
          // Each studio you belong to sees the same details.
          const batch = writeBatch(db)
          for (const sid of Object.keys(mine ?? {})) batch.update(doc(db, `studios/${sid}/members/${uid}`), patch)
          await batch.commit()
          await updateProfile(auth.currentUser, { displayName: patch.name }).catch(() => {})
          return null
        } catch (e) {
          return friendly(e)
        }
      },
      loadPaymentQr: async (sid) => {
        try {
          return ((await getDoc(doc(db, `studios/${sid}/payment/duitnow`))).data()?.qr as string | undefined) ?? null
        } catch {
          return null
        }
      },
      savePaymentQr: async (sid, dataUrl) => {
        try {
          const ref = doc(db, `studios/${sid}/payment/duitnow`)
          if (dataUrl) await setDoc(ref, { qr: dataUrl, updatedAt: new Date().toISOString() })
          else await deleteDoc(ref)
          return null
        } catch (e) {
          return friendly(e)
        }
      },
      searchStudios: async (q) => {
        const words = slugify(q).split('-').filter((w) => w.length >= 3)
        if (!words.length) return []
        const key = words.sort((a, b) => b.length - a.length)[0].slice(0, 20)
        const snap = await getDocs(query(collection(db, `searchIndex/${key}/studios`), limit(20)))
        const hits: StudioHit[] = snap.docs.map((d) => ({ slug: d.data().slug, name: d.data().name, location: d.data().location ?? '' }))
        return hits.filter((h) => matchesSearch(h.name, q)).slice(0, 10)
      },
      joinStudio: (sid) => {
        if (!account || !uid) return
        // Never overwrite an existing membership (an owner's role, or details the studio entered):
        // only create one when this person has none at the studio yet.
        if (studios[sid]?.ownerUids?.includes(uid) || joining.current.has(sid)) return
        joining.current.add(sid)
        const ref = doc(db, `studios/${sid}/members/${uid}`)
        runTransaction(db, async (t) => {
          if ((await t.get(ref)).exists()) return
          const me: User = { ...account, id: uid, role: 'member', passwordHash: '', joinedAt: new Date().toISOString() }
          t.set(ref, { ...memberDoc(me), claimed: true, studioId: sid })
        })
          .catch((e) => setNotice(friendly(e)))
          .finally(() => joining.current.delete(sid))
      },
      applyTo,
      setActiveStudio: setActiveSid,
      setViewSlug,
      setStudentView,
      resolvedSlug: slugPending ? null : viewSlug,
      activeReady,
      notice,
      dismissNotice: () => setNotice(null),
    }),
    [ready, platform, account, verified, uid, applyTo, activeReady, notice, slugPending, viewSlug, studios, mine],
  )

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}
