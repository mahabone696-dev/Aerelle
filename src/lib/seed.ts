import type { Booking, ClassType, MemberPackage, Order, PackageOption, Rating, Session, Staff, State, User } from './model'

// Studio setup for Aligné Pilates (class types, instructors, packages, weekly timetable).
// Members, bookings and reviews are invented demo data, generated relative to "now" so there are always
// upcoming classes to book and finished ones to rate. Capacities and instructor-per-slot are placeholders:
// adjust them in Settings and Schedule.

const GROUP_CLASSES = { Mat: 'Mat', Reformer: 'Reformer', Private: 'Private', Duet: 'Duet', Wellness: 'Wellness' }

const CLASS_TYPES: [string, string][] = [
  ['MAT PILATES - Aligné Signature', 'Mat'],
  ['MAT PILATES - Classical Pilates', 'Mat'],
  ['MAT PILATES - Core & Sculpt', 'Mat'],
  ['MAT PILATES - Full Body Essentials', 'Mat'],
  ['MAT PILATES - Sculpt Aligné', 'Mat'],
  ['MAT BARRE & PILATES', 'Mat'],
  ['BALANCE ALIGNÉ', 'Mat'],
  ['RESTORATION & STRETCH', 'Mat'],
  ['REFORMER PILATES - Aligné & Tone', 'Reformer'],
  ['REFORMER PILATES - Core & Sculpt', 'Reformer'],
  ['REFORMER PILATES - Full Body Aligné', 'Reformer'],
  ['PRIVATE EQUIPMENT CLASS', 'Private'],
  ['DUET REFORMER CLASS', 'Duet'],
  ['RESTORATIVE YOGA - Yin & Healing', 'Wellness'],
  ['SOUNDBATH HEALING SESSION', 'Wellness'],
]

const INSTRUCTORS = ['Rachel', 'Nicky', 'Eunice', 'Jessa', 'Renee', 'Stefanie', 'Xin Xuen']

const DEFAULT_CAPACITY: Record<string, number> = { Mat: 10, Reformer: 6, Private: 1, Duet: 2, Wellness: 10 }

const opt = (
  id: string,
  name: string,
  price: number,
  classes: number,
  validDays: number,
  groups: string[],
  extra: Partial<PackageOption> = {},
): PackageOption => ({ id, name, price, classes, validDays, groups, hidden: false, trial: false, recurring: false, description: '', ...extra })

const { Mat, Reformer, Private, Duet, Wellness } = GROUP_CLASSES

export const PACKAGE_OPTIONS: PackageOption[] = [
  opt('mat-drop', 'Drop In (Mat)', 55, 1, 7, [Mat]),
  opt('mat-4', '4 Class Pack', 199, 4, 30, [Mat]),
  opt('mat-10', '10 Class Pack', 450, 10, 90, [Mat]),
  opt('mat-24', '24 Class Pack', 888, 24, 180, [Mat]),
  opt('mat-50', '50 Class Pack', 1688, 50, 365, [Mat]),
  opt('ref-drop', 'Drop In', 88, 1, 7, [Reformer]),
  opt('ref-4', '4 Class Pack (Reformer)', 320, 4, 30, [Reformer]),
  opt('ref-10', '10 Class Pack (Reformer)', 750, 10, 90, [Reformer]),
  opt('ref-24', '24 Class Pack (Reformer)', 1688, 24, 180, [Reformer]),
  opt('mix-4', '(GROUP CLASS) 2 Reformer + 2 Mat', 250, 4, 30, [Reformer, Mat]),
  opt('mem-ref', 'Reformer Group Class - 4 Credits', 299, 4, 30, [Reformer], { recurring: true, description: 'Monthly membership' }),
  opt('mem-mat', 'Mat Group Class - 4 Credits', 179, 4, 30, [Mat], { recurring: true, description: 'Monthly membership' }),
  opt('trial-1', '1 Trial Class', 48, 1, 7, [Mat], { trial: true, hidden: true }),
  opt('trial-3', '3 Trial Class Pack', 128, 3, 30, [Mat], { trial: true, hidden: true }),
  opt('pvt-trial', 'PRIVATE EQUIPMENT PILATES 1:1 (First Trial)', 180, 1, 7, [Private], { trial: true, hidden: true }),
  opt('pvt-1', '1 PRIVATE CLASS CREDIT (EQUIPMENT)', 200, 1, 7, [Private], { hidden: true }),
  opt('pvt-4', 'Private 4 Class Pack', 760, 4, 30, [Private], { hidden: true }),
  opt('pvt-10', '10+1 PRIVATE CLASS', 1888, 11, 90, [Private], { hidden: true }),
  opt('duet-trial', 'Duet Trial Class', 199, 1, 7, [Duet], { trial: true, hidden: true }),
  opt('duet-4', 'Duet 4 Class Pack', 1200, 4, 30, [Duet], { hidden: true }),
  opt('sound', 'Soundbath Healing', 88, 1, 1, [Wellness], { hidden: true }),
]

// Recurring group timetable: [weekday (0=Sun), "HH:MM", class type, instructor]
const TIMETABLE: [number, string, string, string][] = [
  [1, '20:00', 'MAT PILATES - Aligné Signature', 'Rachel'],
  [2, '20:15', 'REFORMER PILATES - Aligné & Tone', 'Nicky'],
  [3, '19:00', 'REFORMER PILATES - Core & Sculpt', 'Eunice'],
  [3, '20:15', 'MAT PILATES - Core & Sculpt', 'Jessa'],
  [4, '20:00', 'REFORMER PILATES - Full Body Aligné', 'Renee'],
  [5, '19:15', 'REFORMER PILATES - Full Body Aligné', 'Nicky'],
  [6, '10:15', 'REFORMER PILATES - Aligné & Tone', 'Stefanie'],
  [6, '11:30', 'REFORMER PILATES - Core & Sculpt', 'Stefanie'],
  [0, '08:15', 'REFORMER PILATES - Full Body Aligné', 'Xin Xuen'],
  [0, '10:45', 'REFORMER PILATES - Aligné & Tone', 'Xin Xuen'],
  [1, '09:30', 'PRIVATE EQUIPMENT CLASS', 'Rachel'],
  [4, '09:30', 'PRIVATE EQUIPMENT CLASS', 'Rachel'],
  [6, '09:45', 'DUET REFORMER CLASS', 'Eunice'],
]

const DEMO_HASH = 'f96a6d88eeda67e527c48378d03128ea0c547db067f58ecf646d03917693c6ca' // "demo1234"

const DEMO_NAMES = ['Sam Lee', 'Riley Tan', 'Casey Lim', 'Jamie Ong', 'Taylor Ng', 'Quinn Chua', 'Avery Goh', 'Drew Teo']
const COMMENTS = ['Loved the flow, great cues.', 'Challenging but so good!', 'Felt amazing afterwards.', '', 'Lovely studio and instructor.', '']

export function seedState(now = new Date()): State {
  const classTypes: ClassType[] = CLASS_TYPES.map(([name, group], i) => ({ id: `ct${i}`, name, group }))
  const groupOf = (name: string) => classTypes.find((c) => c.name === name)!.group
  const staff: Staff[] = [
    ...INSTRUCTORS.map((name, i) => ({ id: `st${i}`, name, role: 'Instructor' as const, email: '', showOnSite: true })),
    { id: 'st-desk', name: 'Front Desk', role: 'Front desk', email: '', showOnSite: false },
  ]

  const sessions: Session[] = []
  for (let day = -10; day <= 21; day++) {
    const date = new Date(now)
    date.setDate(date.getDate() + day)
    for (const [weekday, time, title, instructor] of TIMETABLE) {
      if (date.getDay() !== weekday) continue
      const [h, m] = time.split(':').map(Number)
      const start = new Date(date)
      start.setHours(h, m, 0, 0)
      const group = groupOf(title)
      sessions.push({
        id: `s${day + 10}-${time.replace(':', '')}`,
        title,
        group,
        instructor,
        room: 'Horizon Hills',
        start: start.toISOString(),
        durationMin: 60,
        capacity: DEFAULT_CAPACITY[group],
        cost: 1,
        seriesId: `series-${weekday}-${time}`,
      })
    }
  }

  const joined = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  const users: User[] = [
    { id: 'u-demo', name: 'Alex Morgan', email: 'member@aerelle.test', phone: '+60 12-000 0001', birthday: '1994-03-14', passwordHash: DEMO_HASH, role: 'member', joinedAt: joined(120) },
    { id: 'u-owner', name: 'Studio Owner', email: 'owner@aerelle.test', phone: '', birthday: '', passwordHash: DEMO_HASH, role: 'owner', joinedAt: joined(400) },
    ...DEMO_NAMES.map((name, i) => {
      const bday = new Date(now)
      bday.setMonth((now.getMonth() + (i % 3 === 0 ? 0 : i)) % 12, 3 + i * 3)
      return {
        id: `u-${i}`,
        name,
        email: `${name.split(' ')[0].toLowerCase()}@aerelle.test`,
        phone: `+60 12-000 01${String(i).padStart(2, '0')}`,
        birthday: `199${i}-${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`,
        passwordHash: DEMO_HASH,
        role: 'member' as const,
        joinedAt: joined(10 + i * 20),
      }
    }),
  ]

  // Every demo member holds a Mat pack and a Reformer pack bought two weeks ago.
  const orders: Order[] = []
  const memberPackages: MemberPackage[] = []
  const bought = new Date(now.getTime() - 14 * 86_400_000)
  const give = (userId: string, optionId: string, i: number, paid = true) => {
    const o = PACKAGE_OPTIONS.find((p) => p.id === optionId)!
    const at = new Date(bought.getTime() + i * 3_600_000)
    const orderId = `o-${userId}-${optionId}`
    orders.push({ id: orderId, userId, optionId, name: o.name, price: o.price, discount: 0, net: o.price, promo: '', method: paid ? 'Card' : 'Cash', source: paid ? 'Online' : 'Front desk', paid, createdAt: at.toISOString() })
    memberPackages.push({ id: `p-${userId}-${optionId}`, userId, optionId, name: o.name, total: o.classes, remaining: o.classes, groups: o.groups, purchasedAt: at.toISOString(), expiresAt: new Date(at.getTime() + o.validDays * 86_400_000).toISOString(), orderId })
  }
  give('u-demo', 'mat-10', 0)
  give('u-demo', 'ref-4', 1)
  DEMO_NAMES.forEach((_, i) => {
    give(`u-${i}`, i % 2 ? 'mat-24' : 'mat-10', i)
    give(`u-${i}`, 'ref-24', i, i !== 5) // one unpaid front-desk sale
  })
  give('u-3', 'pvt-10', 3)

  const bookings: Booking[] = []
  const ratings: Rating[] = []
  const use = (userId: string, group: string) => {
    const p = memberPackages.find((x) => x.userId === userId && x.groups.includes(group) && x.remaining > 0)
    if (p) p.remaining--
    return p?.id
  }
  sessions.forEach((s, si) => {
    const past = new Date(s.start) < now
    const fill = s.capacity <= 2 ? (si % 2) + 0 : Math.min(DEMO_NAMES.length, Math.round(s.capacity * (0.4 + ((si * 37) % 60) / 100)))
    for (let k = 0; k < fill; k++) {
      const userId = s.group === 'Private' ? 'u-3' : `u-${(k + si) % DEMO_NAMES.length}`
      if (bookings.some((b) => b.userId === userId && b.sessionId === s.id)) continue
      const packageId = use(userId, s.group)
      if (!packageId) continue
      bookings.push({
        id: `b${si}-${k}`,
        userId,
        sessionId: s.id,
        status: 'booked',
        createdAt: bought.toISOString(),
        packageId,
        attendance: past ? ((si + k) % 9 === 0 ? 'no-show' : 'attended') : undefined,
      })
      if (past && (si + k) % 9 !== 0 && (si + k) % 2 === 0) {
        ratings.push({
          id: `r${si}-${k}`,
          userId,
          sessionId: s.id,
          stars: (si + k) % 7 === 0 ? 4 : 5,
          comment: COMMENTS[(si + k) % COMMENTS.length],
          createdAt: new Date(new Date(s.start).getTime() + 2 * 3_600_000).toISOString(),
        })
      }
    }
    // A couple of past classes for the demo member to rate, plus some late cancellations for the reports.
    if (past && s.group !== 'Private' && s.group !== 'Duet' && si % 3 === 0) {
      const packageId = use('u-demo', s.group)
      if (packageId) bookings.push({ id: `b${si}-me`, userId: 'u-demo', sessionId: s.id, status: 'booked', createdAt: bought.toISOString(), packageId, attendance: 'attended' })
    }
    if (past && si % 5 === 0) {
      bookings.push({ id: `b${si}-lc`, userId: `u-${si % DEMO_NAMES.length}`, sessionId: s.id, status: 'late-cancelled', createdAt: bought.toISOString(), cancelledAt: new Date(new Date(s.start).getTime() - 3 * 3_600_000).toISOString() })
    }
  })

  return {
    version: 2,
    studio: {
      name: 'Aligné Pilates',
      location: 'Horizon Hills',
      currency: 'RM',
      cancelHours: 12,
      email: '',
      phone: '',
      description: 'Mat, reformer and private equipment Pilates in Horizon Hills.',
    },
    classTypes,
    staff,
    users,
    sessions,
    bookings,
    ratings,
    packageOptions: PACKAGE_OPTIONS,
    memberPackages,
    orders,
    promoCodes: [{ id: 'promo-1', code: 'WELCOME10', percentOff: 10, active: true, maxUses: 0, uses: 0 }],
  }
}
