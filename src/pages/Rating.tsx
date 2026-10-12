import { useState } from 'react'
import { useStore } from '../lib/store'
import { canRate, rate, type Session } from '../lib/model'
import { fmtDay, fmtTime } from '../lib/format'
import { navigate, type Route } from '../lib/router'

export function Rating({ route }: { route: Route }) {
  const { state, user } = useStore()
  if (!user) return null
  const now = new Date()
  const pending = state.sessions
    .filter((s) => canRate(state, user.id, s, now))
    .sort((a, b) => b.start.localeCompare(a.start))
  const focus = route.query.get('session')
  const mine = state.ratings
    .filter((r) => r.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <section>
      <header className="page-head">
        <h1>Rate your classes</h1>
        <p className="muted">Your feedback goes straight to the instructor and studio.</p>
      </header>

      {pending.length === 0 ? (
        <p className="empty">
          You're all caught up. <button className="link" onClick={() => navigate('/schedule')}>Book your next class</button>
        </p>
      ) : (
        <ul className="rows">
          {pending.map((s) => (
            <RateCard key={s.id} session={s} autoFocus={s.id === focus} />
          ))}
        </ul>
      )}

      {mine.length > 0 && (
        <>
          <h2>Your reviews</h2>
          <ul className="rows">
            {mine.map((r) => {
              const s = state.sessions.find((x) => x.id === r.sessionId)
              return (
                <li key={r.id} className="card row">
                  <div>
                    <strong>{s?.title ?? 'Removed class'}</strong>
                    {r.comment && <p className="small">“{r.comment}”</p>}
                  </div>
                  <span className="stars-static">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function RateCard({ session, autoFocus }: { session: Session; autoFocus: boolean }) {
  const { user, apply } = useStore()
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const start = new Date(session.start)
  const shown = hover || stars

  return (
    <li className={`card rate ${autoFocus ? 'focus' : ''}`}>
      <div>
        <strong>{session.title}</strong>
        <p className="muted small">
          {fmtDay(start)} · {fmtTime(start)} · with {session.instructor}
        </p>
      </div>
      <div className="star-input" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={n <= shown ? 'on' : ''}
            onMouseEnter={() => setHover(n)}
            onClick={() => setStars(n)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        placeholder="What did you enjoy? Anything to improve? (optional)"
        value={comment}
        maxLength={500}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button
        className="btn primary"
        disabled={!stars}
        onClick={() => setError(apply((s) => rate(s, user!.id, session.id, stars, comment)))}
      >
        Submit rating
      </button>
    </li>
  )
}
