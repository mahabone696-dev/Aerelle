// Pure studio rules. Every action takes the current state and returns a new one,
// or throws a BookingError with a message that can be shown to the user.

export type Role = 'member' | 'owner'
export type PaymentMethod = 'Card' | 'Online banking' | 'Cash' | 'Bank transfer' | 'Complimentary' | 'Pay at studio'
export type OrderSource = 'Online' | 'Front desk'
export type BookingStatus = 'booked' | 'waitlisted' | 'cancelled' | 'late-cancelled'
export type Attendance = 'attended' | 'no-show'

export interface Studio {
  id: string
  /** URL-safe name used in the studio's links, e.g. "aligne-pilates". */
  slug: string
  name: string
  location: string
  currency: string
  /** Cancelling at least this many hours before the start returns the class to the member's package. */
  cancelHours: number
  email: string
  phone: string
  description: string
}

/** A class type belongs to a group; packages unlock groups (e.g. a Reformer pack can't book Mat classes). */
export interface ClassType {
  id: string
  name: string
  group: string
}

export interface Staff {
  id: string
  name: string
  role: 'Instructor' | 'Front desk' | 'Manager'
  email: string
  showOnSite: boolean
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  birthday: string // YYYY-MM-DD, or '' when unknown
  passwordHash: string // '' for members added by staff who haven't claimed their account yet
  role: Role
  joinedAt: string
}

export interface Session {
  id: string
  title: string
  group: string
  instructor: string
  room: string
  start: string // ISO timestamp
  durationMin: number
  capacity: number
  cost: number // classes deducted from a package
  seriesId?: string
}

export interface PackageOption {
  id: string
  name: string
  price: number
  classes: number
  validDays: number
  groups: string[]
  hidden: boolean // only staff can assign it
  trial: boolean // one trial per member
  recurring: boolean // renews monthly
  description: string
}

export interface MemberPackage {
  id: string
  userId: string
  optionId: string
  name: string
  total: number
  remaining: number
  groups: string[]
  purchasedAt: string
  expiresAt: string
  orderId: string
}

export interface Order {
  id: string
  userId: string
  optionId: string
  name: string
  price: number
  discount: number
  net: number
  promo: string
  method: PaymentMethod
  source: OrderSource
  paid: boolean
  createdAt: string
}

export interface Booking {
  id: string
  userId: string
  sessionId: string
  status: BookingStatus
  createdAt: string
  packageId?: string
  attendance?: Attendance
  cancelledAt?: string
}

export interface Rating {
  id: string
  userId: string
  sessionId: string
  stars: number
  comment: string
  createdAt: string
}

export interface PromoCode {
  id: string
  code: string
  percentOff: number
  active: boolean
  maxUses: number // 0 = unlimited
  uses: number
}

export interface State {
  version: 2
  studio: Studio
  classTypes: ClassType[]
  staff: Staff[]
  users: User[]
  sessions: Session[]
  bookings: Booking[]
  ratings: Rating[]
  packageOptions: PackageOption[]
  memberPackages: MemberPackage[]
  orders: Order[]
  promoCodes: PromoCode[]
}

export class BookingError extends Error {}

export const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 12)

const DAY = 86_400_000
export const sessionEnd = (s: Session) => new Date(new Date(s.start).getTime() + s.durationMin * 60_000)

// ---------- Queries ----------

const activeBookings = (state: State, sessionId: string) =>
  state.bookings.filter((b) => b.sessionId === sessionId && b.status === 'booked')

export const spotsLeft = (state: State, session: Session) =>
  Math.max(0, session.capacity - activeBookings(state, session.id).length)

export const waitlist = (state: State, sessionId: string) =>
  state.bookings
    .filter((b) => b.sessionId === sessionId && b.status === 'waitlisted')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

export const userBooking = (state: State, userId: string, sessionId: string) =>
  state.bookings.find(
    (b) => b.userId === userId && b.sessionId === sessionId && (b.status === 'booked' || b.status === 'waitlisted'),
  )

export const isActivePackage = (p: MemberPackage, at: Date) => p.remaining > 0 && new Date(p.expiresAt) > at

/** Packages a member can use right now, soonest-expiring first. */
export const activePackages = (state: State, userId: string, now = new Date()) =>
  state.memberPackages
    .filter((p) => p.userId === userId && isActivePackage(p, now))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))

export const classesLeft = (state: State, userId: string, now = new Date()) =>
  activePackages(state, userId, now).reduce((n, p) => n + p.remaining, 0)

/** The package a booking would draw from: covers the class group, valid on the class date, soonest expiry first. */
export function packageFor(state: State, userId: string, session: Session, now = new Date()) {
  const start = new Date(session.start)
  return state.memberPackages
    .filter(
      (p) =>
        p.userId === userId &&
        p.remaining >= session.cost &&
        new Date(p.expiresAt) > start &&
        new Date(p.purchasedAt) <= now &&
        p.groups.includes(session.group),
    )
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0]
}

const getUser = (state: State, userId: string) => {
  const user = state.users.find((u) => u.id === userId)
  if (!user) throw new BookingError('Account not found.')
  return user
}

const getSession = (state: State, sessionId: string) => {
  const session = state.sessions.find((s) => s.id === sessionId)
  if (!session) throw new BookingError('That class no longer exists.')
  return session
}

const adjustPackage = (pkgs: MemberPackage[], id: string | undefined, delta: number) =>
  pkgs.map((p) => (p.id === id ? { ...p, remaining: p.remaining + delta } : p))

// ---------- Booking ----------

/** Books a spot, or joins the waitlist when the class is full. A class is deducted only for a confirmed spot. */
export function book(state: State, userId: string, sessionId: string, now = new Date()): State {
  getUser(state, userId)
  const session = getSession(state, sessionId)
  if (new Date(session.start) <= now) throw new BookingError('This class has already started.')
  if (userBooking(state, userId, sessionId)) throw new BookingError('You are already on this class.')

  const full = spotsLeft(state, session) === 0
  const pkg = packageFor(state, userId, session, now)
  if (!pkg) {
    throw new BookingError(`You need a package that covers ${session.group} classes on this date. Buy one first.`)
  }

  const booking: Booking = {
    id: newId(),
    userId,
    sessionId,
    status: full ? 'waitlisted' : 'booked',
    createdAt: now.toISOString(),
    packageId: full ? undefined : pkg.id,
  }
  return {
    ...state,
    memberPackages: full ? state.memberPackages : adjustPackage(state.memberPackages, pkg.id, -session.cost),
    bookings: [...state.bookings, booking],
  }
}

/**
 * Cancels a booking or leaves the waitlist. A confirmed spot cancelled early enough goes back to its package,
 * and the freed spot goes to the first waitlisted member with a usable package.
 */
export function cancel(state: State, userId: string, sessionId: string, now = new Date()): State {
  const session = getSession(state, sessionId)
  const booking = userBooking(state, userId, sessionId)
  if (!booking) throw new BookingError('You have no booking on this class.')
  if (new Date(session.start) <= now) throw new BookingError('This class has already started.')

  if (booking.status === 'waitlisted') {
    return {
      ...state,
      bookings: state.bookings.map((b) =>
        b.id === booking.id ? { ...b, status: 'cancelled', cancelledAt: now.toISOString() } : b,
      ),
    }
  }

  const refunded = isFreeCancel(state, session, now)
  const next: State = {
    ...state,
    memberPackages: refunded
      ? adjustPackage(state.memberPackages, booking.packageId, session.cost)
      : state.memberPackages,
    bookings: state.bookings.map((b) =>
      b.id === booking.id
        ? { ...b, status: refunded ? 'cancelled' : 'late-cancelled', cancelledAt: now.toISOString() }
        : b,
    ),
  }
  return promoteWaitlist(next, session, now)
}

export const isFreeCancel = (state: State, session: Session, now = new Date()) =>
  (new Date(session.start).getTime() - now.getTime()) / 3_600_000 >= state.studio.cancelHours

function promoteWaitlist(state: State, session: Session, now: Date): State {
  for (const entry of waitlist(state, session.id)) {
    if (spotsLeft(state, session) === 0) break
    const pkg = packageFor(state, entry.userId, session, now)
    if (!pkg) continue
    state = {
      ...state,
      memberPackages: adjustPackage(state.memberPackages, pkg.id, -session.cost),
      bookings: state.bookings.map((b) => (b.id === entry.id ? { ...b, status: 'booked', packageId: pkg.id } : b)),
    }
  }
  return state
}

/**
 * Moves a waitlisted member into a freed spot. Used by the member's own device: a member can't change other
 * people's bookings, so whoever is first in line claims the spot when they next open the app.
 */
export function claimWaitlistSpot(state: State, userId: string, sessionId: string, now = new Date()): State {
  const session = getSession(state, sessionId)
  const entry = userBooking(state, userId, sessionId)
  if (!entry || entry.status !== 'waitlisted') throw new BookingError('You are not on the waitlist for this class.')
  if (new Date(session.start) <= now) throw new BookingError('This class has already started.')
  if (waitlist(state, sessionId)[0]?.id !== entry.id) throw new BookingError('Someone is ahead of you on the waitlist.')
  if (spotsLeft(state, session) === 0) throw new BookingError('The class is still full.')
  const pkg = packageFor(state, userId, session, now)
  if (!pkg) throw new BookingError(`You need a package that covers ${session.group} classes on this date.`)
  return {
    ...state,
    memberPackages: adjustPackage(state.memberPackages, pkg.id, -session.cost),
    bookings: state.bookings.map((b) => (b.id === entry.id ? { ...b, status: 'booked', packageId: pkg.id } : b)),
  }
}

/** Staff check-in. Allowed from an hour before the class starts. */
export function markAttendance(state: State, bookingId: string, attendance: Attendance | undefined, now = new Date()) {
  const booking = state.bookings.find((b) => b.id === bookingId)
  if (!booking || booking.status !== 'booked') throw new BookingError('Only confirmed bookings can be checked in.')
  const session = getSession(state, booking.sessionId)
  if (new Date(session.start).getTime() - now.getTime() > 3_600_000) {
    throw new BookingError('Check-in opens an hour before class.')
  }
  return { ...state, bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, attendance } : b)) }
}

// ---------- Ratings ----------

/** Members can rate a class once, after it has ended, if they held a spot and weren't marked a no-show. */
export function canRate(state: State, userId: string, session: Session, now = new Date()) {
  return (
    sessionEnd(session) <= now &&
    state.bookings.some(
      (b) => b.userId === userId && b.sessionId === session.id && b.status === 'booked' && b.attendance !== 'no-show',
    ) &&
    !state.ratings.some((r) => r.userId === userId && r.sessionId === session.id)
  )
}

export function rate(state: State, userId: string, sessionId: string, stars: number, comment: string, now = new Date()) {
  const session = getSession(state, sessionId)
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new BookingError('Pick between 1 and 5 stars.')
  if (!canRate(state, userId, session, now)) throw new BookingError('You can only rate classes you attended, once.')
  const rating: Rating = { id: newId(), userId, sessionId, stars, comment: comment.trim(), createdAt: now.toISOString() }
  return { ...state, ratings: [...state.ratings, rating] }
}

export function averageRating(state: State, filter: (s: Session) => boolean = () => true) {
  const ids = new Set(state.sessions.filter(filter).map((s) => s.id))
  const ratings = state.ratings.filter((r) => ids.has(r.sessionId))
  if (!ratings.length) return null
  return { average: ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length, count: ratings.length }
}

/** Count of ratings per star, index 0 = 1 star. */
export const ratingDistribution = (state: State) =>
  [1, 2, 3, 4, 5].map((n) => state.ratings.filter((r) => r.stars === n).length)

// ---------- Packages and orders ----------

export function quote(state: State, optionId: string, promoCode = '') {
  const option = state.packageOptions.find((p) => p.id === optionId)
  if (!option) throw new BookingError('Unknown package.')
  const code = promoCode.trim().toUpperCase()
  let discount = 0
  if (code) {
    const promo = state.promoCodes.find((p) => p.code === code)
    if (!promo || !promo.active) throw new BookingError('That promo code is not valid.')
    if (promo.maxUses && promo.uses >= promo.maxUses) throw new BookingError('That promo code has been fully used.')
    discount = Math.round(option.price * promo.percentOff) / 100
  }
  return { option, price: option.price, discount, net: Math.max(0, option.price - discount), promo: code }
}

export const hasUsedTrial = (state: State, userId: string) =>
  state.orders.some((o) => o.userId === userId && state.packageOptions.find((p) => p.id === o.optionId)?.trial)

export interface PurchaseInput {
  promo?: string
  method?: PaymentMethod
  source?: OrderSource
  paid?: boolean
}

/** Sells a package. Members buy online; staff can also assign hidden packages and record unpaid ones. */
export function purchase(state: State, userId: string, optionId: string, input: PurchaseInput = {}, now = new Date()) {
  getUser(state, userId)
  const { option, price, discount, net, promo } = quote(state, optionId, input.promo)
  const source = input.source ?? 'Online'
  if (option.hidden && source === 'Online') throw new BookingError('This package is not available online.')
  if (option.trial && hasUsedTrial(state, userId)) throw new BookingError('Trial packages are one per member.')

  const order: Order = {
    id: newId(),
    userId,
    optionId,
    name: option.name,
    price,
    discount,
    net,
    promo,
    method: input.method ?? (net === 0 ? 'Complimentary' : 'Card'),
    source,
    paid: input.paid ?? true,
    createdAt: now.toISOString(),
  }
  const pkg: MemberPackage = {
    id: newId(),
    userId,
    optionId,
    name: option.name,
    total: option.classes,
    remaining: option.classes,
    groups: option.groups,
    purchasedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + option.validDays * DAY).toISOString(),
    orderId: order.id,
  }
  return {
    ...state,
    orders: [...state.orders, order],
    memberPackages: [...state.memberPackages, pkg],
    promoCodes: promo ? state.promoCodes.map((p) => (p.code === promo ? { ...p, uses: p.uses + 1 } : p)) : state.promoCodes,
  }
}

export const markOrderPaid = (state: State, orderId: string, method: PaymentMethod): State => ({
  ...state,
  orders: state.orders.map((o) => (o.id === orderId ? { ...o, paid: true, method } : o)),
})

export function savePackageOption(state: State, option: PackageOption): State {
  if (!option.name.trim()) throw new BookingError('Give the package a name.')
  if (option.classes < 1) throw new BookingError('A package needs at least 1 class.')
  if (option.validDays < 1) throw new BookingError('Validity must be at least 1 day.')
  if (option.price < 0) throw new BookingError('Price cannot be negative.')
  if (!option.groups.length) throw new BookingError('Pick at least one class group.')
  const exists = state.packageOptions.some((p) => p.id === option.id)
  return {
    ...state,
    packageOptions: exists
      ? state.packageOptions.map((p) => (p.id === option.id ? option : p))
      : [...state.packageOptions, option],
  }
}

export function savePromo(state: State, code: string, percentOff: number, maxUses: number): State {
  const clean = code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,20}$/.test(clean)) throw new BookingError('Codes are 3–20 letters or numbers.')
  if (!(percentOff > 0 && percentOff <= 100)) throw new BookingError('Discount must be between 1 and 100%.')
  if (state.promoCodes.some((p) => p.code === clean)) throw new BookingError('That code already exists.')
  return { ...state, promoCodes: [...state.promoCodes, { id: newId(), code: clean, percentOff, active: true, maxUses, uses: 0 }] }
}

// ---------- Members ----------

export function addMember(state: State, input: { name: string; email: string; phone: string; birthday: string }, now = new Date()) {
  const email = input.email.trim().toLowerCase()
  if (!input.name.trim()) throw new BookingError('Enter a name.')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new BookingError('Enter a valid email.')
  if (state.users.some((u) => u.email.toLowerCase() === email)) throw new BookingError('A member with that email exists.')
  const user: User = {
    id: newId(),
    name: input.name.trim(),
    email,
    phone: input.phone.trim(),
    birthday: input.birthday,
    passwordHash: '',
    role: 'member',
    joinedAt: now.toISOString(),
  }
  return { ...state, users: [...state.users, user] }
}

// ---------- Schedule ----------

export type SessionDraft = Omit<Session, 'id' | 'seriesId'>

/** Adds a class, optionally repeating weekly for a number of weeks (one series). */
export function addSession(state: State, draft: SessionDraft, repeatWeeks = 1): State {
  if (!draft.title.trim()) throw new BookingError('Pick a class.')
  if (!draft.instructor.trim()) throw new BookingError('Pick an instructor.')
  if (Number.isNaN(new Date(draft.start).getTime())) throw new BookingError('Pick a valid start time.')
  if (draft.capacity < 1) throw new BookingError('Capacity must be at least 1.')
  if (draft.durationMin < 5) throw new BookingError('Duration must be at least 5 minutes.')
  if (draft.cost < 0) throw new BookingError('Cost cannot be negative.')
  if (repeatWeeks < 1 || repeatWeeks > 52) throw new BookingError('Repeat between 1 and 52 weeks.')
  const seriesId = repeatWeeks > 1 ? newId() : undefined
  const added: Session[] = []
  for (let w = 0; w < repeatWeeks; w++) {
    const start = new Date(draft.start)
    start.setDate(start.getDate() + 7 * w)
    added.push({ ...draft, id: newId(), start: start.toISOString(), seriesId })
  }
  return { ...state, sessions: [...state.sessions, ...added] }
}

/** Removes a class and returns the class to everyone holding a confirmed spot. */
export function removeSession(state: State, sessionId: string, now = new Date()): State {
  const session = getSession(state, sessionId)
  let memberPackages = state.memberPackages
  for (const b of activeBookings(state, sessionId)) memberPackages = adjustPackage(memberPackages, b.packageId, session.cost)
  return {
    ...state,
    memberPackages,
    sessions: state.sessions.filter((s) => s.id !== sessionId),
    bookings: state.bookings.map((b) =>
      b.sessionId === sessionId && (b.status === 'booked' || b.status === 'waitlisted')
        ? { ...b, status: 'cancelled', cancelledAt: now.toISOString() }
        : b,
    ),
  }
}

export const groupsOf = (state: State) => [...new Set(state.classTypes.map((c) => c.group))]
