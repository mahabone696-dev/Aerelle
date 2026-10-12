import { useState } from 'react'
import { useStore } from '../lib/store'
import { activePackages, hasUsedTrial, purchase, quote, type PackageOption } from '../lib/model'
import { fmtDate, money, plural } from '../lib/format'

export function Packs() {
  const { state, user, apply } = useStore()
  const [promo, setPromo] = useState('')
  const [selected, setSelected] = useState<PackageOption | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  if (!user) return null

  const cur = state.studio.currency
  const mine = activePackages(state, user.id)
  const past = state.memberPackages.filter((p) => p.userId === user.id && !mine.includes(p))
  const usedTrial = hasUsedTrial(state, user.id)
  const visible = state.packageOptions.filter((p) => !p.hidden && !(p.trial && usedTrial))
  const groups = [...new Set(visible.map((p) => (p.recurring ? 'Memberships' : p.groups.join(' + '))))]
  const unpaid = state.orders.filter((o) => o.userId === user.id && !o.paid)

  let preview: ReturnType<typeof quote> | null = null
  let promoError = ''
  if (selected) {
    try {
      preview = quote(state, selected.id, promo)
    } catch (e) {
      promoError = (e as Error).message
      preview = quote(state, selected.id)
    }
  }

  return (
    <section>
      <header className="page-head">
        <h1>Packages</h1>
        <p className="muted">Each package covers certain class types and is valid for a set time after purchase.</p>
      </header>
      {msg && <p className={`${msg.kind} banner`} role="status">{msg.text}</p>}
      {unpaid.length > 0 && (
        <p className="error banner">
          You have {plural(unpaid.length, 'unpaid package')} ({money(cur, unpaid.reduce((n, o) => n + o.net, 0))}). Please settle
          it at the front desk.
        </p>
      )}

      <h2>My packages</h2>
      {mine.length === 0 ? (
        <p className="empty">No active packages. Pick one below to start booking.</p>
      ) : (
        <ul className="rows">
          {mine.map((p) => (
            <li key={p.id} className="card row">
              <div>
                <strong>{p.name}</strong>
                <p className="muted small">{p.groups.join(', ')} · expires {fmtDate(p.expiresAt)}</p>
              </div>
              <div className="meter" aria-label={`${p.remaining} of ${p.total} left`}>
                <span style={{ width: `${(p.remaining / p.total) * 100}%` }} />
              </div>
              <strong>{p.remaining}/{p.total} left</strong>
            </li>
          ))}
        </ul>
      )}

      {groups.map((g) => (
        <div key={g}>
          <h2>{g === 'Memberships' ? 'Monthly memberships' : `${g} packages`}</h2>
          <ul className="packs">
            {visible
              .filter((p) => (p.recurring ? 'Memberships' : p.groups.join(' + ')) === g)
              .map((p) => (
                <li key={p.id} className={`card pack ${selected?.id === p.id ? 'selected' : ''}`}>
                  {p.trial && <span className="badge waitlisted">Trial · one per member</span>}
                  <h3>{p.name}</h3>
                  <p className="price">{money(cur, p.price)}{p.recurring && <span className="small muted"> /month</span>}</p>
                  <p className="muted small">
                    {plural(p.classes, 'class', 'classes')} · valid {validity(p.validDays)}
                    {p.classes > 1 && ` · ${money(cur, Math.round(p.price / p.classes))} per class`}
                  </p>
                  <button className="btn primary block" onClick={() => { setSelected(p); setMsg(null) }}>
                    {p.recurring ? 'Join' : 'Buy'}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {selected && preview && (
        <div className="sheet" role="dialog" aria-label="Checkout">
          <div className="card checkout">
            <h3>{selected.name}</h3>
            <label>
              Promo code
              <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Optional" />
            </label>
            {promoError && promo && <p className="error small">{promoError}</p>}
            <dl className="totals">
              <dt>Price</dt><dd>{money(cur, preview.price)}</dd>
              {preview.discount > 0 && (<><dt>Discount ({preview.promo})</dt><dd>-{money(cur, preview.discount)}</dd></>)}
              <dt><strong>Total</strong></dt><dd><strong>{money(cur, preview.net)}</strong></dd>
            </dl>
            <p className="muted tiny">Demo checkout: no payment is taken. Connect a payment gateway before going live.</p>
            <div className="actions">
              <button
                className="btn primary"
                onClick={() => {
                  const err = apply((s) => purchase(s, user.id, selected.id, { promo: promoError ? '' : promo }))
                  setMsg(err ? { kind: 'error', text: err } : { kind: 'ok', text: `${selected.name} added to your account.` })
                  if (!err) { setSelected(null); setPromo('') }
                }}
              >
                Pay {money(cur, preview.net)}
              </button>
              <button className="btn ghost" onClick={() => setSelected(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2>Used or expired</h2>
          <ul className="rows">
            {past.map((p) => (
              <li key={p.id} className="card row muted">
                <span>{p.name}</span>
                <span className="small">{p.remaining ? `${p.remaining} unused · expired ${fmtDate(p.expiresAt)}` : 'Fully used'}</span>
                <span />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function validity(days: number) {
  if (days % 365 === 0) return plural(days / 365, 'year')
  if (days % 30 === 0) return plural(days / 30, 'month')
  if (days % 7 === 0) return plural(days / 7, 'week')
  return plural(days, 'day')
}
