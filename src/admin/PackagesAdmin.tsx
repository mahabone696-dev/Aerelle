import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { groupsOf, newId, savePackageOption, savePromo, type PackageOption } from '../lib/model'
import { money } from '../lib/format'
import { validity } from '../pages/Packs'

export function PackagesAdmin() {
  const { state, apply } = useStore()
  const [editing, setEditing] = useState<PackageOption | null>(null)
  const [showHidden, setShowHidden] = useState(true)
  const cur = state.studio.currency
  const sold = (id: string) => state.orders.filter((o) => o.optionId === id).length
  const list = state.packageOptions.filter((p) => showHidden || !p.hidden)

  return (
    <section>
      <header className="page-head split-head">
        <div>
          <h1>Packages</h1>
          <p className="muted">What members can buy online, plus staff-only packages you assign at the desk.</p>
        </div>
        <button
          className="btn primary"
          onClick={() =>
            setEditing({ id: newId(), name: '', price: 0, classes: 1, validDays: 30, groups: [groupsOf(state)[0]], hidden: false, trial: false, recurring: false, description: '' })
          }
        >
          + New package
        </button>
      </header>
      {editing && <PackageForm option={editing} onDone={() => setEditing(null)} />}

      <label className="check">
        <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show staff-only packages
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Covers</th>
              <th className="num">Classes</th>
              <th className="hide-sm">Valid</th>
              <th className="num">Price</th>
              <th className="num">Sold</th>
              <th>Visibility</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  {p.trial && <span className="badge waitlisted">Trial</span>}
                  {p.recurring && <span className="badge">Monthly</span>}
                </td>
                <td>{p.groups.join(', ')}</td>
                <td className="num">{p.classes}</td>
                <td className="hide-sm">{validity(p.validDays)}</td>
                <td className="num">{money(cur, p.price)}</td>
                <td className="num">{sold(p.id)}</td>
                <td>
                  <button
                    className={`chip ${p.hidden ? '' : 'on'}`}
                    aria-pressed={!p.hidden}
                    onClick={() => apply((s) => savePackageOption(s, { ...p, hidden: !p.hidden }))}
                    title="Toggle whether members can buy this online"
                  >
                    {p.hidden ? 'Staff only' : 'Online'}
                  </button>
                </td>
                <td><button className="link" onClick={() => setEditing(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Promos />
    </section>
  )
}

function PackageForm({ option, onDone }: { option: PackageOption; onDone: () => void }) {
  const { state, apply } = useStore()
  const [form, setForm] = useState(option)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PackageOption>(k: K, v: PackageOption[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleGroup = (g: string) =>
    set('groups', form.groups.includes(g) ? form.groups.filter((x) => x !== g) : [...form.groups, g])

  function submit(e: FormEvent) {
    e.preventDefault()
    const err = apply((s) => savePackageOption(s, { ...form, name: form.name.trim() }))
    setError(err)
    if (!err) onDone()
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <label className="span2">Name<input value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
      <label>Price ({state.studio.currency})<input type="number" min={0} step="0.01" value={form.price} onChange={(e) => set('price', +e.target.value)} /></label>
      <label>Classes<input type="number" min={1} value={form.classes} onChange={(e) => set('classes', +e.target.value)} /></label>
      <label>Valid for (days)<input type="number" min={1} value={form.validDays} onChange={(e) => set('validDays', +e.target.value)} /></label>
      <fieldset className="full">
        <legend>Can be used for</legend>
        {groupsOf(state).map((g) => (
          <label key={g} className="check">
            <input type="checkbox" checked={form.groups.includes(g)} onChange={() => toggleGroup(g)} /> {g}
          </label>
        ))}
      </fieldset>
      <fieldset className="full">
        <legend>Options</legend>
        <label className="check"><input type="checkbox" checked={form.hidden} onChange={(e) => set('hidden', e.target.checked)} /> Staff only (not sold online)</label>
        <label className="check"><input type="checkbox" checked={form.trial} onChange={(e) => set('trial', e.target.checked)} /> Trial (one per member)</label>
        <label className="check"><input type="checkbox" checked={form.recurring} onChange={(e) => set('recurring', e.target.checked)} /> Monthly membership</label>
      </fieldset>
      {error && <p className="error full">{error}</p>}
      <div className="full actions">
        <button className="btn primary">Save package</button>
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

function Promos() {
  const { state, apply } = useStore()
  const [code, setCode] = useState('')
  const [pct, setPct] = useState(10)
  const [max, setMax] = useState(0)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <h2>Promo codes</h2>
      <form
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          const err = apply((s) => savePromo(s, code, pct, max))
          setError(err)
          if (!err) setCode('')
        }}
      >
        <label>Code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. RAYA20" required /></label>
        <label>% off<input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(+e.target.value)} /></label>
        <label>Max uses (0 = unlimited)<input type="number" min={0} value={max} onChange={(e) => setMax(+e.target.value)} /></label>
        <div className="actions end"><button className="btn primary">Create code</button></div>
        {error && <p className="error full">{error}</p>}
      </form>
      <ul className="rows">
        {state.promoCodes.map((p) => (
          <li key={p.id} className="card row">
            <div>
              <strong className="mono">{p.code}</strong>
              <p className="muted small">{p.percentOff}% off · used {p.uses}{p.maxUses ? ` of ${p.maxUses}` : ''} times</p>
            </div>
            <span className={`badge ${p.active ? '' : 'cancelled'}`}>{p.active ? 'Active' : 'Paused'}</span>
            <button
              className="btn ghost"
              onClick={() => apply((s) => ({ ...s, promoCodes: s.promoCodes.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)) }))}
            >
              {p.active ? 'Pause' : 'Activate'}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
