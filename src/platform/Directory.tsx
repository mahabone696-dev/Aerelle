import { ArrowRight, CalendarDays, Lock, MapPin, Plus, Star } from 'lucide-react'
import { usePlatform } from '../lib/store'
import { averageRating } from '../lib/model'
import { roleIn, studiosFor } from '../lib/platform'
import { fmtDay, fmtTime, plural } from '../lib/format'
import { UserMenu } from '../App'
import { initials, Logo } from '../ui'

/**
 * The studios you belong to. Studios are private: there is no public list or search, so people reach a
 * studio only through the booking link that studio shares.
 */
export function Directory() {
  const { platform, account } = usePlatform()
  const now = new Date()
  const weekAhead = now.getTime() + 7 * 86_400_000
  if (!account) return null
  const { owned, joined } = studiosFor(platform, account.id)

  const studios = [...owned, ...joined].map((s) => {
    const upcoming = s.sessions.filter((x) => new Date(x.start) > now).sort((a, b) => a.start.localeCompare(b.start))
    return {
      s,
      role: roleIn(s, account.id),
      rating: averageRating(s),
      next: upcoming[0],
      thisWeek: upcoming.filter((x) => new Date(x.start).getTime() < weekAhead).length,
      groups: [...new Set(s.classTypes.map((c) => c.group))],
    }
  })

  return (
    <div className="platform">
      <PlatformHeader />
      <main className="platform-content">
        <section className="dir-hero">
          <h1>Your studios</h1>
          <p className="muted">Studios you book with or run. To join a new studio, open the booking link it shared with you.</p>
        </section>

        <ul className="studio-grid">
          {studios.map(({ s, role, rating, next, thisWeek, groups }) => (
            <li key={s.studio.id} className="card studio-card">
              <div className="studio-card-head">
                <span className="studio-mark xl">{initials(s.studio.name)}</span>
                <div>
                  <h2 className="flush">{s.studio.name}</h2>
                  <p className="muted small"><MapPin size={13} /> {s.studio.location}</p>
                </div>
                {role && <span className={`badge ${role === 'owner' ? 'owner' : ''}`}>{role === 'owner' ? 'You run this' : 'Member'}</span>}
              </div>
              <div className="chips">
                {groups.map((g) => <span key={g} className="chip static">{g}</span>)}
              </div>
              <dl className="studio-facts">
                <div>
                  <dt>Rating</dt>
                  <dd>{rating ? <><Star size={13} className="star-icon" /> {rating.average.toFixed(1)} <span className="muted">({rating.count})</span></> : 'New'}</dd>
                </div>
                <div>
                  <dt>Next 7 days</dt>
                  <dd>{plural(thisWeek, 'class', 'classes')}</dd>
                </div>
                <div>
                  <dt>Next class</dt>
                  <dd>{next ? `${fmtDay(new Date(next.start))}, ${fmtTime(new Date(next.start))}` : '–'}</dd>
                </div>
              </dl>
              <a className="btn primary block" href={`#/s/${s.studio.slug}/${role === 'owner' ? 'overview' : 'schedule'}`}>
                {role === 'owner' ? 'Open studio admin' : 'Book a class'} <ArrowRight size={16} />
              </a>
            </li>
          ))}
          {studios.length === 0 && (
            <li className="card empty-studios">
              <Lock size={22} />
              <h2 className="flush">No studios yet</h2>
              <p className="muted">
                For privacy, studios on Aerelle aren't listed publicly. Open the booking link your studio shared
                (on Instagram, WhatsApp or their website) and you'll be able to book straight away.
              </p>
            </li>
          )}
        </ul>

        <section className="card cta-card">
          <div>
            <h2 className="flush">Run a studio?</h2>
            <p className="muted">Set up your timetable, packages and members in a few minutes. You get your own private booking link to share.</p>
          </div>
          <a className="btn primary" href="#/new-studio"><Plus size={16} /> Create your studio</a>
        </section>
      </main>
    </div>
  )
}

export function PlatformHeader() {
  return (
    <header className="member-header">
      <div className="member-header-inner">
        <a className="brand" href="#/">
          <Logo size={32} />
          <span className="brand-text">
            <span className="brand-name">Aerelle</span>
            <span className="brand-sub">Studio booking</span>
          </span>
        </a>
        <nav aria-label="Main" className="member-nav">
          <a href="#/studios" aria-current={location.hash.startsWith('#/studios') ? 'page' : undefined}><CalendarDays size={17} /> Your studios</a>
          <a href="#/new-studio" aria-current={location.hash.startsWith('#/new-studio') ? 'page' : undefined}><Plus size={17} /> Create a studio</a>
        </nav>
        <div className="header-actions">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
