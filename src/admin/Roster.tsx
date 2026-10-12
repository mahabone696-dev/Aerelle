import { useState } from 'react'
import { useStore } from '../lib/store'
import { markAttendance, waitlist, type Attendance, type Session } from '../lib/model'

/** Booked members with check-in buttons, plus the waitlist. */
export function Roster({ session }: { session: Session }) {
  const { state, apply } = useStore()
  const [error, setError] = useState<string | null>(null)
  const booked = state.bookings.filter((b) => b.sessionId === session.id && b.status === 'booked')
  const queue = waitlist(state, session.id)
  const name = (id: string) => state.users.find((u) => u.id === id)?.name ?? 'Unknown'
  const set = (bookingId: string, value: Attendance | undefined) => setError(apply((s) => markAttendance(s, bookingId, value)))

  return (
    <div className="roster">
      {error && <p className="error small">{error}</p>}
      {booked.length === 0 ? (
        <p className="muted small">No bookings yet.</p>
      ) : (
        <ul className="checkin">
          {booked.map((b) => (
            <li key={b.id}>
              <span>{name(b.userId)}</span>
              <div className="seg-sm" role="group" aria-label={`Attendance for ${name(b.userId)}`}>
                <button aria-pressed={b.attendance === 'attended'} onClick={() => set(b.id, b.attendance === 'attended' ? undefined : 'attended')}>
                  Checked in
                </button>
                <button aria-pressed={b.attendance === 'no-show'} onClick={() => set(b.id, b.attendance === 'no-show' ? undefined : 'no-show')}>
                  No-show
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {queue.length > 0 && (
        <p className="small muted">Waitlist: {queue.map((b) => name(b.userId)).join(', ')}</p>
      )}
    </div>
  )
}
