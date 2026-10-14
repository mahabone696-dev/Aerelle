// Loads the demo studio into the local Firebase emulators for end-to-end testing (never the live project).
//   node --experimental-strip-types scripts/seed-emulator.ts
import { seedState } from '../src/lib/seed.ts'

// Same search keys as searchTokens() in src/lib/platform.ts (kept inline: that module can't load under plain node).
const searchTokens = (name: string) => {
  const out = new Set<string>()
  const words = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-')
  for (const w of words) for (let n = 3; n <= Math.min(w.length, 20); n++) out.add(w.slice(0, n))
  return [...out]
}

const PROJECT = 'aerelle-studio-696'
const AUTH = 'http://127.0.0.1:9099'
const FS = `http://127.0.0.1:8085/v1/projects/${PROJECT}/databases/(default)/documents`
const owner = { authorization: 'Bearer owner', 'content-type': 'application/json' } // emulator admin

function enc(v: unknown): object {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }
  return { mapValue: { fields: fields(v as Record<string, unknown>) } }
}
const fields = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)]))
const name = (p: string) => `projects/${PROJECT}/databases/(default)/documents/${p}`
async function post(url: string, body: unknown, headers: Record<string, string> = owner) {
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

const s = seedState(new Date())

// Tests need at least one upcoming full Reformer class the demo member isn't in (to join its waitlist).
// The generated timetable shifts with the date, so fill one deliberately.
{
  const soon = Date.now() + 26 * 3_600_000
  const target = s.sessions
    .filter((x) => x.group === 'Reformer' && new Date(x.start).getTime() > soon && !s.bookings.some((b) => b.sessionId === x.id && b.userId === 'u-demo'))
    .sort((a, b) => a.start.localeCompare(b.start))[0]
  if (target) {
    const others = s.users.filter((u) => u.role === 'member' && u.id !== 'u-demo').map((u) => u.id)
    let k = 0
    for (const uid of others) {
      const taken = s.bookings.filter((b) => b.sessionId === target.id && b.status === 'booked').length
      if (taken >= target.capacity) break
      if (s.bookings.some((b) => b.sessionId === target.id && b.userId === uid)) continue
      s.bookings.push({ id: `test-full-${k++}`, userId: uid, sessionId: target.id, status: 'booked', createdAt: new Date().toISOString() })
    }
  }
}
const sid = s.studio.id
// Logins (password demo1234) whose uid matches the demo records.
for (const [localId, email, displayName] of [['u-owner', 'owner@aerelle.test', 'Studio Owner'], ['u-demo', 'member@aerelle.test', 'Alex Morgan']]) {
  await post(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, { localId, email, password: 'demo1234', displayName, emailVerified: true })
}
const writes: object[] = []
const put = (p: string, data: Record<string, unknown>) => writes.push({ update: { name: name(p), fields: fields({ ...data, studioId: sid }) } })
put(`studios/${sid}`, { ...s.studio, classTypes: s.classTypes, staff: s.staff, packageOptions: s.packageOptions, ownerUids: ['u-owner'] })
put(`slugs/${s.studio.slug}`, { studioId: sid, createdBy: 'u-owner' })
for (const t of searchTokens(s.studio.name)) put(`searchIndex/${t}/studios/${sid}`, { sid, slug: s.studio.slug, name: s.studio.name, location: s.studio.location })
for (const u of s.users) { const { passwordHash: _p, ...rest } = u; put(`studios/${sid}/members/${u.id}`, { ...rest, email: u.email.toLowerCase(), claimed: true }) }
for (const x of s.sessions) {
  const mine = s.bookings.filter((b) => b.sessionId === x.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  put(`studios/${sid}/sessions/${x.id}`, { ...x, booked: mine.filter((b) => b.status === 'booked').map((b) => b.id), waitlist: mine.filter((b) => b.status === 'waitlisted').map((b) => b.id) })
}
for (const b of s.bookings) put(`studios/${sid}/bookings/${b.id}`, b as unknown as Record<string, unknown>)
for (const p of s.memberPackages) put(`studios/${sid}/packages/${p.id}`, p as unknown as Record<string, unknown>)
for (const o of s.orders) put(`studios/${sid}/orders/${o.id}`, o as unknown as Record<string, unknown>)
for (const r of s.ratings) put(`studios/${sid}/ratings/${r.id}`, r as unknown as Record<string, unknown>)
for (const p of s.promoCodes) put(`studios/${sid}/promos/${p.id}`, p as unknown as Record<string, unknown>)
for (let i = 0; i < writes.length; i += 400) await post(`${FS}:commit`, { writes: writes.slice(i, i + 400) })
console.log(`seeded ${s.studio.name}: ${s.users.length} people, ${s.sessions.length} classes, ${s.bookings.length} bookings, ${s.orders.length} orders, ${s.ratings.length} reviews`)
