import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { addSession, removeSession, spotsLeft, waitlist, type Session, type SessionDraft } from '../lib/model'
import { fmtDayLong, fmtTime, sameDay, startOfDay, toLocalInput } from '../lib/format'
import { Roster } from './Roster'

const CAPACITY: Record<string, number> = { Mat: 10, Reformer: 6, Private: 1, Duet: 2 }

export function Manage() {
  const { state, apply } = useStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const monday = startOfDay(new Date(), -((new Date().getDay() + 6) % 7) + weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => startOfDay(monday, i))
  const sunday = startOfDay(monday, 7)
  const week = state.sessions
    .filter((s) => new Date(s.start) >= monday && new Date(s.start) < sunday)
    .sort((a, b) => a.start.localeCompare(b.start))

  function cancelClass(s: Session) {
    const series = s.seriesId ? state.sessions.filter((x) => x.seriesId === s.seriesId && x.start >= s.start) : [s]
    const all = series.length > 1 && confirm(`Cancel this and the next ${series.length - 1} weekly ${s.title} classes too? Choose Cancel for just this one.`)
    if (!all && !confirm(`Cancel ${s.title} on ${fmtDayLong(new Date(s.start))}? Booked members get the class back.`)) return
    setError(apply((st) => (all ? series : [s]).reduce((acc, x) => removeSession(acc, x.id), st)))
  }

  return (
    <section>
      <header className="page-head">
        <h1>Schedule</h1>
        <p className="muted">Add one-off or weekly classes, see who's booked and check members in.</p>
      </header>

      <NewClass onCreate={(draft, weeks) => apply((s) => addSession(s, draft, weeks))} />
      {error && <p className="error banner">{error}</p>}

      <div className="week-nav">
        <button className="btn ghost" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">‹</button>
        <strong>
          {monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} –{' '}
          {startOfDay(monday, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </strong>
        <button className="btn ghost" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week">›</button>
        {weekOffset !== 0 && <button className="link" onClick={() => setWeekOffset(0)}>This week</button>}
        <span className="muted small push">{week.length} classes</span>
      </div>

      {days.map((d) => {
        const list = week.filter((s) => sameDay(new Date(s.start), d))
        return (
          <div key={d.toISOString()} className="day-block">
            <h3 className={sameDay(d, new Date()) ? 'today' : ''}>{fmtDayLong(d)}</h3>
            {list.length === 0 ? (
              <p className="muted small">No classes</p>
            ) : (
              <ul className="rows">
                {list.map((s) => {
                  const booked = s.capacity - spotsLeft(state, s)
                  const q = waitlist(state, s.id).length
                  return (
                    <li key={s.id} className={`card g-${s.group.toLowerCase()}`}>
                      <div className="row bare">
                        <div>
                          <strong>{fmtTime(new Date(s.start))} · {s.title}</strong>
                          <p className="muted small">
                            {s.instructor} · {s.durationMin} min · {s.room}{s.seriesId ? ' · weekly' : ''}
                          </p>
                        </div>
                        <span className="small">{booked}/{s.capacity}{q > 0 && ` · ${q} waiting`}</span>
                        <div className="actions">
                          <button className="btn ghost" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                            {open === s.id ? 'Hide' : 'Roster'}
                          </button>
                          {new Date(s.start) > new Date() && (
                            <button className="btn danger" onClick={() => cancelClass(s)}>Cancel</button>
                          )}
                        </div>
                      </div>
                      {open === s.id && <Roster session={s} />}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}

function NewClass({ onCreate }: { onCreate: (draft: SessionDraft, weeks: number) => string | null }) {
  const { state } = useStore()
  const instructors = state.staff.filter((s) => s.role === 'Instructor')
  const tomorrow = new Date(Date.now() + 86_400_000)
  tomorrow.setHours(19, 0, 0, 0)
  const first = state.classTypes[0]
  const blank = {
    title: first?.name ?? '',
    group: first?.group ?? '',
    instructor: instructors[0]?.name ?? '',
    room: state.studio.location,
    start: toLocalInput(tomorrow),
    durationMin: 60,
    capacity: CAPACITY[first?.group] ?? 10,
    cost: 1,
  }
  const [form, setForm] = useState(blank)
  const [weeks, setWeeks] = useState(1)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  function submit(e: FormEvent) {
    e.preventDefault()
    const err = onCreate({ ...form, start: new Date(form.start).toISOString() }, weeks)
    setError(err)
    if (!err) {
      setForm(blank)
      setWeeks(1)
      setOpen(false)
    }
  }

  if (!open) return <button className="btn primary" onClick={() => setOpen(true)}>+ Add class</button>

  return (
    <form className="card form-grid" onSubmit={submit}>
      <label className="span2">
        Class
        <select
          value={form.title}
          onChange={(e) => {
            const ct = state.classTypes.find((c) => c.name === e.target.value)!
            setForm((f) => ({ ...f, title: ct.name, group: ct.group, capacity: CAPACITY[ct.group] ?? f.capacity }))
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
      <label>Classes deducted<input type="number" min={0} value={form.cost} onChange={(e) => set('cost', +e.target.value)} /></label>
      <label>Location<input value={form.room} onChange={(e) => set('room', e.target.value)} /></label>
      <label>
        Repeat weekly
        <select value={weeks} onChange={(e) => setWeeks(+e.target.value)}>
          <option value={1}>Just once</option>
          {[4, 8, 12, 26, 52].map((n) => <option key={n} value={n}>{n} weeks</option>)}
        </select>
      </label>
      {error && <p className="error full">{error}</p>}
      <div className="full actions">
        <button className="btn primary">{weeks > 1 ? `Publish ${weeks} classes` : 'Publish class'}</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}
