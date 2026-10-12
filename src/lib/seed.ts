import type { Booking, ClassType, MemberPackage, Order, PackageOption, Rating, Session, Staff, State, User } from './model'
import type { Account, Platform } from './platform'

// Demo platform with three studios. Aligné Pilates uses its real setup (class types, instructors,
// packages, weekly timetable). The other two studios are fictional and exist to show multi-studio features.
// Members, bookings and reviews are invented, generated relative to "now" so there are always upcoming
// classes to book and finished ones to rate.

const DEMO_HASH = 'f96a6d88eeda67e527c48378d03128ea0c547db067f58ecf646d03917693c6ca' // "demo1234"
const COMMENTS = ['Loved the flow, great cues.', 'Challenging but so good!', 'Felt amazing afterwards.', '', 'Lovely studio and instructor.', '']

const opt = (
  id: string,
  name: string,
  price: number,
  classes: number,
  validDays: number,
  groups: string[],
  extra: Partial<PackageOption> = {},
): PackageOption => ({ id, name, price, classes, validDays, groups, hidden: false, trial: false, recurring: false, description: '', ...extra })

interface StudioConfig {
  id: string
  slug: string
  name: string
  location: string
  description: string
  classTypes: [string, string][] // [name, group]
  instructors: string[]
  capacity: Record<string, number>
  packages: PackageOption[]
  /** [weekday (0=Sun), "HH:MM", class type, instructor] */
  timetable: [number, string, string, string][]
  ownerId: string
  /** Prefix for this studio's demo member ids; names are invented. */
  memberPrefix: string
  memberNames: string[]
  /** Package ids each demo member holds: [first pack, second pack]. */
  memberPacks: (i: number) => string[]
  /** Demo member ("member@aerelle.test") holds these packs here, or isn't a member if undefined. */
  demoPacks?: string[]
  /** Member who books the private / 1:1 sessions, and the pack they use. */
  privateRegular?: [number, string]
}

const ALIGNE: StudioConfig = {
  id: 'studio-aligne',
  slug: 'aligne-pilates',
  name: 'Aligné Pilates',
  location: 'Horizon Hills',
  description: 'Mat, reformer and private equipment Pilates in Horizon Hills.',
  classTypes: [
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
  ],
  instructors: ['Rachel', 'Nicky', 'Eunice', 'Jessa', 'Renee', 'Stefanie', 'Xin Xuen'],
  capacity: { Mat: 10, Reformer: 6, Private: 1, Duet: 2, Wellness: 10 },
  packages: [
    opt('mat-drop', 'Drop In (Mat)', 55, 1, 7, ['Mat']),
    opt('mat-4', '4 Class Pack', 199, 4, 30, ['Mat']),
    opt('mat-10', '10 Class Pack', 450, 10, 90, ['Mat']),
    opt('mat-24', '24 Class Pack', 888, 24, 180, ['Mat']),
    opt('mat-50', '50 Class Pack', 1688, 50, 365, ['Mat']),
    opt('ref-drop', 'Drop In', 88, 1, 7, ['Reformer']),
    opt('ref-4', '4 Class Pack (Reformer)', 320, 4, 30, ['Reformer']),
    opt('ref-10', '10 Class Pack (Reformer)', 750, 10, 90, ['Reformer']),
    opt('ref-24', '24 Class Pack (Reformer)', 1688, 24, 180, ['Reformer']),
    opt('mix-4', '(GROUP CLASS) 2 Reformer + 2 Mat', 250, 4, 30, ['Reformer', 'Mat']),
    opt('mem-ref', 'Reformer Group Class - 4 Credits', 299, 4, 30, ['Reformer'], { recurring: true, description: 'Monthly membership' }),
    opt('mem-mat', 'Mat Group Class - 4 Credits', 179, 4, 30, ['Mat'], { recurring: true, description: 'Monthly membership' }),
    opt('trial-1', '1 Trial Class', 48, 1, 7, ['Mat'], { trial: true, hidden: true }),
    opt('trial-3', '3 Trial Class Pack', 128, 3, 30, ['Mat'], { trial: true, hidden: true }),
    opt('pvt-trial', 'PRIVATE EQUIPMENT PILATES 1:1 (First Trial)', 180, 1, 7, ['Private'], { trial: true, hidden: true }),
    opt('pvt-1', '1 PRIVATE CLASS CREDIT (EQUIPMENT)', 200, 1, 7, ['Private'], { hidden: true }),
    opt('pvt-4', 'Private 4 Class Pack', 760, 4, 30, ['Private'], { hidden: true }),
    opt('pvt-10', '10+1 PRIVATE CLASS', 1888, 11, 90, ['Private'], { hidden: true }),
    opt('duet-trial', 'Duet Trial Class', 199, 1, 7, ['Duet'], { trial: true, hidden: true }),
    opt('duet-4', 'Duet 4 Class Pack', 1200, 4, 30, ['Duet'], { hidden: true }),
    opt('sound', 'Soundbath Healing', 88, 1, 1, ['Wellness'], { hidden: true }),
  ],
  timetable: [
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
  ],
  ownerId: 'u-owner',
  memberPrefix: 'u',
  memberNames: ['Sam Lee', 'Riley Tan', 'Casey Lim', 'Jamie Ong', 'Taylor Ng', 'Quinn Chua', 'Avery Goh', 'Drew Teo'],
  memberPacks: (i) => [i % 2 ? 'mat-24' : 'mat-10', 'ref-24'],
  demoPacks: ['mat-10', 'ref-4'],
  privateRegular: [3, 'pvt-10'],
}

// Fictional demo studio owned by the same demo owner, to show the studio switcher.
const LUMEN: StudioConfig = {
  id: 'studio-lumen',
  slug: 'lumen-reformer',
  name: 'Lumen Reformer Co.',
  location: 'Mont Kiara, KL',
  description: 'Demo studio: small-group reformer and jumpboard classes.',
  classTypes: [
    ['Reformer Foundations', 'Reformer'],
    ['Reformer Sculpt', 'Reformer'],
    ['Jumpboard Cardio', 'Reformer'],
    ['Tower Stretch', 'Tower'],
  ],
  instructors: ['Mei Ling', 'Aisha', 'Daniel'],
  capacity: { Reformer: 8, Tower: 5 },
  packages: [
    opt('l-drop', 'Single Class', 95, 1, 14, ['Reformer', 'Tower']),
    opt('l-5', '5 Class Pack', 425, 5, 60, ['Reformer', 'Tower']),
    opt('l-10', '10 Class Pack', 800, 10, 120, ['Reformer', 'Tower']),
    opt('l-intro', 'Intro Offer: 3 Classes', 199, 3, 21, ['Reformer'], { trial: true }),
  ],
  timetable: [
    [1, '07:00', 'Reformer Foundations', 'Mei Ling'],
    [1, '19:30', 'Reformer Sculpt', 'Aisha'],
    [2, '12:15', 'Jumpboard Cardio', 'Daniel'],
    [3, '07:00', 'Reformer Sculpt', 'Mei Ling'],
    [3, '19:30', 'Tower Stretch', 'Aisha'],
    [4, '19:30', 'Jumpboard Cardio', 'Daniel'],
    [5, '07:00', 'Reformer Foundations', 'Mei Ling'],
    [6, '09:00', 'Reformer Sculpt', 'Aisha'],
    [0, '10:00', 'Reformer Foundations', 'Daniel'],
  ],
  ownerId: 'u-owner',
  memberPrefix: 'lm',
  memberNames: ['Hana Yusof', 'Leon Wong', 'Priya Nair', 'Kai Lim', 'Sofia Tan', 'Ben Ho'],
  memberPacks: () => ['l-10'],
  demoPacks: ['l-10'],
}

// Fictional demo studio with a different owner.
const TIDAL: StudioConfig = {
  id: 'studio-tidal',
  slug: 'tidal-yoga-barre',
  name: 'Tidal Yoga & Barre',
  location: 'Gurney, Penang',
  description: 'Demo studio: vinyasa, yin and barre by the sea.',
  classTypes: [
    ['Vinyasa Flow', 'Yoga'],
    ['Yin & Restore', 'Yoga'],
    ['Barre Burn', 'Barre'],
    ['Sunset Meditation', 'Wellness'],
  ],
  instructors: ['Nadia', 'Tom', 'Grace'],
  capacity: { Yoga: 16, Barre: 12, Wellness: 20 },
  packages: [
    opt('t-drop', 'Drop-in', 40, 1, 7, ['Yoga', 'Barre', 'Wellness']),
    opt('t-10', '10 Class Card', 350, 10, 90, ['Yoga', 'Barre', 'Wellness']),
    opt('t-month', 'Unlimited Month', 299, 40, 30, ['Yoga', 'Barre', 'Wellness'], { recurring: true, description: 'Monthly membership' }),
  ],
  timetable: [
    [1, '18:30', 'Vinyasa Flow', 'Nadia'],
    [2, '07:30', 'Barre Burn', 'Grace'],
    [2, '19:00', 'Yin & Restore', 'Tom'],
    [3, '18:30', 'Vinyasa Flow', 'Nadia'],
    [4, '07:30', 'Barre Burn', 'Grace'],
    [5, '19:00', 'Sunset Meditation', 'Tom'],
    [6, '08:30', 'Vinyasa Flow', 'Nadia'],
    [0, '09:00', 'Yin & Restore', 'Tom'],
  ],
  ownerId: 'u-tidal',
  memberPrefix: 'td',
  memberNames: ['Farah Aziz', 'Jason Chew', 'Mira Das', 'Oliver Khoo', 'Lina Teh', 'Ravi Kumar', 'Zoe Lau'],
  memberPacks: (i) => [i % 3 ? 't-10' : 't-month'],
}

const DEMO_MEMBER = { id: 'u-demo', name: 'Alex Morgan', email: 'member@aerelle.test', phone: '+60 12-000 0001', birthday: '1994-03-14' }
const OWNERS: Record<string, { name: string; email: string }> = {
  'u-owner': { name: 'Studio Owner', email: 'owner@aerelle.test' },
  'u-tidal': { name: 'Tidal Owner', email: 'tidal@aerelle.test' },
}

function seedStudio(cfg: StudioConfig, now: Date): State {
  const classTypes: ClassType[] = cfg.classTypes.map(([name, group], i) => ({ id: `${cfg.id}-ct${i}`, name, group }))
  const groupOf = (name: string) => classTypes.find((c) => c.name === name)!.group
  const staff: Staff[] = [
    ...cfg.instructors.map((name, i) => ({ id: `${cfg.id}-st${i}`, name, role: 'Instructor' as const, email: '', showOnSite: true })),
    { id: `${cfg.id}-desk`, name: 'Front Desk', role: 'Front desk', email: '', showOnSite: false },
  ]

  const sessions: Session[] = []
  for (let day = -10; day <= 21; day++) {
    const date = new Date(now)
    date.setDate(date.getDate() + day)
    for (const [weekday, time, title, instructor] of cfg.timetable) {
      if (date.getDay() !== weekday) continue
      const [h, m] = time.split(':').map(Number)
      const start = new Date(date)
      start.setHours(h, m, 0, 0)
      const group = groupOf(title)
      sessions.push({
        id: `${cfg.id}-s${day + 10}-${time.replace(':', '')}`,
        title,
        group,
        instructor,
        room: cfg.location,
        start: start.toISOString(),
        durationMin: group === 'Wellness' ? 45 : 60,
        capacity: cfg.capacity[group] ?? 10,
        cost: 1,
        seriesId: `${cfg.id}-series-${weekday}-${time}`,
      })
    }
  }

  const joined = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  const memberIds = cfg.memberNames.map((_, i) => `${cfg.memberPrefix}-${i}`)
  const owner = OWNERS[cfg.ownerId]
  const users: User[] = [
    { id: cfg.ownerId, name: owner.name, email: owner.email, phone: '', birthday: '', passwordHash: '', role: 'owner', joinedAt: joined(400) },
    ...(cfg.demoPacks ? [{ ...DEMO_MEMBER, passwordHash: '', role: 'member' as const, joinedAt: joined(120) }] : []),
    ...cfg.memberNames.map((name, i) => {
      const bday = new Date(now)
      bday.setMonth((now.getMonth() + (i % 3 === 0 ? 0 : i)) % 12, 3 + i * 3)
      return {
        id: memberIds[i],
        name,
        email: `${name.split(' ')[0].toLowerCase()}.${cfg.memberPrefix}@aerelle.test`,
        phone: `+60 12-${cfg.memberPrefix === 'u' ? '000' : cfg.memberPrefix === 'lm' ? '111' : '222'} 01${String(i).padStart(2, '0')}`,
        birthday: `199${i}-${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`,
        passwordHash: '',
        role: 'member' as const,
        joinedAt: joined(10 + i * 20),
      }
    }),
  ]

  const orders: Order[] = []
  const memberPackages: MemberPackage[] = []
  const bought = new Date(now.getTime() - 14 * 86_400_000)
  const give = (userId: string, optionId: string, i: number, paid = true) => {
    const o = cfg.packages.find((p) => p.id === optionId)!
    const at = new Date(bought.getTime() + i * 3_600_000)
    const orderId = `${cfg.id}-o-${userId}-${optionId}`
    orders.push({ id: orderId, userId, optionId, name: o.name, price: o.price, discount: 0, net: o.price, promo: '', method: paid ? 'Card' : 'Cash', source: paid ? 'Online' : 'Front desk', paid, createdAt: at.toISOString() })
    memberPackages.push({ id: `${cfg.id}-p-${userId}-${optionId}`, userId, optionId, name: o.name, total: o.classes, remaining: o.classes, groups: o.groups, purchasedAt: at.toISOString(), expiresAt: new Date(at.getTime() + o.validDays * 86_400_000).toISOString(), orderId })
  }
  cfg.demoPacks?.forEach((id, k) => give(DEMO_MEMBER.id, id, k))
  memberIds.forEach((id, i) => cfg.memberPacks(i).forEach((pack, k) => give(id, pack, i, !(i === 5 && k === 1)))) // one unpaid desk sale
  if (cfg.privateRegular) give(memberIds[cfg.privateRegular[0]], cfg.privateRegular[1], 3)

  const bookings: Booking[] = []
  const ratings: Rating[] = []
  const use = (userId: string, group: string) => {
    const p = memberPackages.find((x) => x.userId === userId && x.groups.includes(group) && x.remaining > 0)
    if (p) p.remaining--
    return p?.id
  }
  let demoPast = 0
  sessions.forEach((s, si) => {
    const past = new Date(s.start) < now
    const fill = s.capacity <= 2 ? si % 2 : Math.min(memberIds.length, Math.round(s.capacity * (0.4 + ((si * 37) % 60) / 100)))
    for (let k = 0; k < fill; k++) {
      const userId = s.capacity <= 2 && cfg.privateRegular ? memberIds[cfg.privateRegular[0]] : memberIds[(k + si) % memberIds.length]
      if (bookings.some((b) => b.userId === userId && b.sessionId === s.id)) continue
      const packageId = use(userId, s.group)
      if (!packageId) continue
      bookings.push({
        id: `${cfg.id}-b${si}-${k}`,
        userId,
        sessionId: s.id,
        status: 'booked',
        createdAt: bought.toISOString(),
        packageId,
        attendance: past ? ((si + k) % 9 === 0 ? 'no-show' : 'attended') : undefined,
      })
      if (past && (si + k) % 9 !== 0 && (si + k) % 2 === 0) {
        ratings.push({
          id: `${cfg.id}-r${si}-${k}`,
          userId,
          sessionId: s.id,
          stars: (si + k) % 7 === 0 ? 4 : 5,
          comment: COMMENTS[(si + k) % COMMENTS.length],
          createdAt: new Date(new Date(s.start).getTime() + 2 * 3_600_000).toISOString(),
        })
      }
    }
    // Past classes for the demo member to rate, plus some late cancellations for the reports.
    // Capped so the demo member always has classes left to book with.
    if (cfg.demoPacks && past && s.capacity > 2 && si % 3 === 0 && demoPast < 3) {
      const packageId = use(DEMO_MEMBER.id, s.group)
      if (packageId) demoPast++
      if (packageId) bookings.push({ id: `${cfg.id}-b${si}-me`, userId: DEMO_MEMBER.id, sessionId: s.id, status: 'booked', createdAt: bought.toISOString(), packageId, attendance: 'attended' })
    }
    if (past && si % 5 === 0) {
      bookings.push({ id: `${cfg.id}-b${si}-lc`, userId: memberIds[si % memberIds.length], sessionId: s.id, status: 'late-cancelled', createdAt: bought.toISOString(), cancelledAt: new Date(new Date(s.start).getTime() - 3 * 3_600_000).toISOString() })
    }
  })

  return {
    version: 2,
    studio: {
      id: cfg.id,
      slug: cfg.slug,
      name: cfg.name,
      location: cfg.location,
      currency: 'RM',
      cancelHours: 12,
      email: '',
      phone: '',
      description: cfg.description,
    },
    classTypes,
    staff,
    users,
    sessions,
    bookings,
    ratings,
    packageOptions: cfg.packages,
    memberPackages,
    orders,
    promoCodes: [{ id: `${cfg.id}-promo-1`, code: 'WELCOME10', percentOff: 10, active: true, maxUses: 0, uses: 0 }],
  }
}

export function seedPlatform(now = new Date()): Platform {
  const studios = [ALIGNE, LUMEN, TIDAL].map((cfg) => seedStudio(cfg, now))
  // One account per person, shared by every studio they belong to. All demo passwords are "demo1234".
  const accounts = new Map<string, Account>()
  for (const s of studios) {
    for (const u of s.users) {
      if (!accounts.has(u.id)) {
        accounts.set(u.id, { id: u.id, name: u.name, email: u.email, phone: u.phone, birthday: u.birthday, passwordHash: DEMO_HASH, joinedAt: u.joinedAt })
      }
    }
  }
  return { version: 3, accounts: [...accounts.values()], studios }
}

/** The Aligné Pilates studio on its own (used by tests). */
export const seedState = (now = new Date()) => seedStudio(ALIGNE, now)

/** Aligné Pilates setup (class types, instructors, packages, timetable), used by scripts/setup-aligne.ts. */
export const ALIGNE_CONFIG = ALIGNE
