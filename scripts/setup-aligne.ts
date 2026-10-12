// One-off: creates the Aligné Pilates owner login and the studio (profile, class types, instructors,
// packages, and the weekly timetable for the next weeks) in Firebase. No member or sales data.
//
//   ADMIN_TOKEN=<Google OAuth token with Firebase access> OWNER_EMAIL=... \
//     node --experimental-strip-types scripts/setup-aligne.ts
//
// Writes use "must not exist yet" preconditions, so running it twice can't overwrite anything.
import { randomBytes, randomUUID } from 'node:crypto'
import { ALIGNE_CONFIG as C } from '../src/lib/seed.ts'

const PROJECT = 'aerelle-studio-696'
const TOKEN = process.env.ADMIN_TOKEN
const EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase()
const WEEKS = Number(process.env.WEEKS ?? 8)
const TZ_OFFSET_HOURS = 8 // Malaysia (UTC+8), no daylight saving
if (!TOKEN || !EMAIL) throw new Error('Set ADMIN_TOKEN and OWNER_EMAIL')

const headers = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'x-goog-user-project': PROJECT }

async function call(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const j = await r.json()
  if (!r.ok) throw new Error(`${r.status} ${j.error?.message ?? JSON.stringify(j)}`)
  return j
}

// Firestore REST value encoding.
type V = string | number | boolean | null | undefined | V[] | { [k: string]: V }
function enc(v: V): object {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }
  return { mapValue: { fields: fields(v) } }
}
const fields = (o: Record<string, V>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)]))
const docName = (path: string) => `projects/${PROJECT}/databases/(default)/documents/${path}`
const create = (path: string, data: Record<string, V>) => ({ update: { name: docName(path), fields: fields(data) }, currentDocument: { exists: false } })

/** Readable but strong: 4 groups of 4 from an unambiguous alphabet, e.g. "Hk7q-..." */
function password() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(16)
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length])
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-')
}

const now = new Date()
const iso = now.toISOString()

// 1. Owner login
const pw = password()
const user = await call(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
  email: EMAIL,
  password: pw,
  displayName: C.name,
  emailVerified: true, // the studio confirmed it owns this address
})
const uid: string = user.localId

// 2. Studio, owner membership, link name reservation and timetable
const sid = `studio-${randomUUID().slice(0, 8)}`
const writes: object[] = [
  create(`accounts/${uid}`, { id: uid, name: C.name, email: EMAIL, phone: '', birthday: '', joinedAt: iso }),
  create(`slugs/${C.slug}`, { studioId: sid, createdBy: uid }),
  create(`studios/${sid}`, {
    id: sid,
    slug: C.slug,
    name: C.name,
    location: C.location,
    currency: 'RM',
    cancelHours: 12,
    email: '',
    phone: '',
    description: C.description,
    classTypes: C.classTypes.map(([name, group], i) => ({ id: `ct${i}`, name, group })),
    staff: [
      ...C.instructors.map((name, i) => ({ id: `st${i}`, name, role: 'Instructor', email: '', showOnSite: true })),
      { id: 'st-desk', name: 'Front Desk', role: 'Front desk', email: '', showOnSite: false },
    ],
    packageOptions: C.packages as unknown as V,
    ownerUids: [uid],
    createdAt: iso,
  }),
  create(`studios/${sid}/members/${uid}`, { id: uid, name: C.name, email: EMAIL, phone: '', birthday: '', role: 'owner', joinedAt: iso, claimed: true, studioId: sid }),
]

const groupOf = (title: string) => C.classTypes.find(([n]) => n === title)![1]
const todayMy = new Date(now.getTime() + TZ_OFFSET_HOURS * 3_600_000) // wall clock in Malaysia
let sessions = 0
for (let day = 0; day < WEEKS * 7; day++) {
  const d = new Date(Date.UTC(todayMy.getUTCFullYear(), todayMy.getUTCMonth(), todayMy.getUTCDate() + day))
  for (const [weekday, time, title, instructor] of C.timetable) {
    if (d.getUTCDay() !== weekday) continue
    const [h, m] = time.split(':').map(Number)
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - TZ_OFFSET_HOURS, m))
    if (start <= now) continue
    const group = groupOf(title)
    const id = `s-${start.toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${weekday}${time.replace(':', '')}`
    writes.push(
      create(`studios/${sid}/sessions/${id}`, {
        id, title, group, instructor, room: C.location, start: start.toISOString(), durationMin: 60,
        capacity: C.capacity[group] ?? 10, cost: 1, seriesId: `series-${weekday}-${time}`,
        studioId: sid, booked: [], waitlist: [],
      }),
    )
    sessions++
  }
}

// Firestore commits take up to 500 writes; the studio documents go first so later batches can reference them.
for (let i = 0; i < writes.length; i += 400) {
  await call(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, { writes: writes.slice(i, i + 400) })
}

console.log(JSON.stringify({ uid, studioId: sid, slug: C.slug, sessions, classTypes: C.classTypes.length, instructors: C.instructors.length, packages: C.packages.length }))
// The password is printed once for the person who asked for it, and not stored anywhere.
console.log(`PASSWORD=${pw}`)
