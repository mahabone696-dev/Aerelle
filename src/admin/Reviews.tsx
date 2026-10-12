import { useState } from 'react'
import { useStore } from '../lib/store'
import { averageRating, ratingDistribution } from '../lib/model'
import { fmtDate } from '../lib/format'
import { Stars } from '../ui'

export function Reviews() {
  const { state } = useStore()
  const [cls, setCls] = useState('All classes')
  const [stars, setStars] = useState(0)
  const [withText, setWithText] = useState(false)
  const overall = averageRating(state)
  const dist = ratingDistribution(state)
  const max = Math.max(1, ...dist)
  const titles = ['All classes', ...new Set(state.sessions.filter((s) => state.ratings.some((r) => r.sessionId === s.id)).map((s) => s.title))]

  const reviews = state.ratings
    .map((r) => ({ r, s: state.sessions.find((x) => x.id === r.sessionId), u: state.users.find((x) => x.id === r.userId) }))
    .filter(({ r, s }) => (cls === 'All classes' || s?.title === cls) && (!stars || r.stars === stars) && (!withText || r.comment))
    .sort((a, b) => b.r.createdAt.localeCompare(a.r.createdAt))

  const weekAgo = Date.now() - 7 * 86_400_000
  const fresh = state.ratings.filter((r) => new Date(r.createdAt).getTime() > weekAgo).length

  return (
    <section>
      <header className="page-head">
        <h1>Studio rating</h1>
        <p className="muted">What members say after class. {fresh > 0 && `${fresh} new this week.`}</p>
      </header>

      <div className="card rating-summary">
        <div className="big">
          <strong>{overall ? overall.average.toFixed(1) : '–'}</strong>
          <span className="muted">/ 5</span>
          {overall && <Stars value={overall.average} />}
          <span className="muted small">{overall?.count ?? 0} reviews</span>
        </div>
        <ul className="bars">
          {[5, 4, 3, 2, 1].map((n) => (
            <li key={n}>
              <button className="link" aria-pressed={stars === n} onClick={() => setStars(stars === n ? 0 : n)}>{n} ★</button>
              <span className="bar"><span style={{ width: `${(dist[n - 1] / max) * 100}%` }} /></span>
              <span className="small muted">{dist[n - 1]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="filters">
        <label>
          Class
          <select value={cls} onChange={(e) => setCls(e.target.value)}>
            {titles.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={withText} onChange={(e) => setWithText(e.target.checked)} /> With comments only</label>
        {stars > 0 && <button className="link" onClick={() => setStars(0)}>Clear {stars}★ filter</button>}
      </div>

      <h2>{reviews.length} reviews</h2>
      <ul className="rows">
        {reviews.slice(0, 100).map(({ r, s, u }) => (
          <li key={r.id} className="card review">
            <div className="split-head">
              <strong>{u?.name ?? 'Member'}</strong>
              <span className="stars-static">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
            </div>
            <p className="muted small">{s?.title ?? 'Removed class'} · instructed by {s?.instructor ?? '–'} · {fmtDate(r.createdAt)}</p>
            {r.comment && <p>“{r.comment}”</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
