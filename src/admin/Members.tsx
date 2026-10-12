import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { activePackages, addMember, markOrderPaid, purchase, type PaymentMethod, type User } from '../lib/model'
import { fmtDate, fmtDay, fmtTime, money } from '../lib/format'
import { navigate, type Route } from '../lib/router'
import { UserPlus } from 'lucide-react'
import { initials } from '../ui'

const METHODS: PaymentMethod[] = ['Cash', 'Card', 'Online banking', 'Bank transfer', 'Complimentary']
type Tab = 'all' | 'birthdays' | 'unpaid'

export function Members({ route }: { route: Route }) {
  const { state } = useStore()
  const tab = (route.query.get('tab') as Tab) || 'all'
  const selectedId = route.query.get('id')
  const [q, setQ] = useState(route.query.get('q') ?? '')
  const [adding, setAdding] = useState(false)
  const cur = state.studio.currency
  const month = new Date().getMonth() + 1

  const members = state.users.filter((u) => u.role === 'member')
  const stats = (u: User) => {
    const orders = state.orders.filter((o) => o.userId === u.id)
    const bookings = state.bookings.filter((b) => b.userId === u.id && b.status === 'booked')
    return {
      sales: orders.reduce((n, o) => n + o.net, 0),
      packages: activePackages(state, u.id).length,
      bookings: bookings.length,
      attended: bookings.filter((b) => b.attendance === 'attended').length,
      unpaid: orders.filter((o) => !o.paid).length,
    }
  }
  const birthdayThisMonth = (u: User) => !!u.birthday && Number(u.birthday.slice(5, 7)) === month
  const counts = {
    all: members.length,
    birthdays: members.filter(birthdayThisMonth).length,
    unpaid: members.filter((u) => stats(u).unpaid > 0).length,
  }
  const term = q.trim().toLowerCase()
  const list = members
    .filter((u) => (tab === 'birthdays' ? birthdayThisMonth(u) : tab === 'unpaid' ? stats(u).unpaid > 0 : true))
    .filter((u) => !term || [u.name, u.email, u.phone].some((f) => f.toLowerCase().includes(term)))
    .sort((a, b) => (tab === 'birthdays' ? a.birthday.slice(5).localeCompare(b.birthday.slice(5)) : a.name.localeCompare(b.name)))
  const selected = members.find((u) => u.id === selectedId)
  const go = (t: Tab, id?: string) => navigate(`/members?tab=${t}${id ? `&id=${id}` : ''}`)

  return (
    <section>
      <header className="page-head split-head">
        <div>
          <h1>Members</h1>
          <p className="muted">{members.length} members</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(!adding)}><UserPlus size={16} /> Add member</button>
      </header>
      {adding && <AddMember onDone={(id) => { setAdding(false); if (id) go(tab, id) }} />}

      <div className="tabs" role="tablist">
        {(['all', 'birthdays', 'unpaid'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => go(t)}>
            {t === 'all' ? 'All members' : t === 'birthdays' ? 'Birthdays this month' : 'Unpaid packages'}
            <span className="count">{counts[t]}</span>
          </button>
        ))}
      </div>
      <input className="search" type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className={selected ? 'master-detail' : ''}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th className="hide-sm">Email</th>
                <th className="hide-sm">Phone</th>
                {tab === 'birthdays' && <th>Birthday</th>}
                <th className="num">Sales</th>
                <th className="num">Packages</th>
                <th className="num">Booked</th>
                <th className="num">Attended</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const s = stats(u)
                return (
                  <tr key={u.id} className={u.id === selectedId ? 'active' : ''} onClick={() => go(tab, u.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(tab, u.id)}>
                    <td>
                      <span className="who nowrap">
                        <span className="avatar sm">{initials(u.name)}</span>
                        <strong>{u.name}</strong>
                      </span>
                      {s.unpaid > 0 && <span className="badge waitlisted">Unpaid</span>}
                      {!u.passwordHash && <span className="badge cancelled">No login</span>}
                    </td>
                    <td className="hide-sm">{u.email}</td>
                    <td className="hide-sm nowrap">{u.phone}</td>
                    {tab === 'birthdays' && <td>{new Date(u.birthday).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</td>}
                    <td className="num">{money(cur, s.sales)}</td>
                    <td className="num">{s.packages}</td>
                    <td className="num">{s.bookings}</td>
                    <td className="num">{s.attended}</td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr><td colSpan={8} className="empty">No members match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {selected && <MemberDetail user={selected} onClose={() => go(tab)} />}
      </div>
    </section>
  )
}

function MemberDetail({ user, onClose }: { user: User; onClose: () => void }) {
  const { state, apply } = useStore()
  const cur = state.studio.currency
  const [optionId, setOptionId] = useState(state.packageOptions[0]?.id ?? '')
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [paid, setPaid] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const pkgs = state.memberPackages.filter((p) => p.userId === user.id).sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
  const orders = state.orders.filter((o) => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const upcoming = state.bookings
    .filter((b) => b.userId === user.id && (b.status === 'booked' || b.status === 'waitlisted'))
    .map((b) => state.sessions.find((s) => s.id === b.sessionId)!)
    .filter((s) => s && new Date(s.start) > new Date())
    .sort((a, b) => a.start.localeCompare(b.start))
  const now = new Date()

  return (
    <aside className="card detail">
      <div className="split-head">
        <div>
          <h2 className="flush">{user.name}</h2>
          <p className="muted small">
            {user.email}{user.phone && ` · ${user.phone}`}<br />
            Member since {fmtDate(user.joinedAt)}{user.birthday && ` · Birthday ${new Date(user.birthday).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`}
          </p>
        </div>
        <button className="link" onClick={onClose} aria-label="Close">×</button>
      </div>
      {msg && <p className={`${msg.kind} banner`}>{msg.text}</p>}

      <h3>Packages</h3>
      {pkgs.length === 0 && <p className="muted small">None yet.</p>}
      <ul className="plain">
        {pkgs.map((p) => {
          const active = p.remaining > 0 && new Date(p.expiresAt) > now
          return (
            <li key={p.id} className={active ? '' : 'muted'}>
              <strong>{p.name}</strong> ·{' '}
              {active
                ? `${p.remaining}/${p.total} left · expires ${fmtDate(p.expiresAt)}`
                : p.remaining === 0 ? 'fully used' : `${p.remaining} unused · expired ${fmtDate(p.expiresAt)}`}
            </li>
          )
        })}
      </ul>

      <h3>Sell or assign a package</h3>
      <div className="form-grid tight">
        <label className="full">
          Package
          <select value={optionId} onChange={(e) => setOptionId(e.target.value)}>
            {state.packageOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {money(cur, p.price)}{p.hidden ? ' (staff only)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Paid now
        </label>
        <button
          className="btn primary full"
          onClick={() => {
            const err = apply((s) => purchase(s, user.id, optionId, { method, paid, source: 'Front desk' }))
            setMsg(err ? { kind: 'error', text: err } : { kind: 'ok', text: paid ? 'Package added.' : 'Package added as unpaid.' })
          }}
        >
          Add package
        </button>
      </div>

      <h3>Orders</h3>
      <ul className="plain">
        {orders.map((o) => (
          <li key={o.id}>
            {fmtDate(o.createdAt)} · {o.name} · {money(cur, o.net)} · {o.method}{' '}
            {o.paid ? (
              <span className="badge">Paid</span>
            ) : (
              <>
                <span className="badge waitlisted">Unpaid</span>{' '}
                <button className="link" onClick={() => apply((s) => markOrderPaid(s, o.id, method))}>Mark paid ({method})</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <h3>Upcoming bookings</h3>
      {upcoming.length === 0 ? (
        <p className="muted small">None.</p>
      ) : (
        <ul className="plain">
          {upcoming.map((s) => (
            <li key={s.id}>{fmtDay(new Date(s.start))} {fmtTime(new Date(s.start))} · {s.title}</li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function AddMember({ onDone }: { onDone: (id?: string) => void }) {
  const { state, apply } = useStore()
  const [form, setForm] = useState({ name: '', email: '', phone: '', birthday: '' })
  const [error, setError] = useState<string | null>(null)
  function submit(e: FormEvent) {
    e.preventDefault()
    const before = new Set(state.users.map((u) => u.id))
    let newId: string | undefined
    const err = apply((s) => {
      const next = addMember(s, form)
      newId = next.users.find((u) => !before.has(u.id))?.id
      return next
    })
    setError(err)
    if (!err) onDone(newId)
  }
  const field = (k: keyof typeof form, label: string, type = 'text') => (
    <label>
      {label}
      <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === 'name' || k === 'email'} />
    </label>
  )
  return (
    <form className="card form-grid" onSubmit={submit}>
      {field('name', 'Name')}
      {field('email', 'Email', 'email')}
      {field('phone', 'Mobile number', 'tel')}
      {field('birthday', 'Birthday', 'date')}
      <p className="muted tiny full">They can set a password later by creating an account with this email.</p>
      {error && <p className="error full">{error}</p>}
      <div className="full actions">
        <button className="btn primary">Add member</button>
        <button type="button" className="btn ghost" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  )
}
