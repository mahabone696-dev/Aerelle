// Security-rule tests against the Firestore emulator: `npm run test:rules`.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

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
      await setDoc(doc(db, `studios/${sid}/sessions/s1`), { id: 's1', capacity: 2, cost: 1, booked: ['b1'], waitlist: [] })
      await setDoc(doc(db, `studios/${sid}/members/alice`), { id: 'alice', email: 'alice@x.test', role: 'member' })
      await setDoc(doc(db, `studios/${sid}/bookings/b1`), { id: 'b1', userId: 'alice', sessionId: 's1', status: 'booked' })
      await setDoc(doc(db, `studios/${sid}/packages/p1`), { id: 'p1', userId: 'alice', total: 10, remaining: 9, orderId: 'o1' })
      await setDoc(doc(db, `studios/${sid}/packages/bob-p`), { id: 'bob-p', userId: 'bob', total: 5, remaining: 5, orderId: 'bob-o' })
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
  it('anyone with a studio link can open its profile, timetable and ratings', async () => {
    await assertSucceeds(getDoc(doc(anon(), `slugs/a-studio`)))
    await assertSucceeds(getDoc(doc(anon(), `studios/${A}`)))
    await assertSucceeds(getDocs(collection(anon(), `studios/${A}/sessions`)))
    await assertSucceeds(getDocs(collection(anon(), `studios/${A}/ratings`)))
  })
  it('nobody can list or search studios, links, timetables or ratings', async () => {
    for (const db of [anon(), as('alice')]) {
      await assertFails(getDocs(collection(db, 'studios')))
      await assertFails(getDocs(collection(db, 'slugs')))
      await assertFails(getDocs(query(collectionGroup(db, 'sessions'))))
      await assertFails(getDocs(query(collectionGroup(db, 'ratings'))))
    }
  })
  it('a person can list only their own packages across studios', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(as('alice'), 'packages'), where('userId', '==', 'alice'))))
    await assertFails(getDocs(query(collectionGroup(as('alice'), 'packages'), where('userId', '==', 'bob'))))
    await assertFails(getDocs(query(collectionGroup(as('alice'), 'packages'))))
    await assertFails(getDocs(query(collectionGroup(anon(), 'packages'), where('userId', '==', 'alice'))))
  })
  it('name search: anyone can look up one search key; only owners write their own entries; keys cannot be listed', async () => {
    await assertSucceeds(setDoc(doc(as('ownerA'), `searchIndex/ali/studios/${A}`), { sid: A, slug: 'a', name: 'A studio', location: 'X' }))
    await assertSucceeds(getDocs(collection(anon(), 'searchIndex/ali/studios')))
    await assertFails(setDoc(doc(as('ownerA'), `searchIndex/ali/studios/${B}`), { sid: B, slug: 'b', name: 'Hijack', location: '' }))
    await assertFails(setDoc(doc(as('alice'), `searchIndex/ali/studios/${A}`), { sid: A, slug: 'a', name: 'Spoof', location: '' }))
    await assertFails(getDocs(collection(anon(), 'searchIndex')))
    await assertFails(getDocs(query(collectionGroup(anon(), 'studios'))))
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
  // Bob books: his booking and the timetable change are saved together.
  const bobBooks = (db: ReturnType<typeof as>, status: string, list: 'booked' | 'waitlist', value: string[], bookingId = 'bob-b') => {
    const batch = writeBatch(db)
    const booking: Record<string, unknown> = { id: bookingId, userId: 'bob', sessionId: 's1', status }
    if (status === 'booked') { booking.packageId = 'bob-p'; booking.credits = 1 }
    batch.set(doc(db, `studios/${A}/bookings/${bookingId}`), booking)
    batch.update(doc(db, `studios/${A}/sessions/s1`), { [list]: value })
    // A confirmed spot spends one credit from Bob's package, in the same write.
    if (status === 'booked') batch.update(doc(db, `studios/${A}/packages/bob-p`), { remaining: 4, spendFor: bookingId })
    return batch.commit()
  }
  it('can take a spot for themselves within capacity', async () => {
    await assertSucceeds(bobBooks(as('bob'), 'booked', 'booked', ['b1', 'bob-b']))
  })
  it('cannot overbook, use someone else’s booking, remove others, or write from a stale timetable', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `studios/${A}/bookings/zed-b`), { id: 'zed-b', userId: 'zed', sessionId: 's1', status: 'booked' }))
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { booked: ['b1', 'zed-b'] }))
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { booked: [] }))
    await assertFails(updateDoc(doc(as('bob'), `studios/${A}/sessions/s1`), { capacity: 50 }))
    // Session full (capacity 2): Bob's third spot is refused.
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), `studios/${A}/sessions/s1`), { booked: ['b1', 'zed-b'] }))
    await assertFails(bobBooks(as('bob'), 'booked', 'booked', ['b1', 'zed-b', 'bob-b']))
    // Bob computed his list before Zed took the last spot: the server rejects the stale list.
    await assertFails(bobBooks(as('bob'), 'booked', 'booked', ['b1', 'bob-b']))
  })
  it('join the waitlist at the back and can leave it', async () => {
    await assertSucceeds(bobBooks(as('bob'), 'waitlisted', 'waitlist', ['bob-b']))
    const db = as('bob')
    const batch = writeBatch(db)
    batch.update(doc(db, `studios/${A}/bookings/bob-b`), { status: 'cancelled' })
    batch.update(doc(db, `studios/${A}/sessions/s1`), { waitlist: [] })
    await assertSucceeds(batch.commit())
  })
  it('cannot mark their own attendance or give themselves classes', async () => {
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/bookings/b1`), { attendance: 'attended' }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { remaining: 11 }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { total: 100, remaining: 100 }))
    await assertFails(setDoc(doc(as('alice'), `studios/${A}/packages/free`), { id: 'free', userId: 'alice', total: 50, remaining: 50, orderId: 'nope' }))
    // A bare change to remaining, not tied to a booking in the same write, is refused either way.
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { remaining: 8 }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { remaining: 10 }))
    await assertFails(updateDoc(doc(as('alice'), `studios/${A}/bookings/b1`), { credits: 9 }))
  })

  // Credits can only move with a real booking: a spend needs a booking being confirmed in the same write,
  // a refund needs one being cancelled. Members can never hand themselves credits.
  describe('credit conservation', () => {
    const spendBatch = (remaining: number, spendFor = 'a-b2', credits = 1) => {
      const db = as('alice')
      const batch = writeBatch(db)
      batch.set(doc(db, `studios/${A}/bookings/a-b2`), { id: 'a-b2', userId: 'alice', sessionId: 's1', status: 'booked', packageId: 'p1', credits })
      batch.update(doc(db, `studios/${A}/sessions/s1`), { booked: ['b1', 'a-b2'] })
      batch.update(doc(db, `studios/${A}/packages/p1`), { remaining, spendFor })
      return batch.commit()
    }
    it('a confirmed booking that spends exactly its credits is allowed', async () => {
      await assertSucceeds(spendBatch(8))
    })
    it('a confirmed booking that does not spend (package untouched) is refused', async () => {
      const db = as('alice')
      const batch = writeBatch(db)
      batch.set(doc(db, `studios/${A}/bookings/a-b2`), { id: 'a-b2', userId: 'alice', sessionId: 's1', status: 'booked', packageId: 'p1', credits: 1 })
      batch.update(doc(db, `studios/${A}/sessions/s1`), { booked: ['b1', 'a-b2'] })
      await assertFails(batch.commit())
    })
    it('a spend that deducts fewer credits than the booking claims is refused', async () => {
      await assertFails(spendBatch(9)) // booking says 1 credit, package unchanged
    })
    it('refunding a cancelled booking returns exactly its credits', async () => {
      const db = as('alice')
      const batch = writeBatch(db)
      batch.update(doc(db, `studios/${A}/bookings/b1`), { status: 'cancelled' })
      batch.update(doc(db, `studios/${A}/sessions/s1`), { booked: [] })
      batch.update(doc(db, `studios/${A}/packages/p1`), { remaining: 10, refundFrom: 'b1' })
      await assertSucceeds(batch.commit())
    })
    it('a refund larger than the booking spent is refused', async () => {
      await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), `studios/${A}/packages/p1`), { remaining: 8 }))
      const db = as('alice')
      const batch = writeBatch(db)
      batch.update(doc(db, `studios/${A}/bookings/b1`), { status: 'cancelled' })
      batch.update(doc(db, `studios/${A}/sessions/s1`), { booked: [] })
      batch.update(doc(db, `studios/${A}/packages/p1`), { remaining: 10, refundFrom: 'b1' }) // +2, but b1 spent 1
      await assertFails(batch.commit())
    })
    it('a refund from a booking that is already cancelled (replay) is refused', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), `studios/${A}/bookings/b1`), { status: 'cancelled' })
        await updateDoc(doc(ctx.firestore(), `studios/${A}/packages/p1`), { remaining: 9 })
      })
      await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { remaining: 10, refundFrom: 'b1' }))
    })
    it('cannot spend by pointing at someone else’s or an already-booked booking', async () => {
      // b1 is already a confirmed (not newly created, not waitlisted) booking, so it can't justify a new spend.
      await assertFails(updateDoc(doc(as('alice'), `studios/${A}/packages/p1`), { remaining: 8, spendFor: 'b1' }))
    })
    it('claiming a freed waitlist spot must spend a credit; a free-ride claim is refused', async () => {
      // Put Bob first on the waitlist of a session with an open spot.
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore()
        await setDoc(doc(db, `studios/${A}/sessions/s1`), { id: 's1', capacity: 2, cost: 1, booked: [], waitlist: ['bob-w'] })
        await setDoc(doc(db, `studios/${A}/bookings/bob-w`), { id: 'bob-w', userId: 'bob', sessionId: 's1', status: 'waitlisted' })
      })
      const claim = (spend: boolean, credits = 1) => {
        const db = as('bob')
        const batch = writeBatch(db)
        batch.set(doc(db, `studios/${A}/bookings/bob-w`), { id: 'bob-w', userId: 'bob', sessionId: 's1', status: 'booked', packageId: 'bob-p', credits })
        batch.update(doc(db, `studios/${A}/sessions/s1`), { booked: ['bob-w'], waitlist: [] })
        if (spend) batch.update(doc(db, `studios/${A}/packages/bob-p`), { remaining: 4, spendFor: 'bob-w' })
        return batch.commit()
      }
      await assertFails(claim(false))        // claim without spending
      await assertFails(claim(false, 0))     // claim a paid class as "free"
      await assertSucceeds(claim(true))      // the real claim spends one credit
    })
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
  it('anyone can see a studio’s DuitNow QR; only its owners can set it, as a small image', async () => {
    const qr = { qr: 'data:image/png;base64,iVBORw0KGgo=', updatedAt: '2026-10-17T00:00:00Z' }
    await assertSucceeds(setDoc(doc(as('ownerA'), `studios/${A}/payment/duitnow`), qr))
    await assertSucceeds(getDoc(doc(anon(), `studios/${A}/payment/duitnow`)))
    await assertFails(setDoc(doc(as('alice'), `studios/${A}/payment/duitnow`), qr))
    await assertFails(setDoc(doc(as('ownerB'), `studios/${A}/payment/duitnow`), qr))
    await assertFails(setDoc(doc(as('ownerA'), `studios/${A}/payment/other`), qr))
    await assertFails(setDoc(doc(as('ownerA'), `studios/${A}/payment/duitnow`), { ...qr, extra: 1 }))
    await assertFails(setDoc(doc(as('ownerA'), `studios/${A}/payment/duitnow`), { ...qr, qr: 'javascript:alert(1)' }))
    await assertFails(setDoc(doc(as('ownerA'), `studios/${A}/payment/duitnow`), { ...qr, qr: 'data:image/png;base64,' + 'A'.repeat(700_000) }))
    await assertFails(deleteDoc(doc(as('alice'), `studios/${A}/payment/duitnow`)))
    await assertSucceeds(deleteDoc(doc(as('ownerA'), `studios/${A}/payment/duitnow`)))
  })
  it('a DuitNow order stays unpaid until the studio confirms it', async () => {
    const db = as('alice')
    await assertSucceeds(setDoc(doc(db, `studios/${A}/orders/o4`), { id: 'o4', userId: 'alice', paid: false, source: 'Online', method: 'DuitNow', reference: 'AP-1234', net: 50 }))
    await assertFails(updateDoc(doc(db, `studios/${A}/orders/o4`), { paid: true }))
    await assertSucceeds(updateDoc(doc(as('ownerA'), `studios/${A}/orders/o4`), { paid: true }))
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
    await assertSucceeds(getDocs(query(collection(carol(true), `studios/${A}/packages`), where('userId', '==', 'ph1'))))
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
