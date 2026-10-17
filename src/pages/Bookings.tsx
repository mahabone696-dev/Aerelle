import { useState } from 'react'
import { useStore } from '../lib/store'
import { canRate, cancel, isFreeCancel, type BookingStatus } from '../lib/model'
import { fmtDay, fmtTime } from '../lib/format'
import { navigate } from '../lib/router'

const LABEL: Record<BookingStatus, string> = {
  booked: 'Booked',
  waitlisted: 'Waitlist',
  cancelled: 'Cancelled',
  'late-cancelled': 'Late cancel',
}

export function Bookings() {
  const { state, user, apply } = useStore()
  const [error, setError] = useState<string | null>(null)
  if (!user) return null
  const now = new Date()

  const rows = state.bookings
    .filter((b) => b.userId === user.id)
    .map((b) => ({ booking: b, session: state.sessions.find((s) => s.id === b.sessionId) }))
    .filter((r): r is { booking: typeof r.booking; session: NonNullable<typeof r.session> } => !!r.session)

  const upcoming = rows
    .filter((r) => new Date(r.session.start) > now && (r.booking.status === 'booked' || r.booking.status === 'waitlisted'))
    .sort((a, b) => a.session.start.localeCompare(b.session.start))
  const past = rows
    .filter((r) => !upcoming.includes(r))
    .sort((a, b) => b.session.start.localeCompare(a.session.start))

  return (
    <section>
      <header className="page-head">
        <h1>My bookings</h1>
        <p className="muted">Free cancellation until {state.studio.cancelHours} hours before class.</p>
      </header>
      {error && <p className="error banner" role="alert">{error}</p>}

      <h2>Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="empty">
          Nothing booked yet. <button className="link" onClick={() => navigate('/schedule')}>Find a class</button>
        </p>
      ) : (
        <ul className="rows">
          {upcoming.map(({ booking, session }) => {
            const start = new Date(session.start)
            const late = !isFreeCancel(state, session, now)
            return (
              <li key={booking.id} className="card row">
                <div>
                  <strong>{session.title}</strong>
                  <p className="muted small">
                    {fmtDay(start)} · {fmtTime(start)} · {session.instructor}
                  </p>
                </div>
                <span className={`badge ${booking.status}`}>{LABEL[booking.status]}</span>
                <button
                  className="btn ghost"
                  title={late && booking.status === 'booked' ? 'Within the cancellation window: no refund' : undefined}
                  onClick={() => {
                    if (late && booking.status === 'booked' && !confirm('This is a late cancel, so the credits will not be returned to your package. Cancel anyway?')) return
                    setError(apply((s) => cancel(s, user.id, session.id)))
                  }}
                >
                  Cancel{late && booking.status === 'booked' ? ' (no refund)' : ''}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <h2>History</h2>
      {past.length === 0 ? (
        <p className="empty">No past classes.</p>
      ) : (
        <ul className="rows">
          {past.map(({ booking, session }) => {
            const start = new Date(session.start)
            const rated = state.ratings.find((r) => r.userId === user.id && r.sessionId === session.id)
            return (
              <li key={booking.id} className="card row">
                <div>
                  <strong>{session.title}</strong>
                  <p className="muted small">
                    {fmtDay(start)} · {fmtTime(start)} · {session.instructor}
                  </p>
                </div>
                <span className={`badge ${booking.attendance === 'no-show' ? 'late-cancelled' : booking.status}`}>
                  {booking.status === 'booked'
                    ? booking.attendance === 'no-show' ? 'No-show' : start < now ? 'Attended' : 'Booked'
                    : LABEL[booking.status]}
                </span>
                {canRate(state, user.id, session, now) ? (
                  <button className="btn primary" onClick={() => navigate(`/rating?session=${session.id}`)}>Rate</button>
                ) : rated ? (
                  <span className="small">{'★'.repeat(rated.stars)}</span>
                ) : (
                  <span />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
