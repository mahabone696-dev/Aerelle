import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../lib/store'
import { averageRating, book, credits, cancel, groupsOf, isAppointment, packageFor, spotsLeft, userBooking, waitlist, type Session } from '../lib/model'
import { dayKey, fmtDay, fmtTime, plural, sameDay, startOfDay } from '../lib/format'
import { navigate } from '../lib/router'
import { Stars } from '../ui'

const STRIP_DAYS = 14
const ALL = ''

/** "Today, Tue 13 Oct" / "Tomorrow, Wed 14 Oct" / "Thursday, 15 Oct" */
function dayHeading(d: Date, today: Date) {
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
  if (sameDay(d, today)) return `Today, ${date}`
  if (sameDay(d, startOfDay(today, 1))) return `Tomorrow, ${date}`
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${date}`
}
const toInputDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * The timetable members (and visitors who haven't signed in) book from: filters, a two-week day strip,
 * and a running list grouped by day from the chosen date.
 */
export function Schedule() {
  const { state, user, apply } = useStore()
  const now = new Date()
  const today = useMemo(() => startOfDay(new Date()), [])
  const [stripStart, setStripStart] = useState(today)
  const [from, setFrom] = useState(today)
  const [span, setSpan] = useState(7)
  const [group, setGroup] = useState(ALL)
  const [instructor, setInstructor] = useState(ALL)
  const [room, setRoom] = useState(ALL)
  const [tab, setTab] = useState<'class' | 'appointment'>('class')
  const [showFilters, setShowFilters] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; buy?: boolean } | null>(null)

  const future = useMemo(
    () => state.sessions.filter((s) => new Date(s.start).getTime() + s.durationMin * 60_000 > today.getTime()),
    [state.sessions, today],
  )
  // Appointments get their own tab, shown only when the studio offers any.
  const hasAppointments = future.some((s) => s.kind === 'appointment')
  const upcoming = future.filter((s) => (tab === 'appointment' ? s.kind === 'appointment' : s.kind !== 'appointment'))
  const groups = groupsOf(state).filter((g) => upcoming.some((s) => s.group === g))
  const instructors = [...new Set(upcoming.map((s) => s.instructor))].sort()
  const rooms = [...new Set(upcoming.map((s) => s.room))].sort()
  const matches = (s: Session) => (!group || s.group === group) && (!instructor || s.instructor === instructor) && (!room || s.room === room)
  const filtered = upcoming.filter(matches)
  const activeFilters = [group, instructor, room].filter(Boolean).length

  const strip = Array.from({ length: STRIP_DAYS }, (_, i) => startOfDay(stripStart, i))
  const until = startOfDay(from, span)
  const days = Array.from({ length: span }, (_, i) => startOfDay(from, i))
    .map((d) => ({ d, list: filtered.filter((s) => sameDay(new Date(s.start), d)).sort((a, b) => a.start.localeCompare(b.start)) }))
    .filter((x) => x.list.length > 0)
  const laterExists = filtered.some((s) => new Date(s.start) >= until)

  function pick(d: Date) {
    setFrom(d)
    setSpan(7)
  }
  function jump(value: string) {
    if (!value) return
    const [y, m, d] = value.split('-').map(Number)
    const day = new Date(y, m - 1, d)
    if (day < today) return
    pick(day)
    setStripStart(day)
  }
  function shiftStrip(weeks: number) {
    const next = startOfDay(stripStart, weeks * 7)
    const start = next < today ? today : next
    setStripStart(start)
    pick(start)
  }

  function signIn() {
    navigate(`/login?next=${encodeURIComponent(`/s/${state.studio.slug}/schedule`)}`)
  }

  function act(session: Session, kind: 'book' | 'cancel') {
    if (!user) return signIn()
    const err = apply((s) => (kind === 'book' ? book(s, user.id, session.id) : cancel(s, user.id, session.id)))
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

  const select = (label: string, value: string, set: (v: string) => void, options: string[], all: string) => (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => { set(e.target.value); setSpan(7) }}>
        <option value={ALL}>{all}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )

  return (
    <section className="book-page">
      <header className="page-head">
        <h1>{tab === 'appointment' ? 'Appointments' : 'Classes'}</h1>
        <p className="muted">
          {state.studio.name} · {state.studio.location}. Cancel at least {state.studio.cancelHours} hours before {tab === 'appointment' ? 'your appointment' : 'class'} to get your credits back.
        </p>
      </header>

      {hasAppointments && (
        <div className="tabs book-tabs" role="tablist" aria-label="What to book">
          {(['class', 'appointment'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => { setTab(k); setGroup(ALL); setInstructor(ALL); setRoom(ALL); setSpan(7) }}
            >
              {k === 'class' ? 'Classes' : 'Appointments'}
            </button>
          ))}
        </div>
      )}

      <div className="book-toolbar card">
        <button className="btn sm filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={16} /> Filters{activeFilters > 0 && <span className="count">{activeFilters}</span>}
        </button>
        <div className={`filter-fields ${showFilters ? 'open' : ''}`}>
          {select('Class', group, setGroup, groups, 'All classes')}
          {select('Instructor', instructor, setInstructor, instructors, 'All instructors')}
          {rooms.length > 1 && select('Location', room, setRoom, rooms, 'All locations')}
          {activeFilters > 0 && (
            <button className="link small" onClick={() => { setGroup(ALL); setInstructor(ALL); setRoom(ALL) }}>Clear filters</button>
          )}
        </div>
        <label className="filter-select date-jump">
          <span><CalendarDays size={14} /> Date</span>
          <input type="date" value={toInputDate(from)} min={toInputDate(today)} onChange={(e) => jump(e.target.value)} />
        </label>
      </div>

      <div className="strip-wrap">
        <button className="icon-btn" onClick={() => shiftStrip(-1)} disabled={sameDay(stripStart, today)} aria-label="Previous week">
          <ChevronLeft size={18} />
        </button>
        <div className="days scroll" role="tablist" aria-label="Day">
          {strip.map((d) => {
            const has = filtered.some((s) => sameDay(new Date(s.start), d))
            return (
              <button key={dayKey(d)} role="tab" aria-selected={sameDay(d, from)} className={`day ${has ? '' : 'quiet'}`} onClick={() => pick(d)}>
                <span className="small">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <strong>{d.getDate()}</strong>
                <span className={`day-dot ${has ? 'on' : ''}`} aria-hidden="true" />
              </button>
            )
          })}
        </div>
        <button className="icon-btn" onClick={() => shiftStrip(1)} aria-label="Next week">
          <ChevronRight size={18} />
        </button>
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

      {days.length === 0 && (
        <div className="empty">
          <p>No classes{activeFilters ? ' match your filters' : ''} from {fmtDay(from)} to {fmtDay(startOfDay(until, -1))}.</p>
          {laterExists && <button className="btn sm" onClick={() => setSpan((n) => n + 7)}>Show the next week</button>}
        </div>
      )}

      {days.map(({ d, list }) => (
        <div key={dayKey(d)} className="day-group">
          <h2 className="day-heading">
            {dayHeading(d, today)} <span className="muted small">{plural(list.length, 'class', 'classes')}</span>
          </h2>
          <ul className="sessions">
            {list.map((s) => (
              <SessionRow key={s.id} s={s} now={now} onAct={act} />
            ))}
          </ul>
        </div>
      ))}

      {days.length > 0 && laterExists && (
        <div className="more-row">
          <button className="btn" onClick={() => setSpan((n) => n + 7)}>Show the next week</button>
        </div>
      )}
    </section>
  )
}

function SessionRow({ s, now, onAct }: { s: Session; now: Date; onAct: (s: Session, kind: 'book' | 'cancel') => void }) {
  const { state, user } = useStore()
  const start = new Date(s.start)
  const left = spotsLeft(state, s)
  const mine = user ? userBooking(state, user.id, s.id) : undefined
  const queue = waitlist(state, s.id)
  const pos = mine?.status === 'waitlisted' ? queue.findIndex((b) => b.id === mine.id) + 1 : 0
  const rating = averageRating(state, (x) => x.title === s.title)
  const pkg = user && !mine ? packageFor(state, user.id, s, now) : undefined
  return (
    <li className="card session">
      <div className="time">
        <strong>{fmtTime(start)}</strong>
        <span className="muted small">{s.durationMin} min</span>
      </div>
      <div className="info">
        <span className="tag">{s.group}</span>
        <h3>{s.title}</h3>
        <p className="muted small">
          {s.instructor} · {s.room} · {s.cost ? credits(s.cost) : 'Free'}
        </p>
        {rating && (
          <p className="small">
            <Stars value={rating.average} /> {rating.average.toFixed(1)} <span className="muted">({rating.count})</span>
          </p>
        )}
      </div>
      <div className="cta">
        <span className={`spots ${left === 0 ? 'full' : left <= 2 ? 'low' : ''}`}>
          {isAppointment(s)
            ? left === 0 ? `Booked${queue.length ? ` · ${queue.length} waiting` : ''}` : 'Available'
            : left === 0 ? `Full${queue.length ? ` · ${queue.length} waiting` : ''}` : `${plural(left, 'spot')} left`}
        </span>
        {start <= now ? (
          <button className="btn" disabled>Started</button>
        ) : mine ? (
          <>
            <span className={`badge ${mine.status}`}>{mine.status === 'booked' ? 'Booked' : `Waitlist #${pos}`}</span>
            <button className="btn ghost" onClick={() => onAct(s, 'cancel')}>
              {mine.status === 'booked' ? 'Cancel' : 'Leave waitlist'}
            </button>
          </>
        ) : (
          <>
            <button className={`btn ${left === 0 ? '' : 'primary'}`} onClick={() => onAct(s, 'book')}>
              {left === 0 ? 'Join waitlist' : 'Book'}
            </button>
            {user && <span className="muted tiny">{pkg ? `Uses ${credits(s.cost)} from ${pkg.name}` : `Needs ${credits(s.cost)} on a ${s.group} package`}</span>}
          </>
        )}
      </div>
    </li>
  )
}
