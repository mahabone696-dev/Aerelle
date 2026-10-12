import { useState } from 'react'
import { useStore } from '../lib/store'
import { bookingReport, cancellationReport, packageReport, payrollReport, salesReport, type Range } from '../lib/reports'
import { downloadCsv, money, startOfDay } from '../lib/format'

const TABS = ['Sales', 'Packages', 'Bookings', 'Cancellations', 'Instructor payroll'] as const
type Tab = (typeof TABS)[number]

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function Reports() {
  const { state } = useStore()
  const cur = state.studio.currency
  const [tab, setTab] = useState<Tab>('Sales')
  const [from, setFrom] = useState(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(iso(new Date()))
  const range: Range = { from: new Date(`${from}T00:00`), to: startOfDay(new Date(`${to}T00:00`), 1) }

  const presets: [string, Date, Date][] = (() => {
    const now = new Date()
    return [
      ['Today', now, now],
      ['Last 7 days', startOfDay(now, -6), now],
      ['This month', new Date(now.getFullYear(), now.getMonth(), 1), now],
      ['Last month', new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)],
    ]
  })()

  const report =
    tab === 'Sales' ? salesReport(state, range)
    : tab === 'Packages' ? packageReport(state, range)
    : tab === 'Bookings' ? bookingReport(state, range)
    : tab === 'Cancellations' ? cancellationReport(state, range)
    : payrollReport(state, range)

  const summary: [string, string][] = (() => {
    const t = report.totals as Record<string, number>
    switch (tab) {
      case 'Sales': return [['Orders', String(t.orders)], ['Gross', money(cur, t.gross)], ['Discounts', money(cur, t.discounts)], ['Collected', money(cur, t.collected)], ['Outstanding', money(cur, t.outstanding)]]
      case 'Packages': return [['Packages sold', String(t.sold)]]
      case 'Bookings': return [['Classes', String(t.classes)], ['Spots booked', String(t.booked)], ['Occupancy', `${t.occupancy}%`]]
      case 'Cancellations': return [['Cancellations', String(t.total)], ['Late', String(t.late)]]
      default: return [['Classes taught', String(t.classes)]]
    }
  })()
  const moneyCols = new Set(tab === 'Sales' ? [7, 8, 9] : tab === 'Packages' ? [2] : [])

  return (
    <section>
      <header className="page-head">
        <h1>Reports</h1>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      <div className="filters">
        <label>From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="chips">
          {presets.map(([label, a, b]) => (
            <button key={label} className="chip" aria-pressed={from === iso(a) && to === iso(b)} onClick={() => { setFrom(iso(a)); setTo(iso(b)) }}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn ghost push" onClick={() => downloadCsv(`${tab.toLowerCase().replace(/\s+/g, '-')}-${from}-to-${to}.csv`, [report.header, ...report.rows])}>
          Download CSV
        </button>
      </div>

      <div className="stats">
        {summary.map(([label, value]) => (
          <div key={label} className="card stat"><span className="muted small">{label}</span><strong>{value}</strong></div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>{report.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {report.rows.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j} className={typeof c === 'number' ? 'num' : ''}>{moneyCols.has(j) ? money(cur, c as number) : c}</td>
                ))}
              </tr>
            ))}
            {report.rows.length === 0 && <tr><td colSpan={report.header.length} className="empty">Nothing in this date range.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
