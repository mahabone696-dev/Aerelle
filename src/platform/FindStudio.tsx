import { useState, type FormEvent } from 'react'
import { ArrowRight, Lock, Search } from 'lucide-react'
import { usePlatform } from '../lib/store'
import { slugify } from '../lib/platform'
import { navigate, useRoute } from '../lib/router'
import { UserMenu } from '../App'
import { Logo } from '../ui'

/** Turns what a student typed (studio name, code or the shared link) into a studio's link name. */
export function studioCodeFrom(input: string) {
  const v = input.trim()
  return slugify(v.match(/\/s\/([^/?#\s]+)/)?.[1] ? decodeURIComponent(v.match(/\/s\/([^/?#\s]+)/)![1]) : v)
}

/**
 * The student portal's home: find your studio. Studios are private, so there is no list to browse: the
 * studio's full name, code or booking link opens it, and nothing else is revealed.
 */
export function FindStudio() {
  const { account } = usePlatform()
  const route = useRoute()
  const notFound = route.query.get('notfound')
  const [value, setValue] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const code = studioCodeFrom(value)
    if (code) navigate(`/s/${code}/schedule`)
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
            {account ? `Hi ${account.name.split(' ')[0]}. ` : ''}Enter your studio's name, or paste the booking link it shared with you.
          </p>
          <form className="find-form" onSubmit={submit}>
            <div className="global-search dir-search">
              <Search size={16} />
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. Aligné Pilates"
                aria-label="Studio name or booking link"
              />
            </div>
            <button className="btn primary lg" disabled={!studioCodeFrom(value)}>Find studio <ArrowRight size={18} /></button>
          </form>
          {notFound && (
            <p className="error banner" role="alert">
              We couldn't find “{notFound.replace(/-/g, ' ')}”. Check the spelling, or use the booking link from your studio's Instagram, WhatsApp or website.
            </p>
          )}
          <p className="find-privacy muted small"><Lock size={14} /> Studios on Aerelle aren't listed publicly. Type the full name to find yours.</p>
        </section>
      </main>
    </div>
  )
}
