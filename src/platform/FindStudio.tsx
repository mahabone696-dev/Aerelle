import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Lock, MapPin, Search } from 'lucide-react'
import { usePlatform } from '../lib/store'
import { slugify, type StudioHit } from '../lib/platform'
import { navigate, useRoute } from '../lib/router'
import { UserMenu } from '../App'
import { Logo } from '../ui'

/** Turns what a student typed (studio name, code or the shared link) into a studio's link name. */
export function studioCodeFrom(input: string) {
  const v = input.trim()
  return slugify(v.match(/\/s\/([^/?#\s]+)/)?.[1] ? decodeURIComponent(v.match(/\/s\/([^/?#\s]+)/)![1]) : v)
}

/**
 * The student portal's home: find your studio. Matches appear as you type (any word of the name, 3+ letters);
 * there is no list to browse. A pasted booking link opens that studio directly.
 */
export function FindStudio() {
  const { account, searchStudios } = usePlatform()
  const route = useRoute()
  const notFound = route.query.get('notfound')
  const [value, setValue] = useState('')
  const [hits, setHits] = useState<StudioHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const isLink = /\/s\/[^/?#\s]+/.test(value)
  const enough = slugify(value).replace(/-/g, '').length >= 3

  // Search as the student types (after a short pause).
  useEffect(() => {
    if (isLink || !enough) {
      setHits(null)
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      searchStudios(value)
        .then((h) => !cancelled && setHits(h))
        .catch(() => !cancelled && setHits([]))
        .finally(() => !cancelled && setSearching(false))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [value, isLink, enough, searchStudios])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (isLink) return navigate(`/s/${studioCodeFrom(value)}/schedule`)
    if (hits?.length === 1) return navigate(`/s/${hits[0].slug}/schedule`)
    if (!hits?.length && enough && !searching) navigate(`/s/${studioCodeFrom(value)}/schedule`)
  }

  return (
    <div className="platform find-page">
      <header className="member-header">
        <div className="member-header-inner">
          <a className="brand" href="#/find">
            <Logo size={32} />
            <span className="brand-text">
              <span className="brand-name">Aerelle</span>
              <span className="brand-sub">Book your classes</span>
            </span>
          </a>
          <div className="header-actions"><UserMenu role="member" /></div>
        </div>
      </header>
      <main className="platform-content narrow">
        <section className="find-hero card">
          <span className="find-icon"><Search size={24} /></span>
          <h1>Find your studio</h1>
          <p className="muted">
            {account ? `Hi ${account.name.split(' ')[0]}. ` : ''}Start typing your studio's name, or paste the booking link it shared with you.
          </p>
          <form className="find-form" onSubmit={submit}>
            <div className="global-search dir-search">
              <Search size={16} />
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. Aligne, Pilates"
                aria-label="Studio name or booking link"
              />
            </div>
            {isLink && <button className="btn primary lg">Open studio <ArrowRight size={18} /></button>}
          </form>
          {!isLink && enough && (
            <div className="find-results" aria-live="polite">
              {searching && !hits && <p className="muted small">Searching…</p>}
              {hits && hits.length > 0 && (
                <ul>
                  {hits.map((h) => (
                    <li key={h.slug}>
                      <a className="find-hit" href={`#/s/${h.slug}/schedule`}>
                        <span className="studio-mark">{h.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                        <span className="find-hit-text">
                          <strong>{h.name}</strong>
                          {h.location && <span className="muted small"><MapPin size={12} /> {h.location}</span>}
                        </span>
                        <ArrowRight size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {hits && hits.length === 0 && !searching && (
                <p className="muted small">No studio matches “{value.trim()}”. Check the spelling, or paste the booking link your studio shared.</p>
              )}
            </div>
          )}
          {!enough && !isLink && value.trim() && <p className="muted small">Keep typing: at least 3 letters.</p>}
          {notFound && (
            <p className="error banner" role="alert">
              We couldn't find “{notFound.replace(/-/g, ' ')}”. Check the spelling, or use the booking link from your studio's Instagram, WhatsApp or website.
            </p>
          )}
          <p className="find-privacy muted small"><Lock size={14} /> Studios on Aerelle aren't listed publicly. Type part of the name to find yours.</p>
        </section>
      </main>
    </div>
  )
}
