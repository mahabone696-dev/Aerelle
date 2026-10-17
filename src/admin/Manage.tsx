import { useState, type FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Users, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { addSession, removeSession, spotsLeft, waitlist, type Session, type SessionDraft } from '../lib/model'
import { dayKey, fmtDayLong, fmtTime, sameDay, startOfDay, toLocalInput } from '../lib/format'
import { navigate, type Route } from '../lib/router'
import { Roster } from './Roster'

const CAPACITY: Record<string, number> = { Mat: 10, Reformer: 6, Private: 1, Duet: 2 }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const mondayOf = (d: Date) => startOfDay(d, -((d.getDay() + 6) % 7))

export function Manage({ route }: { route: Route }) {
  const { state, apply } = useStore()
  const view = route.query.get('view') === 'list' ? 'list' : 'calendar'
  const adding = route.query.get('add') === '1'
  const [cursor, setCursor] = useState(() => new Date()) // any date inside the shown month / week
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()))
  const [group, setGroup] = useState('All')
  const [error, setError] = useState<string | null>(null)

  const setView = (v: 'calendar' | 'list') => navigate(`/schedule${v === 'list' ? '?view=list' : ''}`)
  const closeAdd = () => navigate(`/schedule${view === 'list' ? '?view=list' : ''}`)
  const groups = ['All', ...new Set(state.classTypes.map((c) => c.group))]
  const visible = (s: Session) => group === 'All' || s.group === group
  const onDay = (d: Date) =>
    state.sessions.filter((s) => visible(s) && sameDay(new Date(s.start), d)).sort((a, b) => a.start.localeCompare(b.start))

  function cancelClass(s: Session) {
    const series = s.seriesId ? state.sessions.filter((x) => x.seriesId === s.seriesId && x.start >= s.start) : [s]
    const all = series.length > 1 && confirm(`Cancel this and the next ${series.length - 1} weekly ${s.title} classes too? Choose Cancel for just this one.`)
    if (!all && !confirm(`Cancel ${s.title} on ${fmtDayLong(new Date(s.start))}? Booked members get their credits back.`)) return
    setError(apply((st) => (all ? series : [s]).reduce((acc, x) => removeSession(acc, x.id), st)))
  }

  // Period being shown
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridStart = mondayOf(monthStart)
  const gridDays = Array.from({ length: 42 }, (_, i) => startOfDay(gridStart, i))
  const weekStart = mondayOf(cursor)
  const weekDays = Array.from({ length: 7 }, (_, i) => startOfDay(weekStart, i))
  const step = (dir: number) => {
    const d = new Date(cursor)
    if (view === 'calendar') d.setMonth(d.getMonth() + dir, 1)
    else d.setDate(d.getDate() + 7 * dir)
    setCursor(d)
  }
  const title =
    view === 'calendar'
      ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${startOfDay(weekStart, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <section>
      <header className="page-head split-head">
        <div>
          <h1>Schedule</h1>
          <p className="muted">Plan classes, see who's booked and check members in.</p>
        </div>
        {!adding && (
          <button className="btn primary" onClick={() => navigate(`/schedule?add=1${view === 'list' ? '&view=list' : ''}`)}>
            <Plus size={16} /> Add class
          </button>
        )}
      </header>

      {adding && <NewClass onCreate={(draft, weeks) => apply((s) => addSession(s, draft, weeks))} onClose={closeAdd} />}
      {error && <p className="error banner">{error}</p>}

      <div className="toolbar card">
        <div className="toolbar-group">
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
          <button className="btn ghost sm" onClick={() => { setCursor(new Date()); setSelected(startOfDay(new Date())) }}>Today</button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Next"><ChevronRight size={18} /></button>
          <strong className="toolbar-title">{title}</strong>
        </div>
        <div className="toolbar-group">
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Class group">
            {groups.map((g) => <option key={g} value={g}>{g === 'All' ? 'All class types' : g}</option>)}
          </select>
          <div className="segmented" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === 'calendar'} onClick={() => setView('calendar')}><CalendarDays size={15} /> Calendar</button>
            <button role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}><List size={15} /> List</button>
          </div>
        </div>
      </div>

      {view === 'calendar' ? (
        <>
          <div className="calendar card" role="grid" aria-label={title}>
            {WEEKDAYS.map((d) => <div key={d} className="cal-head" role="columnheader">{d}</div>)}
            {gridDays.map((d) => {
              const list = onDay(d)
              const outside = d.getMonth() !== cursor.getMonth()
              const isToday = sameDay(d, new Date())
              return (
                <button
                  key={dayKey(d)}
                  role="gridcell"
                  className={`cal-cell ${outside ? 'outside' : ''} ${sameDay(d, selected) ? 'selected' : ''}`}
                  onClick={() => setSelected(d)}
                  aria-label={`${fmtDayLong(d)}, ${list.length} classes`}
                >
                  <span className={`cal-date ${isToday ? 'today' : ''}`}>{d.getDate()}</span>
                  {list.slice(0, 3).map((s) => (
                    <span key={s.id} className={`cal-chip c-${s.group.toLowerCase()}`}>
                      <b>{fmtTime(new Date(s.start)).replace(':00', '')}</b> {s.title}
                    </span>
                  ))}
                  {list.length > 3 && <span className="cal-more">+{list.length - 3} more</span>}
                </button>
              )
            })}
          </div>
          <DayPanel day={selected} sessions={onDay(selected)} onCancel={cancelClass} />
        </>
      ) : (
        weekDays.map((d) => <DayPanel key={dayKey(d)} day={d} sessions={onDay(d)} onCancel={cancelClass} compact />)
      )}
      <Legend />
    </section>
  )
}

function DayPanel({ day, sessions, onCancel, compact }: { day: Date; sessions: Session[]; onCancel: (s: Session) => void; compact?: boolean }) {
  const { state } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const isToday = sameDay(day, new Date())
  return (
    <div className="day-block">
      <h3 className={isToday ? 'today' : ''}>{fmtDayLong(day)}</h3>
      {sessions.length === 0 ? (
        <p className="muted small">{compact ? 'No classes' : 'No classes on this day.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="class-table">
            <thead>
              <tr>
                <th>Time</th><th>Class</th><th className="hide-sm">Instructor</th><th>Booked</th><th className="hide-sm">Waitlist</th><th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const booked = s.capacity - spotsLeft(state, s)
                const q = waitlist(state, s.id).length
                const pct = Math.round((booked / s.capacity) * 100)
                return (
                  <FragmentRow key={s.id} open={open === s.id} session={s}>
                    <td className="nowrap"><strong>{fmtTime(new Date(s.start))}</strong><span className="muted tiny block">{s.durationMin} min</span></td>
                    <td>
                      <span className={`group-dot c-${s.group.toLowerCase()}`} />
                      <strong>{s.title}</strong>
                      <span className="muted tiny block">{s.group}{s.seriesId ? ' · weekly' : ''}</span>
                    </td>
                    <td className="hide-sm">{s.instructor}</td>
                    <td>
                      <div className="fill"><span style={{ width: `${pct}%` }} /></div>
                      <span className="tiny">{booked}/{s.capacity}</span>
                    </td>
                    <td className="hide-sm">{q || '–'}</td>
                    <td className="actions end-cell">
                      <button className="btn ghost sm" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                        <Users size={14} /> {open === s.id ? 'Hide' : 'Roster'}
                      </button>
                      {new Date(s.start) > new Date() && (
                        <button className="icon-btn danger" onClick={() => onCancel(s)} aria-label={`Cancel ${s.title}`} title="Cancel class"><X size={16} /></button>
                      )}
                    </td>
                  </FragmentRow>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FragmentRow({ open, session, children }: { open: boolean; session: Session; children: React.ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
      {open && (
        <tr className="roster-row">
          <td colSpan={6}><Roster session={session} /></td>
        </tr>
      )}
    </>
  )
}

function Legend() {
  const { state } = useStore()
  return (
    <div className="legend">
      {[...new Set(state.classTypes.map((c) => c.group))].map((g) => (
        <span key={g}><span className={`group-dot c-${g.toLowerCase()}`} /> {g}</span>
      ))}
    </div>
  )
}

function NewClass({ onCreate, onClose }: { onCreate: (draft: SessionDraft, weeks: number) => string | null; onClose: () => void }) {
  const { state } = useStore()
  const instructors = state.staff.filter((s) => s.role === 'Instructor')
  const tomorrow = new Date(Date.now() + 86_400_000)
  tomorrow.setHours(19, 0, 0, 0)
  const first = state.classTypes[0]
  const [form, setForm] = useState({
    title: first?.name ?? '',
    group: first?.group ?? '',
    instructor: instructors[0]?.name ?? '',
    room: state.studio.location,
    start: toLocalInput(tomorrow),
    durationMin: 60,
    capacity: CAPACITY[first?.group] ?? 10,
    cost: first?.credits ?? 1,
  })
  const [weeks, setWeeks] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  function submit(e: FormEvent) {
    e.preventDefault()
    const err = onCreate({ ...form, start: new Date(form.start).toISOString() }, weeks)
    setError(err)
    if (!err) onClose()
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <div className="form-card-head">
        <h2 className="flush">New class</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="form-grid">
        <label className="span2">
          Class
          <select
            value={form.title}
            onChange={(e) => {
              const ct = state.classTypes.find((c) => c.name === e.target.value)!
              setForm((f) => ({ ...f, title: ct.name, group: ct.group, capacity: CAPACITY[ct.group] ?? f.capacity, cost: ct.credits ?? 1 }))
            }}
          >
            {state.classTypes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Instructor
          <select value={form.instructor} onChange={(e) => set('instructor', e.target.value)}>
            {instructors.map((i) => <option key={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label>Starts<input type="datetime-local" value={form.start} onChange={(e) => set('start', e.target.value)} required /></label>
        <label>Minutes<input type="number" min={5} value={form.durationMin} onChange={(e) => set('durationMin', +e.target.value)} /></label>
        <label>Capacity<input type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', +e.target.value)} /></label>
        <label>Credits per booking<input type="number" min={0} value={form.cost} onChange={(e) => set('cost', +e.target.value)} /></label>
        <label>Location<input value={form.room} onChange={(e) => set('room', e.target.value)} /></label>
        <label>
          Repeat weekly
          <select value={weeks} onChange={(e) => setWeeks(+e.target.value)}>
            <option value={1}>Just once</option>
            {[4, 8, 12, 26, 52].map((n) => <option key={n} value={n}>{n} weeks</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="btn primary">{weeks > 1 ? `Publish ${weeks} classes` : 'Publish class'}</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
