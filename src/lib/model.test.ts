import { describe, expect, it } from 'vitest'
import {
  addSession, book, canRate, cancel, classesLeft, markAttendance, markOrderPaid, packageFor, purchase, quote, rate,
  removeSession, savePromo, spotsLeft, type PackageOption, type Session, type State,
} from './model'
import { bookingReport, cancellationReport, payrollReport, salesReport } from './reports'
import { seedState } from './seed'

const NOW = new Date('2026-10-12T08:00:00Z')
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString()

const option = (id: string, groups: string[], extra: Partial<PackageOption> = {}): PackageOption => ({
  id, name: id, price: 100, classes: 5, validDays: 30, groups, hidden: false, trial: false, recurring: false, description: '', ...extra,
})
const session = (id: string, group: string, startH: number, capacity = 1): Session => ({
  id, title: `${group} class`, group, instructor: 'Nicky', room: 'A', start: inHours(startH), durationMin: 60, capacity, cost: 1,
})

/** Three members; u0..u2 each hold a 2-class Mat pack, u0 also a Reformer pack. */
function world(capacity = 1): State {
  let s: State = {
    version: 2,
    studio: { id: 'st', slug: 'test', name: 'Test', location: 'A', currency: 'RM', cancelHours: 12, email: '', phone: '', description: '' },
    classTypes: [],
    staff: [],
    users: [0, 1, 2].map((i) => ({ id: `u${i}`, name: `U${i}`, email: `u${i}@x.t`, phone: '', birthday: '', passwordHash: 'x', role: 'member' as const, joinedAt: NOW.toISOString() })),
    sessions: [session('future', 'Mat', 48, capacity), session('soon', 'Mat', 2, capacity), session('past', 'Mat', -3, capacity), session('ref', 'Reformer', 48, capacity)],
    bookings: [],
    ratings: [],
    packageOptions: [
      option('mat2', ['Mat'], { classes: 2 }),
      option('ref', ['Reformer']),
      option('trial', ['Mat'], { trial: true, price: 48, classes: 1 }),
      option('staff', ['Mat'], { hidden: true }),
    ],
    memberPackages: [],
    orders: [],
    promoCodes: [{ id: 'p', code: 'TEN', percentOff: 10, active: true, maxUses: 1, uses: 0 }],
  }
  const before = new Date(NOW.getTime() - 86_400_000)
  for (const u of ['u0', 'u1', 'u2']) s = purchase(s, u, 'mat2', {}, before)
  return purchase(s, 'u0', 'ref', {}, before)
}
const left = (s: State, u: string) => classesLeft(s, u, NOW)

describe('booking with packages', () => {
  it('deducts from a package covering the class group', () => {
    const s = book(world(), 'u0', 'future', NOW)
    expect(left(s, 'u0')).toBe(6) // 2 mat + 5 reformer - 1
    expect(s.bookings[0].packageId).toBe(s.memberPackages.find((p) => p.userId === 'u0' && p.optionId === 'mat2')!.id)
  })

  it('refuses a class its packages do not cover', () => {
    expect(() => book(world(), 'u1', 'ref', NOW)).toThrow(/Reformer/)
  })

  it('ignores packages that expire before the class', () => {
    const s = world()
    s.memberPackages = s.memberPackages.map((p) => ({ ...p, expiresAt: inHours(24) }))
    expect(packageFor(s, 'u0', s.sessions[0], NOW)).toBeUndefined()
  })

  it('waitlists for free when full and rejects double booking or started classes', () => {
    let s = book(world(), 'u0', 'future', NOW)
    s = book(s, 'u1', 'future', NOW)
    expect(s.bookings[1].status).toBe('waitlisted')
    expect(left(s, 'u1')).toBe(2)
    expect(() => book(s, 'u0', 'future', NOW)).toThrow(/already/)
    expect(() => book(world(), 'u0', 'past', NOW)).toThrow(/started/)
  })
})

describe('cancelling', () => {
  it('returns the class to its package in time and promotes the waitlist', () => {
    let s = book(world(), 'u0', 'future', NOW)
    s = book(s, 'u1', 'future', NOW)
    s = cancel(s, 'u0', 'future', NOW)
    expect(left(s, 'u0')).toBe(7)
    expect(s.bookings.find((b) => b.userId === 'u1')!.status).toBe('booked')
    expect(left(s, 'u1')).toBe(1)
  })

  it('keeps the class on a late cancel, using the studio window', () => {
    let s = book(world(), 'u0', 'soon', NOW)
    s = cancel(s, 'u0', 'soon', NOW)
    expect(left(s, 'u0')).toBe(6)
    expect(s.bookings[0].status).toBe('late-cancelled')

    let lenient = { ...book(world(), 'u0', 'soon', NOW) }
    lenient = { ...lenient, studio: { ...lenient.studio, cancelHours: 1 } }
    expect(left(cancel(lenient, 'u0', 'soon', NOW), 'u0')).toBe(7)
  })

  it('cancelling a class refunds everyone booked', () => {
    let s = book(world(2), 'u0', 'future', NOW)
    s = book(s, 'u1', 'future', NOW)
    s = removeSession(s, 'future', NOW)
    expect(left(s, 'u0')).toBe(7)
    expect(left(s, 'u1')).toBe(2)
  })
})

describe('attendance and rating', () => {
  const attended = (): State => {
    const s = world()
    const pkg = s.memberPackages.find((p) => p.userId === 'u0')!.id
    return { ...s, bookings: [{ id: 'b', userId: 'u0', sessionId: 'past', status: 'booked' as const, createdAt: inHours(-48), packageId: pkg }] }
  }

  it('allows one rating after attending', () => {
    let s = attended()
    expect(canRate(s, 'u0', s.sessions[2], NOW)).toBe(true)
    s = rate(s, 'u0', 'past', 5, ' great ', NOW)
    expect(s.ratings[0]).toMatchObject({ stars: 5, comment: 'great' })
    expect(() => rate(s, 'u0', 'past', 4, '', NOW)).toThrow()
  })

  it('no-shows cannot rate', () => {
    const s = markAttendance(attended(), 'b', 'no-show', NOW)
    expect(canRate(s, 'u0', s.sessions[2], NOW)).toBe(false)
  })

  it('check-in opens an hour before class', () => {
    const s = book(world(), 'u0', 'future', NOW)
    expect(() => markAttendance(s, s.bookings[0].id, 'attended', NOW)).toThrow(/hour/)
  })
})

describe('selling packages', () => {
  it('applies promo codes and enforces their limits', () => {
    expect(quote(world(), 'mat2', 'ten').net).toBe(90)
    const s = purchase(world(), 'u1', 'mat2', { promo: 'TEN' }, NOW)
    expect(s.orders.at(-1)).toMatchObject({ discount: 10, net: 90, promo: 'TEN' })
    expect(() => purchase(s, 'u2', 'mat2', { promo: 'TEN' }, NOW)).toThrow(/fully used/)
    expect(() => quote(world(), 'mat2', 'NOPE')).toThrow()
  })

  it('allows one trial per member', () => {
    const s = purchase(world(), 'u1', 'trial', {}, NOW)
    expect(() => purchase(s, 'u1', 'trial', {}, NOW)).toThrow(/one per member/)
  })

  it('keeps staff-only packages off the online shop but lets staff assign them unpaid', () => {
    expect(() => purchase(world(), 'u1', 'staff', {}, NOW)).toThrow(/not available online/)
    let s = purchase(world(), 'u1', 'staff', { source: 'Front desk', paid: false, method: 'Cash' }, NOW)
    const order = s.orders.at(-1)!
    expect(order.paid).toBe(false)
    s = markOrderPaid(s, order.id, 'Card')
    expect(s.orders.at(-1)).toMatchObject({ paid: true, method: 'Card' })
  })

  it('validates promo codes on creation', () => {
    expect(() => savePromo(world(), 'x', 10, 0)).toThrow()
    expect(() => savePromo(world(), 'TEN', 10, 0)).toThrow(/exists/)
    expect(savePromo(world(), 'raya20', 20, 0).promoCodes.at(-1)!.code).toBe('RAYA20')
  })
})

describe('schedule', () => {
  it('creates a weekly series', () => {
    const draft = { title: 'Mat', group: 'Mat', instructor: 'K', room: 'B', start: inHours(24), durationMin: 60, capacity: 10, cost: 1 }
    const s = addSession(world(), draft, 4)
    const added = s.sessions.slice(-4)
    expect(new Set(added.map((x) => x.seriesId)).size).toBe(1)
    expect(new Date(added[3].start).getTime() - new Date(added[0].start).getTime()).toBe(21 * 86_400_000)
    expect(() => addSession(world(), { ...draft, capacity: 0 })).toThrow()
  })
})

describe('reports', () => {
  const range = { from: new Date(NOW.getTime() - 7 * 86_400_000), to: new Date(NOW.getTime() + 7 * 86_400_000) }

  it('sales totals split collected and outstanding', () => {
    const s = purchase(world(), 'u1', 'staff', { source: 'Front desk', paid: false }, NOW)
    const r = salesReport(s, range)
    expect(r.totals).toMatchObject({ orders: 5, gross: 500, collected: 400, outstanding: 100 })
  })

  it('bookings, cancellations and payroll line up', () => {
    let s = book(world(2), 'u0', 'soon', NOW)
    s = book(s, 'u1', 'soon', NOW)
    s = cancel(s, 'u1', 'soon', NOW)
    expect(bookingReport(s, range).rows.find((r) => r[2] === 'Mat class' && r[5] === 1)).toBeTruthy()
    expect(cancellationReport(s, range).totals).toEqual({ total: 1, late: 1 })
    expect(payrollReport(s, range).header[0]).toBe('Instructor')
  })
})

describe('seed', () => {
  it('produces consistent demo data', () => {
    const s = seedState(NOW)
    expect(s.sessions.length).toBeGreaterThan(30)
    for (const sess of s.sessions) expect(spotsLeft(s, sess)).toBeGreaterThanOrEqual(0)
    expect(s.memberPackages.every((p) => p.remaining >= 0)).toBe(true)
    expect(s.sessions.some((x) => canRate(s, 'u-demo', x, NOW))).toBe(true)
  })
})
