import type { State } from './model'

// Report rows for a date range [from, to). Each report returns a header row plus data rows,
// so the same arrays drive both the on-screen table and the CSV download.

export interface Range {
  from: Date
  to: Date
}

const within = (iso: string, r: Range) => {
  const t = new Date(iso).getTime()
  return t >= r.from.getTime() && t < r.to.getTime()
}

const userName = (s: State, id: string) => s.users.find((u) => u.id === id)?.name ?? 'Unknown'
const d = (iso: string) => new Date(iso).toLocaleDateString()
const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function salesReport(s: State, r: Range) {
  const orders = s.orders.filter((o) => within(o.createdAt, r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return {
    header: ['Date', 'Time', 'Member', 'Package', 'Source', 'Payment', 'Promo', 'Price', 'Discount', 'Net', 'Status'],
    rows: orders.map((o) => [
      d(o.createdAt), t(o.createdAt), userName(s, o.userId), o.name, o.source, o.method, o.promo || '-',
      o.price, o.discount, o.net, o.paid ? 'Paid' : 'Unpaid',
    ]),
    totals: {
      orders: orders.length,
      gross: orders.reduce((n, o) => n + o.price, 0),
      discounts: orders.reduce((n, o) => n + o.discount, 0),
      collected: orders.filter((o) => o.paid).reduce((n, o) => n + o.net, 0),
      outstanding: orders.filter((o) => !o.paid).reduce((n, o) => n + o.net, 0),
    },
  }
}

export function bookingReport(s: State, r: Range) {
  const sessions = s.sessions.filter((x) => within(x.start, r)).sort((a, b) => a.start.localeCompare(b.start))
  const rows = sessions.map((x) => {
    const bs = s.bookings.filter((b) => b.sessionId === x.id)
    const booked = bs.filter((b) => b.status === 'booked')
    return [
      d(x.start), t(x.start), x.title, x.instructor, x.capacity, booked.length,
      booked.filter((b) => b.attendance === 'attended').length,
      booked.filter((b) => b.attendance === 'no-show').length,
      bs.filter((b) => b.status === 'waitlisted').length,
      x.capacity ? `${Math.round((booked.length / x.capacity) * 100)}%` : '-',
    ]
  })
  const seats = sessions.reduce((n, x) => n + x.capacity, 0)
  const filled = rows.reduce((n, row) => n + (row[5] as number), 0)
  return {
    header: ['Date', 'Time', 'Class', 'Instructor', 'Capacity', 'Booked', 'Attended', 'No-show', 'Waitlist', 'Fill'],
    rows,
    totals: { classes: sessions.length, booked: filled, occupancy: seats ? Math.round((filled / seats) * 100) : 0 },
  }
}

export function cancellationReport(s: State, r: Range) {
  const list = s.bookings
    .filter((b) => (b.status === 'cancelled' || b.status === 'late-cancelled') && b.cancelledAt && within(b.cancelledAt, r))
    .sort((a, b) => b.cancelledAt!.localeCompare(a.cancelledAt!))
  const rows = list.map((b) => {
    const x = s.sessions.find((y) => y.id === b.sessionId)
    return [
      d(b.cancelledAt!), userName(s, b.userId), x?.title ?? 'Removed class', x ? `${d(x.start)} ${t(x.start)}` : '-',
      b.status === 'late-cancelled' ? 'Late (no refund)' : 'In time',
    ]
  })
  return {
    header: ['Cancelled on', 'Member', 'Class', 'Class time', 'Type'],
    rows,
    totals: { total: list.length, late: list.filter((b) => b.status === 'late-cancelled').length },
  }
}

/** Classes taught and members served per instructor, as the basis for payroll. */
export function payrollReport(s: State, r: Range) {
  const now = Date.now()
  const taught = s.sessions.filter((x) => within(x.start, r) && new Date(x.start).getTime() <= now)
  const names = [...new Set(taught.map((x) => x.instructor))].sort()
  const rows = names.map((name) => {
    const mine = taught.filter((x) => x.instructor === name)
    const ids = new Set(mine.map((x) => x.id))
    const attended = s.bookings.filter((b) => ids.has(b.sessionId) && b.status === 'booked' && b.attendance !== 'no-show').length
    const byGroup = [...new Set(mine.map((x) => x.group))].map((g) => `${g} ${mine.filter((x) => x.group === g).length}`).join(', ')
    const rated = s.ratings.filter((x) => ids.has(x.sessionId))
    const avg = rated.length ? (rated.reduce((n, x) => n + x.stars, 0) / rated.length).toFixed(2) : '-'
    return [name, mine.length, byGroup, attended, avg]
  })
  return { header: ['Instructor', 'Classes taught', 'By group', 'Members attended', 'Avg rating'], rows, totals: { classes: taught.length } }
}

export function packageReport(s: State, r: Range) {
  const orders = s.orders.filter((o) => within(o.createdAt, r))
  const names = [...new Set(orders.map((o) => o.name))]
  const rows = names
    .map((name) => {
      const os = orders.filter((o) => o.name === name)
      return [name, os.length, os.reduce((n, o) => n + o.net, 0)]
    })
    .sort((a, b) => (b[2] as number) - (a[2] as number))
  return { header: ['Package', 'Sold', 'Net revenue'], rows, totals: { sold: orders.length } }
}
