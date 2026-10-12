import { useState, type ComponentType } from 'react'
import { AlertCircle, CalendarDays, Gauge, Star, Wallet } from 'lucide-react'
import { initials } from '../ui'
import { useStore } from '../lib/store'
import { averageRating, spotsLeft } from '../lib/model'
import { fmtDate, fmtTime, money, sameDay, startOfDay } from '../lib/format'
import { navigate } from '../lib/router'
import { Roster } from './Roster'

export function Overview() {
  const { state } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const now = new Date()
  const cur = state.studio.currency
  const today = state.sessions.filter((s) => sameDay(new Date(s.start), now)).sort((a, b) => a.start.localeCompare(b.start))
  const weekAgo = startOfDay(now, -6)
  const weekOrders = state.orders.filter((o) => new Date(o.createdAt) >= weekAgo)
  const unpaid = state.orders.filter((o) => !o.paid)
  const next7 = state.sessions.filter((s) => {
    const t = new Date(s.start).getTime() - now.getTime()
    return t > 0 && t < 7 * 86_400_000
  })
  const seats = next7.reduce((n, s) => n + s.capacity, 0)
  const filled = next7.reduce((n, s) => n + s.capacity - spotsLeft(state, s), 0)
  const rating = averageRating(state)
  const recent = [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const name = (id: string) => state.users.find((u) => u.id === id)?.name ?? 'Unknown'

  return (
    <section>
      <header className="page-head">
        <h1>Overview</h1>
        <p className="muted">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </header>

      <div className="stats">
        <Stat icon={CalendarDays} label="Classes today" value={String(today.length)} hint={`${today.reduce((n, s) => n + s.capacity - spotsLeft(state, s), 0)} members booked`} />
        <Stat icon={Gauge} label="Booked next 7 days" value={seats ? `${Math.round((filled / seats) * 100)}%` : '–'} hint={`${filled} of ${seats} spots`} />
        <Stat icon={Wallet} label="Sales last 7 days" value={money(cur, weekOrders.reduce((n, o) => n + o.net, 0))} hint={`${weekOrders.length} orders`} />
        <Stat
          icon={AlertCircle}
          label="Unpaid"
          value={money(cur, unpaid.reduce((n, o) => n + o.net, 0))}
          hint={`${unpaid.length} packages`}
          onClick={unpaid.length ? () => navigate('/members?tab=unpaid') : undefined}
        />
        <Stat icon={Star} label="Rating" value={rating ? `★ ${rating.average.toFixed(2)}` : '–'} hint={rating ? `${rating.count} reviews` : ''} onClick={() => navigate('/rating')} />
      </div>

      <h2>Classes today · check-in</h2>
      {today.length === 0 ? (
        <p className="empty">No classes today.</p>
      ) : (
        <ul className="rows">
          {today.map((s) => {
            const booked = s.capacity - spotsLeft(state, s)
            const checked = state.bookings.filter((b) => b.sessionId === s.id && b.attendance === 'attended').length
            return (
              <li key={s.id} className="card">
                <div className="row bare">
                  <div>
                    <strong>{fmtTime(new Date(s.start))} · {s.title}</strong>
                    <p className="muted small">{s.instructor} · {s.room}</p>
                  </div>
                  <span className="small">{booked}/{s.capacity} booked · {checked} in</span>
                  <button className="btn ghost" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                    {open === s.id ? 'Close' : 'Check in'}
                  </button>
                </div>
                {open === s.id && <Roster session={s} />}
              </li>
            )
          })}
        </ul>
      )}

      <h2>Newest purchases</h2>
      <ul className="rows">
        {recent.map((o) => (
          <li key={o.id} className="card row">
            <div className="who">
              <span className="avatar">{initials(name(o.userId))}</span>
              <div>
                <strong>{name(o.userId)}</strong>
                <p className="muted small">{o.name} · {fmtDate(o.createdAt)} · {o.source}</p>
              </div>
            </div>
            <span className={`badge ${o.paid ? '' : 'waitlisted'}`}>{o.paid ? 'Paid' : 'Unpaid'}</span>
            <strong>{money(cur, o.net)}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Stat({ icon: Icon, label, value, hint, onClick }: { icon?: ComponentType<{ size?: number }>; label: string; value: string; hint?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="stat-label">{Icon && <span className="stat-icon"><Icon size={16} /></span>}{label}</span>
      <strong>{value}</strong>
      {hint && <span className="muted tiny">{hint}</span>}
    </>
  )
  return onClick ? (
    <button className="card stat clickable" onClick={onClick}>{body}</button>
  ) : (
    <div className="card stat">{body}</div>
  )
}
