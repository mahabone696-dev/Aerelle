import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { averageRating, book, cancel, groupsOf, packageFor, spotsLeft, userBooking, waitlist, type Session } from '../lib/model'
import { dayKey, fmtDay, fmtTime, plural, sameDay, startOfDay } from '../lib/format'
import { navigate } from '../lib/router'
import { Stars } from '../ui'

export function Schedule() {
  const { state, user, apply } = useStore()
  const now = new Date()
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => startOfDay(new Date(), i)), [])
  const [day, setDay] = useState(days[0])
  const [group, setGroup] = useState('All')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; buy?: boolean } | null>(null)

  const groups = ['All', ...groupsOf(state).filter((g) => state.sessions.some((s) => s.group === g))]
  const list = state.sessions
    .filter((s) => sameDay(new Date(s.start), day) && (group === 'All' || s.group === group))
    .sort((a, b) => a.start.localeCompare(b.start))

  if (!user) return null

  function act(session: Session, kind: 'book' | 'cancel') {
    const err = apply((s) => (kind === 'book' ? book(s, user!.id, session.id) : cancel(s, user!.id, session.id)))
    if (err) return setMessage({ kind: 'error', text: err, buy: err.includes('package') })
    const full = spotsLeft(state, session) === 0
    const when = `${fmtDay(new Date(session.start))} at ${fmtTime(new Date(session.start))}`
    setMessage({
      kind: 'ok',
      text:
        kind === 'book'
          ? full
            ? `You're on the waitlist for ${session.title}. You'll be booked in automatically if a spot opens.`
            : `Booked: ${session.title}, ${when}.`
          : `Cancelled ${session.title}.`,
    })
  }

  return (
    <section>
      <header className="page-head">
        <h1>Schedule</h1>
        <p className="muted">
          {state.studio.name} · {state.studio.location}. Cancel at least {state.studio.cancelHours} hours before class
          to get the class back.
        </p>
      </header>

      <div className="days scroll" role="tablist" aria-label="Day">
        {days.map((d) => (
          <button key={dayKey(d)} role="tab" aria-selected={sameDay(d, day)} className="day" onClick={() => setDay(d)}>
            <span className="small">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <strong>{d.getDate()}</strong>
          </button>
        ))}
      </div>

      <div className="chips">
        {groups.map((g) => (
          <button key={g} className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      {message && (
        <p className={message.kind === 'error' ? 'error banner' : 'ok banner'} role="status">
          <span>
            {message.text}{' '}
            {message.buy && <button className="link" onClick={() => navigate('/credits')}>See packages</button>}
          </span>
          <button className="link" onClick={() => setMessage(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      {list.length === 0 && <p className="empty">No classes on this day.</p>}
      <ul className="sessions">
        {list.map((s) => {
          const start = new Date(s.start)
          const left = spotsLeft(state, s)
          const mine = userBooking(state, user.id, s.id)
          const queue = waitlist(state, s.id)
          const pos = mine?.status === 'waitlisted' ? queue.findIndex((b) => b.id === mine.id) + 1 : 0
          const rating = averageRating(state, (x) => x.title === s.title)
          const pkg = !mine ? packageFor(state, user.id, s, now) : undefined
          return (
            <li key={s.id} className="card session">
              <div className="time">
                <strong>{fmtTime(start)}</strong>
                <span className="muted small">{s.durationMin} min</span>
              </div>
              <div className="info">
                <span className="tag">{s.group}</span>
                <h3>{s.title}</h3>
                <p className="muted small">
                  {s.instructor} · {s.room} · {plural(s.cost, 'class', 'classes')}
                </p>
                {rating && (
                  <p className="small">
                    <Stars value={rating.average} /> {rating.average.toFixed(1)} <span className="muted">({rating.count})</span>
                  </p>
                )}
              </div>
              <div className="cta">
                <span className={`spots ${left === 0 ? 'full' : left <= 2 ? 'low' : ''}`}>
                  {left === 0 ? `Full · ${queue.length} waiting` : `${plural(left, 'spot')} left`}
                </span>
                {start <= now ? (
                  <button className="btn" disabled>Started</button>
                ) : mine ? (
                  <>
                    <span className={`badge ${mine.status}`}>{mine.status === 'booked' ? 'Booked' : `Waitlist #${pos}`}</span>
                    <button className="btn ghost" onClick={() => act(s, 'cancel')}>
                      {mine.status === 'booked' ? 'Cancel' : 'Leave waitlist'}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn primary" onClick={() => act(s, 'book')}>
                      {left === 0 ? 'Join waitlist' : 'Book'}
                    </button>
                    <span className="muted tiny">{pkg ? `Uses ${pkg.name}` : `Needs a ${s.group} package`}</span>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
