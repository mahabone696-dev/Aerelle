import { describe, expect, it } from 'vitest'
import { addMember, book, canRate, classesLeft, spotsLeft } from './model'
import { createStudio, homeFor, joinStudio, roleIn, slugify, studioBySlug, studiosFor, syncAccounts, uniqueSlug } from './platform'
import { seedPlatform } from './seed'

const NOW = new Date('2026-10-12T08:00:00Z')
const input = { name: 'Harbour Pilates', location: 'Bangsar, KL', currency: 'rm', cancelHours: 24, description: '', template: 'pilates' as const }

describe('demo platform', () => {
  const p = seedPlatform(NOW)

  it('has several independent studios sharing one account list', () => {
    expect(p.studios.map((s) => s.studio.slug)).toEqual(['aligne-pilates', 'lumen-reformer', 'tidal-yoga-barre'])
    const ids = new Set(p.accounts.map((a) => a.id))
    for (const s of p.studios) for (const u of s.users) expect(ids.has(u.id)).toBe(true)
    // Session ids never collide across studios.
    const all = p.studios.flatMap((s) => s.sessions.map((x) => x.id))
    expect(new Set(all).size).toBe(all.length)
  })

  it('gives the demo owner two studios and the demo member two memberships', () => {
    expect(studiosFor(p, 'u-owner').owned.map((s) => s.studio.slug)).toEqual(['aligne-pilates', 'lumen-reformer'])
    expect(studiosFor(p, 'u-demo').joined.map((s) => s.studio.slug)).toEqual(['aligne-pilates', 'lumen-reformer'])
    expect(homeFor(p, 'u-owner')).toBe('/s/aligne-pilates/overview')
    expect(homeFor(p, 'u-demo')).toBe('/s/aligne-pilates/schedule')
  })

  it('keeps each studio consistent', () => {
    for (const s of p.studios) {
      for (const sess of s.sessions) expect(spotsLeft(s, sess)).toBeGreaterThanOrEqual(0)
      expect(s.memberPackages.every((m) => m.remaining >= 0)).toBe(true)
    }
    const aligne = studioBySlug(p, 'aligne-pilates')!
    expect(aligne.sessions.some((x) => canRate(aligne, 'u-demo', x, NOW))).toBe(true)
  })

  it("keeps a member's packages separate per studio", () => {
    const aligne = studioBySlug(p, 'aligne-pilates')!
    const lumen = studioBySlug(p, 'lumen-reformer')!
    expect(classesLeft(lumen, 'u-demo', NOW)).toBeGreaterThan(0)
    // An Aligné package can't book a Lumen class: Lumen's state has no Aligné packages at all.
    expect(lumen.memberPackages.some((m) => aligne.memberPackages.some((x) => x.id === m.id))).toBe(false)
    const lumenClass = lumen.sessions.find((x) => new Date(x.start) > NOW && spotsLeft(lumen, x) > 0)!
    expect(() => book(lumen, 'u-demo', lumenClass.id, NOW)).not.toThrow()
  })
})

describe('creating and joining studios', () => {
  it('creates a studio owned by the account, with starter types and packages', () => {
    const { platform, slug } = createStudio(seedPlatform(NOW), 'u-demo', input, NOW)
    const s = studioBySlug(platform, slug)!
    expect(slug).toBe('harbour-pilates')
    expect(roleIn(s, 'u-demo')).toBe('owner')
    expect(s.studio).toMatchObject({ currency: 'RM', cancelHours: 24 })
    expect(s.classTypes.length).toBeGreaterThan(0)
    expect(s.packageOptions.length).toBeGreaterThan(0)
    expect(s.sessions).toEqual([])
    expect(homeFor(platform, 'u-demo')).toBe('/s/harbour-pilates/overview')
  })

  it('validates the form', () => {
    expect(() => createStudio(seedPlatform(NOW), 'u-demo', { ...input, name: ' ' }, NOW)).toThrow(/name/)
    expect(() => createStudio(seedPlatform(NOW), 'u-demo', { ...input, location: '' }, NOW)).toThrow(/location/)
    expect(() => createStudio(seedPlatform(NOW), 'nobody', input, NOW)).toThrow(/Sign in/)
  })

  it('makes slugs URL-safe and unique', () => {
    expect(slugify('Aligné Pilates & Co.')).toBe('aligne-pilates-co')
    expect(uniqueSlug(seedPlatform(NOW), 'Aligné Pilates')).toBe('aligne-pilates-2')
    const { platform } = createStudio(seedPlatform(NOW), 'u-demo', { ...input, name: 'Lumen Reformer' }, NOW)
    expect(platform.studios.at(-1)!.studio.slug).toBe('lumen-reformer-2')
  })

  it('joining adds a member record once', () => {
    const p = seedPlatform(NOW)
    const tidal = studioBySlug(p, 'tidal-yoga-barre')!
    expect(roleIn(tidal, 'u-demo')).toBeNull()
    let next = joinStudio(p, tidal.studio.id, 'u-demo', NOW)
    next = joinStudio(next, tidal.studio.id, 'u-demo', NOW)
    const joined = studioBySlug(next, 'tidal-yoga-barre')!
    expect(joined.users.filter((u) => u.id === 'u-demo')).toHaveLength(1)
    expect(roleIn(joined, 'u-demo')).toBe('member')
    // Joining one studio as a member doesn't change roles elsewhere.
    expect(roleIn(studioBySlug(next, 'aligne-pilates')!, 'u-owner')).toBe('owner')
  })
})

describe('members added at a front desk', () => {
  it('get a passwordless account that they can claim later', () => {
    const p = seedPlatform(NOW)
    const tidal = studioBySlug(p, 'tidal-yoga-barre')!
    const withNew = { ...p, studios: p.studios.map((s) => (s === tidal ? addMember(s, { name: 'New Person', email: 'new@x.test', phone: '', birthday: '' }, NOW) : s)) }
    const synced = syncAccounts(withNew, tidal.studio.id)
    const account = synced.accounts.find((a) => a.email === 'new@x.test')!
    expect(account.passwordHash).toBe('')
    expect(studioBySlug(synced, 'tidal-yoga-barre')!.users.some((u) => u.id === account.id)).toBe(true)
  })

  it('reuse an existing account with the same email instead of duplicating it', () => {
    const p = seedPlatform(NOW)
    const tidal = studioBySlug(p, 'tidal-yoga-barre')!
    const withExisting = { ...p, studios: p.studios.map((s) => (s === tidal ? addMember(s, { name: 'Alex', email: 'member@aerelle.test', phone: '', birthday: '' }, NOW) : s)) }
    const synced = syncAccounts(withExisting, tidal.studio.id)
    expect(synced.accounts.filter((a) => a.email === 'member@aerelle.test')).toHaveLength(1)
    expect(roleIn(studioBySlug(synced, 'tidal-yoga-barre')!, 'u-demo')).toBe('member')
  })
})
