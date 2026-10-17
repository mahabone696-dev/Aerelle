import { Receipt } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmtDate, money } from '../lib/format'

/** Everything this member has bought at the studio, newest first. */
export function Orders() {
  const { state, user } = useStore()
  if (!user) return null
  const cur = state.studio.currency
  const mine = state.orders.filter((o) => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const unpaid = mine.filter((o) => !o.paid && o.method !== 'DuitNow')
  const awaiting = mine.filter((o) => !o.paid && o.method === 'DuitNow')
  return (
    <section>
      <header className="page-head">
        <h1>My orders</h1>
        <p className="muted">Packages you've bought at {state.studio.name}.</p>
      </header>
      {unpaid.length > 0 && (
        <p className="error banner">
          {money(cur, unpaid.reduce((n, o) => n + o.net, 0))} unpaid. Please settle it at the front desk.
        </p>
      )}
      {awaiting.length > 0 && (
        <p className="info banner">
          {money(cur, awaiting.reduce((n, o) => n + o.net, 0))} paid by DuitNow, waiting for {state.studio.name} to confirm it arrived.
        </p>
      )}
      {mine.length === 0 ? (
        <p className="empty"><Receipt size={18} /> No orders yet.</p>
      ) : (
        <ul className="rows">
          {mine.map((o) => (
            <li key={o.id} className="card order-row">
              <div>
                <strong>{o.name}</strong>
                <p className="muted small">
                  {fmtDate(o.createdAt)} · {o.method}
                  {o.reference && ` · ref ${o.reference}`}
                  {o.promo && ` · ${o.promo}`}
                </p>
              </div>
              <span className={`badge ${o.paid ? 'booked' : 'waitlisted'}`}>{o.paid ? 'Paid' : o.method === 'DuitNow' ? 'Awaiting confirmation' : 'Unpaid'}</span>
              <strong className="order-amount">{money(cur, o.net)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
