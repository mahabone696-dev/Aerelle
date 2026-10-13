// Multi-studio layer. Each studio is a self-contained `State` (its own classes, members, packages,
// orders and reviews) and all booking rules in model.ts run inside one studio. What's shared across
// studios is the login: an Account can be a member of some studios and the owner of others.

import { BookingError, newId, type ClassType, type PackageOption, type State, type User } from './model'

export interface Account {
  id: string
  name: string
  email: string
  phone: string
  birthday: string
  passwordHash: string // '' until someone added by a studio sets their password
  joinedAt: string
}

export interface Platform {
  version: 3
  accounts: Account[]
  studios: State[]
}

export const slugify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'studio'

export function uniqueSlug(p: Platform, name: string, exceptId?: string) {
  const base = slugify(name)
  const taken = new Set(p.studios.filter((s) => s.studio.id !== exceptId).map((s) => s.studio.slug))
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}

/**
 * Search keys for a studio name: every 3+ letter start of each word ("aligne pilates" -> "ali", "alig", ...,
 * "pil", ..., "pilates"). Students find a studio by typing the start of any word in its name.
 */
export function searchTokens(name: string) {
  const out = new Set<string>()
  for (const word of slugify(name).split('-')) for (let n = 3; n <= Math.min(word.length, 20); n++) out.add(word.slice(0, n))
  return [...out].slice(0, 120)
}

/** Whether every word typed starts a word of the studio name. */
export function matchesSearch(name: string, query: string) {
  const words = slugify(name).split('-')
  return slugify(query).split('-').filter(Boolean).every((q) => words.some((w) => w.startsWith(q)))
}

export interface StudioHit { slug: string; name: string; location: string }

export const studioBySlug = (p: Platform, slug: string) => p.studios.find((s) => s.studio.slug === slug)

export const roleIn = (studio: State, accountId: string) => studio.users.find((u) => u.id === accountId)?.role ?? null

export function studiosFor(p: Platform, accountId: string) {
  return {
    owned: p.studios.filter((s) => roleIn(s, accountId) === 'owner'),
    joined: p.studios.filter((s) => roleIn(s, accountId) === 'member'),
  }
}

/** Where to land after signing in: your studio's admin, else the studio you book at, else the directory. */
export function homeFor(p: Platform, accountId: string) {
  const { owned, joined } = studiosFor(p, accountId)
  if (owned[0]) return `/s/${owned[0].studio.slug}/overview`
  if (joined[0]) return `/s/${joined[0].studio.slug}/schedule`
  return '/studios'
}

const memberFrom = (a: Account, role: User['role'], now: Date): User => ({
  id: a.id,
  name: a.name,
  email: a.email,
  phone: a.phone,
  birthday: a.birthday,
  passwordHash: '',
  role,
  joinedAt: now.toISOString(),
})

const updateStudio = (p: Platform, studioId: string, fn: (s: State) => State): Platform => ({
  ...p,
  studios: p.studios.map((s) => (s.studio.id === studioId ? fn(s) : s)),
})

/** Adds the account to a studio as a member (no-op if already in it). */
export function joinStudio(p: Platform, studioId: string, accountId: string, now = new Date()): Platform {
  const account = p.accounts.find((a) => a.id === accountId)
  if (!account) throw new BookingError('Account not found.')
  return updateStudio(p, studioId, (s) =>
    s.users.some((u) => u.id === accountId) ? s : { ...s, users: [...s.users, memberFrom(account, 'member', now)] },
  )
}

/**
 * Keeps studio member records and accounts in step after a studio-level change. A member added at a
 * studio's front desk gets a passwordless account (claimed later by signing up with the same email);
 * if that email already has an account, the new record is pointed at it instead of creating a duplicate.
 */
export function syncAccounts(p: Platform, studioId: string): Platform {
  const studio = p.studios.find((s) => s.studio.id === studioId)
  if (!studio) return p
  const accounts = [...p.accounts]
  const remap = new Map<string, string>()
  for (const u of studio.users) {
    if (accounts.some((a) => a.id === u.id)) continue
    const sameEmail = accounts.find((a) => a.email.toLowerCase() === u.email.toLowerCase())
    if (sameEmail && !studio.users.some((x) => x.id === sameEmail.id)) remap.set(u.id, sameEmail.id)
    else accounts.push({ id: u.id, name: u.name, email: u.email, phone: u.phone, birthday: u.birthday, passwordHash: '', joinedAt: u.joinedAt })
  }
  const next = remap.size
    ? updateStudio(p, studioId, (s) => ({ ...s, users: s.users.map((u) => (remap.has(u.id) ? { ...u, id: remap.get(u.id)! } : u)) }))
    : p
  return { ...next, accounts }
}

// ---------- Creating a studio ----------

export type Template = 'yoga' | 'pilates' | 'fitness' | 'dance' | 'martial' | 'cycling' | 'swim' | 'blank'

export const TEMPLATES: Record<Template, { label: string; types: [string, string][]; packs: [string, number, number, number, string[]][] }> = {
  pilates: {
    label: 'Pilates',
    types: [['Mat Pilates', 'Mat'], ['Reformer Pilates', 'Reformer'], ['Private Session', 'Private']],
    packs: [
      ['Mat Drop-in', 45, 1, 7, ['Mat']],
      ['Mat 10 Class Pack', 400, 10, 90, ['Mat']],
      ['Reformer Drop-in', 80, 1, 7, ['Reformer']],
      ['Reformer 10 Class Pack', 700, 10, 90, ['Reformer']],
      ['Private Session', 180, 1, 30, ['Private']],
    ],
  },
  yoga: {
    label: 'Yoga',
    types: [['Vinyasa Flow', 'Yoga'], ['Yin Yoga', 'Yoga'], ['Hot Yoga', 'Heated'], ['Meditation', 'Wellness']],
    packs: [
      ['Drop-in', 40, 1, 7, ['Yoga', 'Wellness']],
      ['5 Class Pack', 180, 5, 60, ['Yoga', 'Wellness']],
      ['10 Class Pack', 330, 10, 90, ['Yoga', 'Heated', 'Wellness']],
      ['Hot Yoga Drop-in', 50, 1, 7, ['Heated']],
    ],
  },
  fitness: {
    label: 'Fitness / HIIT',
    types: [['HIIT', 'Conditioning'], ['Strength', 'Strength'], ['Spin', 'Cycle'], ['Boxing', 'Conditioning']],
    packs: [
      ['Drop-in', 35, 1, 7, ['Conditioning', 'Strength', 'Cycle']],
      ['10 Class Pack', 300, 10, 90, ['Conditioning', 'Strength', 'Cycle']],
      ['Unlimited Month', 399, 60, 30, ['Conditioning', 'Strength', 'Cycle']],
    ],
  },
  dance: {
    label: 'Dance',
    types: [['Hip Hop', 'Dance'], ['Contemporary', 'Dance'], ['K-Pop Choreo', 'Dance'], ['Kids Ballet', 'Kids']],
    packs: [
      ['Drop-in', 45, 1, 7, ['Dance']],
      ['8 Class Pass', 320, 8, 60, ['Dance']],
      ['Kids Term (10 weeks)', 380, 10, 75, ['Kids']],
    ],
  },
  martial: {
    label: 'Martial arts',
    types: [['Muay Thai', 'Striking'], ['Brazilian Jiu-Jitsu', 'Grappling'], ['Kids Taekwondo', 'Kids'], ['Open Mat', 'Grappling']],
    packs: [
      ['Trial Class', 30, 1, 7, ['Striking', 'Grappling']],
      ['Monthly Unlimited', 350, 60, 30, ['Striking', 'Grappling']],
      ['Kids Monthly', 220, 8, 30, ['Kids']],
    ],
  },
  cycling: {
    label: 'Indoor cycling',
    types: [['Rhythm Ride', 'Ride'], ['Endurance Climb', 'Ride'], ['Ride + Core', 'Ride']],
    packs: [
      ['Single Ride', 38, 1, 14, ['Ride']],
      ['10 Ride Pack', 340, 10, 120, ['Ride']],
    ],
  },
  swim: {
    label: 'Swim school',
    types: [['Babies & Toddlers', 'Kids'], ['Learn to Swim', 'Kids'], ['Adult Stroke Clinic', 'Adults']],
    packs: [
      ['Kids Term (10 lessons)', 400, 10, 90, ['Kids']],
      ['Adult 5 Lessons', 250, 5, 60, ['Adults']],
    ],
  },
  blank: { label: 'Something else', types: [['Group Class', 'Group']], packs: [['Drop-in', 30, 1, 7, ['Group']]] },
}

export interface NewStudioInput {
  name: string
  location: string
  currency: string
  cancelHours: number
  description: string
  template: Template
}

export function createStudio(p: Platform, ownerId: string, input: NewStudioInput, now = new Date()) {
  const owner = p.accounts.find((a) => a.id === ownerId)
  if (!owner) throw new BookingError('Sign in to create a studio.')
  const name = input.name.trim()
  if (name.length < 2) throw new BookingError('Give your studio a name.')
  if (!input.location.trim()) throw new BookingError('Add a location so members can find you.')
  if (!input.currency.trim()) throw new BookingError('Pick a currency.')
  if (!(input.cancelHours >= 0 && input.cancelHours <= 168)) throw new BookingError('Cancellation window must be 0–168 hours.')
  const t = TEMPLATES[input.template]
  const classTypes: ClassType[] = t.types.map(([n, group]) => ({ id: newId(), name: n, group }))
  const packageOptions: PackageOption[] = t.packs.map(([n, price, classes, validDays, groups]) => ({
    id: newId(), name: n, price, classes, validDays, groups, hidden: false, trial: false, recurring: false, description: '',
  }))
  const slug = uniqueSlug(p, name)
  const studio: State = {
    version: 2,
    studio: {
      id: newId(),
      slug,
      name,
      location: input.location.trim(),
      currency: input.currency.trim().toUpperCase(),
      cancelHours: input.cancelHours,
      email: owner.email,
      phone: '',
      description: input.description.trim(),
    },
    classTypes,
    staff: [{ id: newId(), name: owner.name, role: 'Manager', email: owner.email, showOnSite: false }],
    users: [memberFrom(owner, 'owner', now)],
    sessions: [],
    bookings: [],
    ratings: [],
    packageOptions,
    memberPackages: [],
    orders: [],
    promoCodes: [],
  }
  return { platform: { ...p, studios: [...p.studios, studio] }, slug }
}
