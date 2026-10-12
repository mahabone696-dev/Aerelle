import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { BookingError, groupsOf, newId, type Staff, type Studio } from '../lib/model'

export function Settings() {
  return (
    <section>
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <StudioForm />
      <ClassTypes />
      <StaffList />
    </section>
  )
}

function StudioForm() {
  const { state, apply } = useStore()
  const [form, setForm] = useState<Studio>(state.studio)
  const [saved, setSaved] = useState<string | null>(null)
  const set = <K extends keyof Studio>(k: K, v: Studio[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(null) }
  function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(
      apply((s) => {
        if (!form.name.trim()) throw new BookingError('Studio name is required.')
        if (form.cancelHours < 0 || form.cancelHours > 168) throw new BookingError('Cancellation window must be 0–168 hours.')
        return { ...s, studio: { ...form, name: form.name.trim() } }
      }) ?? 'Saved.',
    )
  }
  return (
    <>
      <h2>Studio details</h2>
      <form className="card form-grid" onSubmit={submit}>
        <label>Studio name<input value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label>Location<input value={form.location} onChange={(e) => set('location', e.target.value)} /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label>Phone<input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label>Currency<input value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={4} /></label>
        <label>
          Cancellation window (hours)
          <input type="number" min={0} max={168} value={form.cancelHours} onChange={(e) => set('cancelHours', +e.target.value)} />
        </label>
        <label className="full">
          Description
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        </label>
        <p className="muted tiny full">Cancelling at least this many hours before class returns the class to the member's package. Later cancellations keep it.</p>
        <div className="full actions">
          <button className="btn primary">Save</button>
          {saved && <span className={saved === 'Saved.' ? 'muted small' : 'error small'}>{saved}</span>}
        </div>
      </form>
    </>
  )
}

function ClassTypes() {
  const { state, apply } = useStore()
  const [name, setName] = useState('')
  const [group, setGroup] = useState(groupsOf(state)[0] ?? 'Mat')
  const [newGroup, setNewGroup] = useState('')
  const [error, setError] = useState<string | null>(null)
  const groups = groupsOf(state)
  return (
    <>
      <h2>Class types</h2>
      <p className="muted small">Each class type belongs to a group. Packages unlock groups, so a Reformer pack can't be used for a Mat class.</p>
      <form
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          const g = (group === '__new' ? newGroup : group).trim()
          setError(
            apply((s) => {
              if (!name.trim() || !g) throw new BookingError('Enter a class name and group.')
              if (s.classTypes.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) throw new BookingError('That class type exists.')
              return { ...s, classTypes: [...s.classTypes, { id: newId(), name: name.trim(), group: g }] }
            }),
          )
          setName('')
        }}
      >
        <label className="span2">Class name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>
          Group
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => <option key={g}>{g}</option>)}
            <option value="__new">New group…</option>
          </select>
        </label>
        {group === '__new' && <label>New group<input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} /></label>}
        <div className="actions end"><button className="btn primary">Add class type</button></div>
        {error && <p className="error full">{error}</p>}
      </form>
      {groups.map((g) => (
        <div key={g} className="card type-group">
          <strong>{g}</strong>
          <ul className="chips">
            {state.classTypes.filter((c) => c.group === g).map((c) => {
              const used = state.sessions.some((s) => s.title === c.name && new Date(s.start) > new Date())
              return (
                <li key={c.id} className="chip static">
                  {c.name}
                  <button
                    className="link"
                    aria-label={`Remove ${c.name}`}
                    title={used ? 'Has upcoming classes' : 'Remove'}
                    disabled={used}
                    onClick={() => apply((s) => ({ ...s, classTypes: s.classTypes.filter((x) => x.id !== c.id) }))}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

function StaffList() {
  const { state, apply } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Staff['role']>('Instructor')
  const [error, setError] = useState<string | null>(null)
  const update = (id: string, patch: Partial<Staff>) =>
    apply((s) => ({ ...s, staff: s.staff.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  return (
    <>
      <h2>Staff</h2>
      <form
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          setError(
            apply((s) => {
              if (!name.trim()) throw new BookingError('Enter a name.')
              return { ...s, staff: [...s.staff, { id: newId(), name: name.trim(), email: email.trim(), role, showOnSite: role === 'Instructor' }] }
            }),
          )
          setName('')
          setEmail('')
        }}
      >
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as Staff['role'])}>
            <option>Instructor</option><option>Front desk</option><option>Manager</option>
          </select>
        </label>
        <div className="actions end"><button className="btn primary">Add staff</button></div>
        {error && <p className="error full">{error}</p>}
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th className="hide-sm">Email</th><th>Role</th><th>On booking page</th><th className="num">Upcoming classes</th><th /></tr></thead>
          <tbody>
            {state.staff.map((st) => {
              const upcoming = state.sessions.filter((s) => s.instructor === st.name && new Date(s.start) > new Date()).length
              return (
                <tr key={st.id}>
                  <td><strong>{st.name}</strong></td>
                  <td className="hide-sm">{st.email || '–'}</td>
                  <td>
                    <select value={st.role} onChange={(e) => update(st.id, { role: e.target.value as Staff['role'] })}>
                      <option>Instructor</option><option>Front desk</option><option>Manager</option>
                    </select>
                  </td>
                  <td><input type="checkbox" checked={st.showOnSite} onChange={(e) => update(st.id, { showOnSite: e.target.checked })} aria-label={`Show ${st.name} on booking page`} /></td>
                  <td className="num">{upcoming}</td>
                  <td>
                    <button
                      className="link danger-text"
                      disabled={upcoming > 0}
                      title={upcoming ? 'Reassign their upcoming classes first' : 'Remove'}
                      onClick={() => confirm(`Remove ${st.name}?`) && apply((s) => ({ ...s, staff: s.staff.filter((x) => x.id !== st.id) }))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
