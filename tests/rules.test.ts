// Security-rule tests against the Firestore emulator: `npm run test:rules`.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

let env: RulesTestEnvironment
const A = 'studio-a'
const B = 'studio-b'

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aerelle',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})
afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const [sid, owner] of [[A, 'ownerA'], [B, 'ownerB']]) {
      await setDoc(doc(db, `studios/${sid}`), { id: sid, slug: sid, name: sid, ownerUids: [owner] })
      await setDoc(doc(db, `studios/${sid}/sessions/s1`), { id: 's1', capacity: 2, booked: ['alice'], waitlist: [] })
      await setDoc(doc(db, `studios/${sid}/members/alice`), { id: 'alice', email: 'alice@x.test', role: 'member' })
      await setDoc(doc(db, `studios/${sid}/bookings/b1`), { id: 'b1', userId: 'alice', sessionId: 's1', status: 'booked' })
      await setDoc(doc(db, `studios/${sid}/packages/p1`), { id: 'p1', userId: 'alice', total: 10, remaining: 9, orderId: 'o1' })
      await setDoc(doc(db, `studios/${sid}/orders/o1`), { id: 'o1', userId: 'alice', paid: true, source: 'Online', net: 100 })
      await setDoc(doc(db, `studios/${sid}/promos/pr`), { id: 'pr', code: 'TEN', uses: 0, active: true })
      // Someone the studio added at the desk, not signed up yet.
      await setDoc(doc(db, `studios/${sid}/members/ph1`), { id: 'ph1', email: 'carol@x.test', role: 'member', claimed: false })
      await setDoc(doc(db, `studios/${sid}/packages/ph-p`), { id: 'ph-p', userId: 'ph1', total: 5, remaining: 5, orderId: 'ph-o' })
    }
  })
})

const as = (id: string, extra: Record<string, unknown> = {}) => env.authenticatedContext(id, extra).firestore()
const anon = () => env.unauthenticatedContext().firestore()

describe('public data', () => {
  it('anyone can read studios, the timetable and ratings', async () => {
    await assertSucceeds(getDoc(doc(anon(), `studios/${A}`)))
    await assertSucceeds(getDoc(doc(anon(), `studios/${A}/sessions/s1`)))
    await assertSucceeds(getDocs(query(collectionGroup(anon(), 'ratings'))))
  })
  it('nobody signed out can read members, bookings, packages or orders', async () => {
    for (const path of ['members/alice', 'bookings/b1', 'packages/p1', 'orders/o1']) {
      await assertFails(getDoc(doc(anon(), `studios/${A}/${path}`)))
    }
  })
})

describe('studio owners', () => {
  it('see their own studio’s members and sales', async () => {
    await assertSucceeds(getDoc(doc(as('ownerA'), `studios/${A}/members/alice`)))
    await assertSucceeds(getDoc(doc(as('ownerA'), `studios/${A}/orders/o1`)))
  })
  it('cannot see or change another studio’s data', async () => {
    await assertFails(getDoc(doc(as('ownerA'), `studios/${B}/members/alice`)))
    await assertFails(getDoc(doc(as('ownerA'), `studios/${B}/orders/o1`)))
    await assertFails(updateDoc(doc(as('ownerA'), `studios/${B}`), { name: 'hijacked' }))
    await assertFails(updateDoc(doc(as('ownerA'), `studios/${B}/orders/o1`), { paid: false }))
  })
  it('cannot remove every owner or change the studio id', async () => {
    await assertFails(updateDoc(doc(as('ownerA'), `studios/${A}`), { ownerUids: [] }))
    await assertFails(updateDoc(doc(as('ownerA'), `studios/${A}`), { id: 'other' }))
  })
  it('a new studio must be owned by its creator', async () => {
    await assertSucceeds(setDoc(doc(as('dan'), 'studios/new1'), { id: 'new1', slug: 'new1', ownerUids: ['dan'] }))
    await assertFails(setDoc(doc(as('dan'), 'studios/new2'), { id: 'new2', slug: 'new2', ownerUids: ['ownerA'] }))
  })
})

describe('members', () => {
  it('see only their own records', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), `studios/${A}/bookings/b1`)))
    await assertSucceeds(getDocs(query(collectionGroup(as('alice'), 'members'), where('id', '==', 'alice'))))
    await assertFails(getDoc(doc(as('bob'), `studios/${A}/bookings/b1`)))
    await assertFails(getDoc(doc(as('bob'), `studios/${A}/members/alice`)))
    await assertFails(getDocs(query(collectionGroup(as('bob'), 'members'))))
  })
  it('can join a studio only as a member', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), `studios/${A}/members/bob`), { id: 'bob', role: 'member', email: 'bob@x.test' }))
    await assertFails(setDoc(doc(as('eve'), `studios/${A}/members/eve`), { id: 'eve', role: 'owner', email: 'eve@x.test' }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/members/alice`), { role: 'owner' }))
  })
  it('can take a spot for themselves within capacity', async () => {
    await assertSucceeds(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { booked: ['alice', 'bob'] }))
  })
  it('cannot overbook, book someone else, remove others, or write from a stale timetable', async () => {
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { booked: ['alice', 'bob', 'zed'] }))
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { booked: ['alice', 'zed'] }))
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { booked: [] }))
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { capacity: 50 }))
    // Bob computed his list before Zed took the last spot: the server rejects it.
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), `studios/${A}/sessions/s1`), { booked: ['alice', 'zed'] }))
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { booked: ['alice', 'bob'] }))
  })
  it('join the waitlist at the back and can leave it', async () => {
    await assertSucceeds(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { waitlist: ['bob'] }))
    await assertSucceeds(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { waitlist: [] }))
  })
  it('cannot mark their own attendance or give themselves classes', async () => {
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/bookings/b1`), { attendance: 'attended' }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { remaining: 11 }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { total: 100, remaining: 100 }))
    await assertFails(setDoc(doc(as('alice'), `studios/${A}/packages/free`), { id: 'free', userId: 'alice', total: 50, remaining: 50, orderId: 'nope' }))
    await assertSucceeds(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { remaining: 8 }))
  })
  it('buying online creates an unpaid order the studio confirms', async () => {
    const db = as('alice')
    const batch = writeBatch(db)
    batch.set(doc(db, `studios/${A}/orders/o2`), { id: 'o2', userId: 'alice', paid: false, source: 'Online', net: 50 })
    batch.set(doc(db, `studios/${A}/packages/p2`), { id: 'p2', userId: 'alice', total: 4, remaining: 4, orderId: 'o2' })
    await assertSucceeds(batch.commit())
    await assertFails(setDoc(doc(db, `studios/${A}/orders/o3`), { id: 'o3', userId: 'alice', paid: true, source: 'Online', net: 50 }))
    await assertFails(updateDoc(doc(db, `studios/${A}/orders/o2`), { paid: true }))
    await assertSucceeds(updateDoc(doc(as('ownerA'), `studios/${A}/orders/o2`), { paid: true }))
  })
  it('can count one promo use, nothing else', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), `studios/${A}/promos/pr`), { uses: 1 }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/promos/pr`), { uses: 0 }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/promos/pr`), { active: false }))
  })
  it('can rate with 1–5 stars as themselves', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), `studios/${A}/ratings/r1`), { id: 'r1', userId: 'alice', stars: 5 }))
    await assertFails(setDoc(doc(as('alice'), `studios/${A}/ratings/r2`), { id: 'r2', userId: 'bob', stars: 5 }))
    await assertFails(setDoc(doc(as('alice'), `studios/${A}/ratings/r3`), { id: 'r3', userId: 'alice', stars: 9 }))
  })
})

describe('claiming records a studio added before sign-up', () => {
  const carol = (verified: boolean) => as('carol-uid', { email: 'carol@x.test', email_verified: verified })

  it('works only with the same, verified email', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(carol(true), 'members'), where('email', '==', 'carol@x.test'))))
    await assertSucceeds(updateDoc(doc(carol(true), `studios/${A}/packages/ph-p`), { userId: 'carol-uid' }))
    await assertFails(getDoc(doc(carol(false), `studios/${A}/members/ph1`)))
    await assertFails(updateDoc(doc(carol(false), `studios/${B}/packages/ph-p`), { userId: 'carol-uid' }))
    await assertFails(updateDoc(doc(as('mallory', { email: 'mallory@x.test', email_verified: true }), `studios/${A}/packages/ph-p`), { userId: 'mallory' }))
  })
  it('only moves ownership, and the placeholder can then be removed', async () => {
    await assertFails(updateDoc(doc(carol(true), `studios/${A}/packages/ph-p`), { userId: 'carol-uid', remaining: 50 }))
    await assertSucceeds(deleteDoc(doc(carol(true), `studios/${A}/members/ph1`)))
  })
})
